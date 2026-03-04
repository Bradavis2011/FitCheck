/**
 * SEO Content Agent
 *
 * Generates blog post drafts based on top user occasions and fashion trends.
 * Drafts are queued for founder review via executeOrQueue (high risk).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget, reserveTokens, recordTokenUsage } from './token-budget.service.js';
import { executeOrQueue } from './agent-manager.service.js';
import { getTrendData } from './content-calendar.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

async function getTopOccasions(): Promise<string[]> {
  try {
    const recentChecks = await prisma.outfitCheck.findMany({
      where: { isDeleted: false, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { occasions: true },
      take: 200,
    });

    const counts = new Map<string, number>();
    for (const check of recentChecks) {
      for (const occ of check.occasions) {
        counts.set(occ, (counts.get(occ) || 0) + 1);
      }
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([o]) => o);
    return sorted.length > 0
      ? sorted
      : ['Work', 'Casual Friday', 'Date Night', 'Job Interview', 'Weekend Brunch'];
  } catch {
    return ['Work', 'Casual Friday', 'Date Night', 'Job Interview', 'Weekend Brunch'];
  }
}

interface BlogPostDraft {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  ogTitle: string;
}

async function generateBlogPost(topic: string, category: string): Promise<BlogPostDraft | null> {
  const estimated = 2000;
  const reserved = await reserveTokens(estimated, 'seo_content');
  if (!reserved) {
    console.log(`[SeoContent] Token reservation failed for topic: ${topic}`);
    return null;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
  });

  const prompt = `You are a fashion content writer for "Or This?" — an AI outfit feedback app. Write a blog post for the following topic.

TOPIC: ${topic}
CATEGORY: ${category}

Return ONLY a JSON object with this exact shape (no markdown):
{
  "title": "SEO-optimised title (50-60 chars)",
  "content": "Full blog post body (~500 words, markdown formatted with ## headings)",
  "metaDescription": "Meta description under 160 characters, includes target keyword",
  "ogTitle": "Open Graph title for social sharing (under 60 chars)"
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const usageMeta = result.response.usageMetadata;
    const actual = (usageMeta?.promptTokenCount ?? 0) + (usageMeta?.candidatesTokenCount ?? 0);
    await recordTokenUsage(estimated, actual || estimated, 'seo_content');

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]) as Omit<BlogPostDraft, 'slug'>;
    return {
      ...parsed,
      metaDescription: parsed.metaDescription.slice(0, 160),
      slug: slugify(parsed.title),
    };
  } catch (err) {
    console.error(`[SeoContent] Gemini failed for topic "${topic}":`, err);
    await recordTokenUsage(estimated, 0, 'seo_content');
    return null;
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runSeoContentAgent(): Promise<void> {
  console.log('[SeoContent] Starting run...');

  const budgetOk = await hasLearningBudget(4);
  if (!budgetOk) {
    console.log('[SeoContent] Insufficient token budget (priority 4) — skipping');
    return;
  }

  const [occasions, trendData] = await Promise.all([getTopOccasions(), getTrendData()]);

  const topOccasion = occasions[0] ?? 'Work';
  const topTrend = trendData.topStyles[0] ?? 'minimalist';
  const evergreen = occasions[1] ?? 'Casual Friday';

  const topics = [
    { topic: `What to wear to ${topOccasion} — a seasonal guide`, category: 'occasion-guide' },
    { topic: `How to style the ${topTrend} look`, category: 'trend-guide' },
    { topic: `10 outfit mistakes to avoid for ${evergreen}`, category: 'evergreen' },
  ];

  let draftsCreated = 0;
  const createdTitles: string[] = [];

  for (const { topic, category } of topics) {
    const draft = await generateBlogPost(topic, category);
    if (!draft) continue;

    try {
      // Ensure unique slug
      const baseSlug = draft.slug;
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.blogDraft.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const created = await prisma.blogDraft.create({
        data: {
          title: draft.title,
          slug,
          content: draft.content,
          metaDescription: draft.metaDescription,
          ogTitle: draft.ogTitle,
          status: 'pending_review',
          sourceData: { topic, category, generatedAt: new Date().toISOString() },
        },
      });

      // Medium risk — brand guard checks content, then auto-publishes
      await executeOrQueue(
        'seo-content',
        'publish_draft',
        'medium',
        { blogDraftId: created.id, slug, title: draft.title },
        async (payload) => {
          const p = payload as { blogDraftId: string };
          await prisma.blogDraft.update({
            where: { id: p.blogDraftId },
            data: { status: 'published' },
          });
          return { published: true, draftId: p.blogDraftId };
        },
        draft.title + ' ' + draft.metaDescription,
      );

      draftsCreated++;
      createdTitles.push(draft.title);
      console.log(`[SeoContent] Draft created: "${draft.title}" (slug: ${slug})`);
    } catch (err) {
      console.error(`[SeoContent] Failed to save draft for topic "${topic}":`, err);
    }
  }

  // Publish metrics
  try {
    await publishToIntelligenceBus('seo-content', 'seo_metrics', {
      draftsCreated,
      topics: createdTitles,
      topOccasion,
      topTrend,
    });
  } catch (err) {
    console.error('[SeoContent] Failed to publish metrics:', err);
  }

  console.log(`[SeoContent] Done — ${draftsCreated} draft(s) created`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getSeoSummary(): Promise<{ pendingDrafts: number; publishedDrafts: number }> {
  const [pendingDrafts, publishedDrafts] = await Promise.all([
    prisma.blogDraft.count({ where: { status: 'pending_review' } }),
    prisma.blogDraft.count({ where: { status: 'published' } }),
  ]);
  return { pendingDrafts, publishedDrafts };
}
