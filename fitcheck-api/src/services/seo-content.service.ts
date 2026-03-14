/**
 * SEO Content Agent
 *
 * Generates blog post drafts based on top user occasions and fashion trends.
 * Also runs niche-targeted content blitzes (rush, postpartum, dating).
 * Drafts are queued for brand guard check + auto-publish via executeOrQueue.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus, readFromIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget, reserveTokens, recordTokenUsage } from './token-budget.service.js';
import { executeOrQueue } from './agent-manager.service.js';
import { getTrendData } from './content-calendar.service.js';
import { searchSerper } from './seo-intelligence.service.js';

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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BlogPostDraft {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  ogTitle: string;
  excerpt?: string;
  seoKeywords?: string[];
  faqItems?: Array<{ question: string; answer: string }>;
}

// ─── Generic blog post (occasions/trends) ─────────────────────────────────────

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

// ─── Niche-targeted article (1200-1800 words with FAQ) ────────────────────────

async function generateNicheArticle(
  keyword: string,
  niche: string,
  intent: string,
  refreshHint?: 'boost' | 'expand' | 'reangle',
): Promise<BlogPostDraft | null> {
  const estimated = 4000;
  const reserved = await reserveTokens(estimated, 'seo_content');
  if (!reserved) {
    console.log(`[SeoContent] Token reservation failed for keyword: ${keyword}`);
    return null;
  }

  // ── Fetch real SERP data to write against what's actually ranking ──────────
  let serpContext = '';
  if (process.env.SERPER_API_KEY) {
    try {
      const serp = await searchSerper(keyword, 10);

      const topResults = serp.organic.slice(0, 5)
        .map((r, i) => {
          let host = r.link;
          try { host = new URL(r.link).hostname; } catch { /* keep raw */ }
          return `${i + 1}. "${r.title}" — ${r.snippet} (${host})`;
        })
        .join('\n');

      const paaQuestions = serp.peopleAlsoAsk.slice(0, 6)
        .map(r => `- "${r.question}"`)
        .join('\n');

      const relatedSearches = serp.relatedSearches.slice(0, 5)
        .map(r => `- "${r.query}"`)
        .join('\n');

      const answerBox = serp.answerBox?.snippet
        ? `FEATURED SNIPPET (what currently wins position zero):\n"${serp.answerBox.snippet}"\n— Beat this with a more specific, actionable answer in your opening section.\n\n`
        : '';

      serpContext = `

SERP INTELLIGENCE FOR "${keyword}":
${answerBox}CURRENT TOP RESULTS (write better than these):
${topResults}

PEOPLE ALSO ASK — use ALL of these as your FAQ items (real questions people type):
${paaQuestions}

RELATED SEARCHES — weave these naturally into your content:
${relatedSearches}

Your article MUST outperform what's currently ranking. Be more specific, more actionable, and answer every PAA question directly with concrete details.`;

      console.log(`[SeoContent] SERP data fetched for "${keyword}" — ${serp.organic.length} results, ${serp.peopleAlsoAsk.length} PAA questions`);
    } catch (err) {
      console.error(`[SeoContent] SERP fetch failed for "${keyword}" (generating without it):`, err);
    }
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  });

  const nicheContext: Record<string, string> = {
    rush: `You are writing for women preparing for sorority rush week. The audience is college-aged women (18-22) who are anxious about their outfits. They are TikTok-native, shop at Zara, Revolve, Madewell, and Free People, and care deeply about making a good first impression.

Tone: supportive big sister — warm, specific, honest. Not condescending fashion authority. Acknowledge the anxiety; this is emotionally loaded for many women.

IMPORTANT:
- The app is called "Or This?" and gives AI feedback — do NOT mention community voting or "500 women voted"
- Include SPECIFIC outfit recommendations with real brands/stores (Zara, Revolve, Abercrombie, Princess Polly, etc.)
- Include specific items like "white linen midi dress from Madewell" not vague "a nice dress"
- CTA at end: "Still not sure? Snap a photo of your outfit and get instant AI feedback with Or This? — know you nailed it before you walk in." with App Store link https://apps.apple.com/app/or-this/id6742406265`,
  };

  const contextNote = nicheContext[niche] || 'Write for an audience anxious about their outfit choices.';

  const refreshInstructions: Record<string, string> = {
    boost: '\n\nREFRESH STRATEGY: This article currently ranks positions 4-10. To push into top 3: sharpen the opening hook, add a more scannable structure, and make each section more specific and actionable than what is currently ranking.',
    expand: '\n\nREFRESH STRATEGY: This article ranks positions 11-30. Expand significantly: add more sections, deeper detail on each round or situation, more specific brand/item recommendations, and ensure every PAA question above has a thorough standalone answer.',
    reangle: '\n\nREFRESH STRATEGY: This article is not ranking in the top 30. Change the angle entirely — use a different title approach, different hook, different structure. What unique perspective or information can this article offer that nothing currently ranking provides?',
  };

  const refreshNote = refreshHint ? (refreshInstructions[refreshHint] ?? '') : '';

  const prompt = `${contextNote}${refreshNote}

Write a comprehensive SEO article targeting the following keyword.${serpContext}

TARGET KEYWORD: "${keyword}"
SEARCH INTENT: ${intent}

Return ONLY a JSON object with this exact shape (no markdown, no code fence):
{
  "title": "Title 50-60 chars, include keyword naturally",
  "metaDescription": "Under 155 chars, address the anxiety directly, include keyword",
  "ogTitle": "Open Graph title under 60 chars for sharing",
  "excerpt": "2-3 sentence summary for article listings",
  "seoKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content": "Full article body 1200-1800 words, proper markdown with ## and ### headings. Open with empathy. Include Do's and Don'ts section. Be specific with brand/item recommendations. End with CTA.",
  "faqItems": [
    {"question": "Question 1?", "answer": "Detailed answer."},
    {"question": "Question 2?", "answer": "Detailed answer."},
    {"question": "Question 3?", "answer": "Detailed answer."},
    {"question": "Question 4?", "answer": "Detailed answer."},
    {"question": "Question 5?", "answer": "Detailed answer."}
  ]
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
      metaDescription: (parsed.metaDescription ?? '').slice(0, 155),
      slug: slugify(parsed.title),
    };
  } catch (err) {
    console.error(`[SeoContent] Niche article generation failed for "${keyword}":`, err);
    await recordTokenUsage(estimated, 0, 'seo_content');
    return null;
  }
}

// ─── Save draft helper ─────────────────────────────────────────────────────────

async function saveDraftAndQueue(
  draft: BlogPostDraft,
  category: string,
  extraData: Record<string, unknown> = {},
): Promise<string | null> {
  try {
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
        excerpt: draft.excerpt,
        seoKeywords: draft.seoKeywords ?? [],
        status: 'pending_review',
        category,
        contentType: 'style_guide',
        sourceData: {
          ...extraData,
          faqItems: draft.faqItems ?? [],
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await executeOrQueue(
      'seo-content',
      'publish_draft',
      'medium',
      { blogDraftId: created.id, slug, title: draft.title },
      async (payload) => {
        const p = payload as { blogDraftId: string };
        await prisma.blogDraft.update({
          where: { id: p.blogDraftId },
          data: { status: 'published', publishedAt: new Date() },
        });
        return { published: true, draftId: p.blogDraftId };
      },
      draft.title + ' ' + draft.metaDescription,
    );

    console.log(`[SeoContent] Draft created: "${draft.title}" (slug: ${slug})`);
    return created.id;
  } catch (err) {
    console.error(`[SeoContent] Failed to save draft "${draft.title}":`, err);
    return null;
  }
}

// ─── Rush Content Blitz ────────────────────────────────────────────────────────

export async function generateRushContentBlitz(): Promise<void> {
  console.log('[SeoContent] Starting rush content blitz...');

  const budgetOk = await hasLearningBudget(3);
  if (!budgetOk) {
    console.log('[SeoContent] Insufficient token budget — skipping rush blitz');
    return;
  }

  // Find next 2 uncovered rush keywords (in priority order)
  const keywords = await prisma.targetKeyword.findMany({
    where: { niche: 'rush', status: 'identified' },
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (keywords.length === 0) {
    console.log('[SeoContent] All rush keywords have content — skipping blitz');
    await refreshRushContent();
    return;
  }

  let created = 0;
  for (const kw of keywords) {
    const draft = await generateNicheArticle(kw.keyword, kw.niche, kw.intent);
    if (!draft) continue;

    const savedId = await saveDraftAndQueue(draft, 'rush', {
      targetKeyword: kw.keyword,
      keywordId: kw.id,
      niche: kw.niche,
    });

    if (savedId) {
      // Mark keyword as having content
      await prisma.targetKeyword.update({
        where: { id: kw.id },
        data: { status: 'content_created', targetPageSlug: draft.slug },
      });
      created++;
    }
  }

  try {
    await publishToIntelligenceBus('seo-content', 'seo_metrics', {
      blitzType: 'rush',
      articlesCreated: created,
      keywordsRemaining: await prisma.targetKeyword.count({ where: { niche: 'rush', status: 'identified' } }),
    });
  } catch (err) {
    console.error('[SeoContent] Failed to publish blitz metrics:', err);
  }

  console.log(`[SeoContent] Rush blitz done — ${created} article(s) created`);
}

// ─── Rush Content Refresh (monthly) ───────────────────────────────────────────

export async function refreshRushContent(): Promise<void> {
  console.log('[SeoContent] Running rush content refresh...');

  const budgetOk = await hasLearningBudget(4);
  if (!budgetOk) return;

  // Fetch all rush keywords that have content, ordered by last updated (oldest first)
  const keywords = await prisma.targetKeyword.findMany({
    where: { niche: 'rush', status: 'content_created' },
    orderBy: { updatedAt: 'asc' },
  });

  if (keywords.length === 0) {
    console.log('[SeoContent] No rush keywords with content yet — skipping refresh');
    return;
  }

  const sixWeeksAgo = new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000);
  let refreshed = 0;

  for (const kw of keywords) {
    const pos = kw.currentPosition;

    // Positions 1-3: working — do not touch
    if (pos !== null && pos <= 3) {
      console.log(`[SeoContent] "${kw.keyword}" → pos ${pos} (top 3, skipping)`);
      continue;
    }

    let refreshHint: 'boost' | 'expand' | 'reangle';
    let refreshType: string;

    if (pos !== null && pos >= 4 && pos <= 10) {
      // Close to top 3 — targeted boost with fresh SERP
      refreshHint = 'boost';
      refreshType = 'content_boost';
    } else if (pos !== null && pos >= 11 && pos <= 30) {
      // Mid-table — major expansion
      refreshHint = 'expand';
      refreshType = 'major_expansion';
    } else if (pos === null && kw.createdAt < sixWeeksAgo) {
      // Not ranking after 6 weeks — change angle
      refreshHint = 'reangle';
      refreshType = 'angle_change';
    } else if (pos !== null && pos > 30) {
      // Deep page — change angle
      refreshHint = 'reangle';
      refreshType = 'angle_change';
    } else {
      // null position but recently created — too early to judge, skip
      console.log(`[SeoContent] "${kw.keyword}" → no position data yet (recently created, skipping)`);
      continue;
    }

    console.log(`[SeoContent] Refreshing "${kw.keyword}" → pos ${pos ?? 'unranked'}, strategy: ${refreshType}`);
    const draft = await generateNicheArticle(kw.keyword, kw.niche, kw.intent, refreshHint);
    if (!draft) continue;

    await saveDraftAndQueue(draft, 'rush', {
      targetKeyword: kw.keyword,
      keywordId: kw.id,
      niche: kw.niche,
      refreshType,
      previousPosition: pos,
    });

    refreshed++;

    // Process at most 2 refreshes per run to stay within token budget
    if (refreshed >= 2) break;
  }

  console.log(`[SeoContent] Rush content refresh done — ${refreshed} article(s) queued for refresh`);
}

// ─── Main weekly runner (general occasions + trends) ──────────────────────────

export async function runSeoContentAgent(): Promise<void> {
  console.log('[SeoContent] Starting run...');

  const budgetOk = await hasLearningBudget(4);
  if (!budgetOk) {
    console.log('[SeoContent] Insufficient token budget (priority 4) — skipping');
    return;
  }

  // Read seo_opportunities from bus to pick better topics
  let busTopics: string[] = [];
  try {
    const busData = await readFromIntelligenceBus('seo-content', 'seo_opportunities', { limit: 1 });
    if (busData[0]?.payload) {
      const payload = busData[0].payload as { opportunities?: Array<{ query: string }> };
      busTopics = (payload.opportunities ?? []).slice(0, 3).map((o) => o.query);
    }
  } catch {
    // No bus data available
  }

  const [occasions, trendData] = await Promise.all([getTopOccasions(), getTrendData()]);

  const topOccasion = occasions[0] ?? 'Work';
  const topTrend = trendData.topStyles[0] ?? 'minimalist';
  const evergreen = occasions[1] ?? 'Casual Friday';

  const topics = busTopics.length > 0
    ? busTopics.map((t) => ({ topic: t, category: 'seo-opportunity' }))
    : [
        { topic: `What to wear to ${topOccasion} — a seasonal guide`, category: 'occasion-guide' },
        { topic: `How to style the ${topTrend} look`, category: 'trend-guide' },
        { topic: `10 outfit mistakes to avoid for ${evergreen}`, category: 'evergreen' },
      ];

  let draftsCreated = 0;
  const createdTitles: string[] = [];

  for (const { topic, category } of topics) {
    const draft = await generateBlogPost(topic, category);
    if (!draft) continue;

    const savedId = await saveDraftAndQueue(draft, category, { topic });
    if (savedId) {
      draftsCreated++;
      createdTitles.push(draft.title);
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
