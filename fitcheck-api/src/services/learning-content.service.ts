/**
 * Learning Content Service
 *
 * Orchestrates content generation from RSI outputs for the orthis.app/learn hub.
 * Sources: FashionTrend, DiscoveredRule, CalibrationSnapshot, style-rules.ts knowledge base.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { reserveTokens, recordTokenUsage } from './token-budget.service.js';
import {
  COLOR_THEORY,
  FIT_GUIDELINES,
  STYLE_AESTHETICS,
  OCCASION_GUIDELINES,
} from '../knowledge/style-rules.js';

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

function getWeekPeriod(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

async function upsertBlogDraft(data: {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaDescription: string;
  contentType: string;
  category?: string;
  status: string;
  seoKeywords: string[];
  trendPeriod?: string;
  sourceRuleIds?: string[];
  scriptData?: Record<string, unknown>;
}): Promise<void> {
  const { slug, ...rest } = data;
  await prisma.blogDraft.upsert({
    where: { slug },
    create: {
      slug,
      ...rest,
      publishedAt: rest.status === 'published' ? new Date() : null,
      scriptData: rest.scriptData as any,
    },
    update: {
      ...rest,
      publishedAt: rest.status === 'published' ? new Date() : undefined,
      updatedAt: new Date(),
      scriptData: rest.scriptData as any,
    },
  });
}

// ─── Trend Report ─────────────────────────────────────────────────────────────

export async function generateWeeklyTrendReport(): Promise<void> {
  const period = getWeekPeriod();
  const slug = `fashion-trends-${period.toLowerCase()}`;

  // Skip if published draft already exists for this period
  const existing = await prisma.blogDraft.findFirst({
    where: { slug, status: { in: ['published', 'pending_review'] } },
  });
  if (existing) {
    console.log(`[LearningContent] Trend report already exists for ${period} — skipping`);
    return;
  }

  const [trend, calibration, topRules] = await Promise.all([
    prisma.fashionTrend.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.calibrationSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.discoveredRule.findMany({
      where: { confidence: { gte: 0.65 } },
      orderBy: { confidence: 'desc' },
      take: 6,
    }),
  ]);

  if (!trend) {
    console.log('[LearningContent] No fashion trend data found — skipping trend report');
    return;
  }

  const estimated = 2500;
  const reserved = await reserveTokens(estimated, 'learning_content_trend');
  if (!reserved) {
    console.log('[LearningContent] Token budget exceeded — skipping trend report');
    return;
  }

  const rulesText = topRules.length > 0
    ? topRules.map(r => `- ${r.rule} (confidence: ${Math.round(r.confidence * 100)}%, n=${r.sampleSize})`).join('\n')
    : '- No rules yet — data accumulating';

  const calibrationNote = calibration
    ? `AI scores average ${calibration.avgAiScore.toFixed(1)}/10 (community: ${calibration.avgCommunity.toFixed(1)}/10) based on ${calibration.sampleSize} outfits.`
    : '';

  const prompt = `You are an editorial fashion writer for "Or This?" — an AI outfit feedback app that has scored ${calibration?.sampleSize || 'thousands of'} outfits. Write a trend report for ${period}.

TREND DATA (${period}):
- Seasonal colors: ${trend.seasonalColors.join(', ')}
- Trending styles: ${trend.trendingStyles.join(', ')}
- Key pieces: ${trend.keyPieces.join(', ')}
- Trending patterns: ${trend.trendingPatterns.join(', ')}
- Fading trends: ${trend.fadingTrends.join(', ')}

DATA-BACKED STYLE INSIGHTS from our AI (discovered from real outfit scores):
${rulesText}

${calibrationNote}

Write an editorial trend report (~700-900 words). Structure:
1. Opening hook (2-3 sentences, conversational tone, reference real data)
2. "What's In" section — 3-4 trending aesthetics with practical outfit examples
3. "What to Wear Now" — top 3-4 key pieces, how to style each
4. "What's Fading" — brief note on what to avoid
5. Data Insight — highlight one specific data-backed rule with the stat
6. Closing CTA — encourage readers to try Or This? for personalised feedback

Tone: editorial, confident, data-backed. Not listicle. Readable prose with subheadings.
Brand: "Or This?" (AI outfit feedback app, orthis.app).
Output: plain text with ## for subheadings. No markdown fences. ~700-900 words.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.6, maxOutputTokens: 2000 },
    });

    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    await recordTokenUsage(estimated, estimated, 'learning_content_trend');

    const title = `${trend.trendingStyles[0] || 'Fashion'} & More: Style Trends for ${period}`;
    const excerpt = `This week: ${trend.trendingStyles.slice(0, 2).join(', ')} are dominating. Plus data-backed insights from ${calibration?.sampleSize || 'real'} outfit scores.`;

    await executeOrQueue(
      'learning-content',
      'publish_trend_report',
      'medium',
      { slug, title, period },
      async () => {
        await upsertBlogDraft({
          title,
          slug,
          content,
          excerpt,
          metaDescription: excerpt.slice(0, 155),
          contentType: 'trend_report',
          category: 'trends',
          status: 'published',
          seoKeywords: [...trend.trendingStyles.slice(0, 4), 'fashion trends', period.toLowerCase()],
          trendPeriod: period,
          sourceRuleIds: topRules.map(r => r.id),
        });
        console.log(`✅ [LearningContent] Published trend report: ${title}`);
      },
      content,
    );
  } catch (err) {
    console.error('[LearningContent] Trend report generation failed:', err);
  }
}

// ─── Style Tips ───────────────────────────────────────────────────────────────

export async function generateStyleTips(): Promise<void> {
  // Find high-confidence rules not yet converted to tips
  const rules = await prisma.discoveredRule.findMany({
    where: { confidence: { gte: 0.7 } },
    orderBy: { confidence: 'desc' },
    take: 20,
  });

  if (rules.length === 0) {
    console.log('[LearningContent] No high-confidence rules found — skipping style tips');
    return;
  }

  let created = 0;
  for (const rule of rules) {
    const slug = slugify(`style-tip-${rule.rule.slice(0, 50)}`);

    const existing = await prisma.blogDraft.findFirst({ where: { slug } });
    if (existing) continue;

    // Format the stat callout
    const confidencePct = Math.round(rule.confidence * 100);
    const title = rule.rule.length < 80
      ? rule.rule
      : rule.rule.slice(0, 77) + '...';
    const excerpt = `Data from ${rule.sampleSize} outfit scores: ${confidencePct}% confidence. Category: ${rule.category}.`;
    const content = `## ${title}\n\n${rule.rule}\n\n**The data:** ${confidencePct}% confidence across ${rule.sampleSize} outfit checks.\n\n**Why it works:** ${getStyleTipExplanation(rule.category)}\n\n*Scored by Or This? AI based on real user outfit data.*`;

    try {
      await upsertBlogDraft({
        title: title.slice(0, 120),
        slug,
        content,
        excerpt,
        metaDescription: `Style tip: ${title.slice(0, 120)}. Data-backed insight from ${rule.sampleSize} outfit scores.`,
        contentType: 'style_tip',
        category: rule.category,
        status: 'published',
        seoKeywords: [rule.category, 'style tips', 'outfit advice', 'fashion tips'],
        sourceRuleIds: [rule.id],
      });
      created++;
    } catch (err) {
      console.error(`[LearningContent] Failed to create tip for rule ${rule.id}:`, err);
    }
  }

  if (created > 0) {
    console.log(`✅ [LearningContent] Created ${created} style tip(s) from discovered rules`);
  }
}

function getStyleTipExplanation(category: string): string {
  const explanations: Record<string, string> = {
    color: 'Color harmony creates visual cohesion — when hues relate to each other, the eye reads the outfit as intentional rather than accidental.',
    proportion: 'Proportion balance is about creating visual equilibrium between silhouette elements — loose on top pairs naturally with fitted on the bottom, and vice versa.',
    occasion_matching: 'Dressing appropriately for an occasion signals social awareness, which scores consistently higher in our community feedback.',
    fit: 'Fit is the single highest-weighted factor in outfit scoring — a well-fitted basic always outscores an ill-fitting designer piece.',
    texture: 'Texture mixing adds depth without relying on color — pairing smooth and textured fabrics creates sophistication.',
    layering: 'Thoughtful layering extends outfit versatility while adding visual interest through depth and dimension.',
  };
  return explanations[category] || 'This pattern consistently produces higher outfit scores in our data.';
}

// ─── TikTok Scripts ───────────────────────────────────────────────────────────

export async function generateTikTokScripts(): Promise<void> {
  const [trend, topRules] = await Promise.all([
    prisma.fashionTrend.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.discoveredRule.findMany({
      where: { confidence: { gte: 0.7 } },
      orderBy: { confidence: 'desc' },
      take: 5,
    }),
  ]);

  if (!trend && topRules.length === 0) {
    console.log('[LearningContent] Insufficient data for TikTok scripts — skipping');
    return;
  }

  const period = getWeekPeriod();
  const estimated = 2000;
  const reserved = await reserveTokens(estimated, 'learning_content_tiktok');
  if (!reserved) {
    console.log('[LearningContent] Token budget exceeded — skipping TikTok scripts');
    return;
  }

  const trendContext = trend
    ? `Trending now: ${trend.trendingStyles.slice(0, 3).join(', ')}. Key pieces: ${trend.keyPieces.slice(0, 3).join(', ')}.`
    : '';

  const rulesContext = topRules.length > 0
    ? topRules.slice(0, 3).map(r => `${r.rule} (n=${r.sampleSize}, ${Math.round(r.confidence * 100)}% confidence)`).join(' | ')
    : '';

  const prompt = `You are a TikTok content strategist for "Or This?" — an AI outfit scoring app at orthis.app. Generate 3 TikTok video scripts using real data from our AI.

Context:
${trendContext}
Data insights: ${rulesContext}

For each script, return a JSON object:
{
  "hook": "Opening line (first 3 seconds — stops the scroll)",
  "body": "Main content (15-25 seconds — the insight/data)",
  "cta": "Call to action (5 seconds — what to do next)",
  "visualDirections": "What the creator should show on camera",
  "estimatedDuration": "e.g. 30-45s",
  "dataPoint": "The specific stat being referenced",
  "caption": "TikTok caption with 2-3 hashtags"
}

Rules:
- Hook must reference a surprising data point or counterintuitive insight
- Body must cite specific numbers (e.g. "scored 15% higher across 340 outfits")
- CTA should drive to orthis.app or app download
- Keep it authentic and conversational, not salesy
- Hashtags: always include #OrThis

Return a JSON array of 3 script objects. No markdown fences.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');

    await recordTokenUsage(estimated, estimated, 'learning_content_tiktok');

    const scripts = JSON.parse(raw) as Array<{
      hook: string;
      body: string;
      cta: string;
      visualDirections: string;
      estimatedDuration: string;
      dataPoint: string;
      caption: string;
    }>;

    let created = 0;
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const slug = slugify(`tiktok-script-${period}-${i + 1}`);

      const existing = await prisma.blogDraft.findFirst({ where: { slug } });
      if (existing) continue;

      const title = `TikTok Script: "${script.hook.slice(0, 60)}"`;
      const content = `## Hook\n${script.hook}\n\n## Body\n${script.body}\n\n## CTA\n${script.cta}\n\n## Visual Directions\n${script.visualDirections}\n\n**Caption:** ${script.caption}\n\n**Duration:** ${script.estimatedDuration}\n\n**Data Point:** ${script.dataPoint}`;

      await executeOrQueue(
        'learning-content',
        'save_tiktok_script',
        'medium',
        { slug, title },
        async () => {
          await upsertBlogDraft({
            title,
            slug,
            content,
            excerpt: script.hook,
            metaDescription: `TikTok script for Or This?: ${script.hook}`,
            contentType: 'tiktok_script',
            category: 'social',
            status: 'pending_review',
            seoKeywords: ['tiktok script', 'fashion content', 'style data'],
            trendPeriod: period,
            scriptData: script as unknown as Record<string, unknown>,
          });
        },
        content,
      );
      created++;
    }

    if (created > 0) {
      console.log(`✅ [LearningContent] Queued ${created} TikTok script(s) for review`);
    }
  } catch (err) {
    console.error('[LearningContent] TikTok script generation failed:', err);
  }
}

// ─── Style Guides (one-time seed + periodic refresh) ──────────────────────────

interface StyleGuideSpec {
  slug: string;
  title: string;
  category: string;
  seoKeywords: string[];
  prompt: string;
}

function buildStyleGuideSpecs(): StyleGuideSpec[] {
  const specs: StyleGuideSpec[] = [
    // Knowledge-base guides
    {
      slug: 'color-theory-outfit-guide',
      title: 'Color Theory for Outfits: A Complete Guide',
      category: 'color-theory',
      seoKeywords: ['color theory outfits', 'outfit color combinations', 'what colors go together clothes'],
      prompt: `Knowledge base: ${JSON.stringify(COLOR_THEORY).slice(0, 3000)}`,
    },
    {
      slug: 'how-clothes-should-fit',
      title: 'How Clothes Should Fit: The Definitive Guide',
      category: 'fit-guide',
      seoKeywords: ['how should clothes fit', 'perfect clothing fit guide', 'outfit fit tips'],
      prompt: `Knowledge base: ${JSON.stringify(FIT_GUIDELINES).slice(0, 3000)}`,
    },
    // Occasion guides
    {
      slug: 'what-to-wear-to-an-interview',
      title: 'What to Wear to a Job Interview: Complete Guide',
      category: 'occasion-guide',
      seoKeywords: ['what to wear to an interview', 'job interview outfit', 'interview dress code'],
      prompt: `Occasion context: ${JSON.stringify((OCCASION_GUIDELINES as any).interview || {}).slice(0, 2000)}`,
    },
    {
      slug: 'what-to-wear-on-a-date',
      title: 'What to Wear on a Date: Outfit Ideas for Every Type',
      category: 'occasion-guide',
      seoKeywords: ['what to wear on a date', 'date night outfit ideas', 'first date outfit'],
      prompt: `Occasion context: ${JSON.stringify((OCCASION_GUIDELINES as any).dateNight || {}).slice(0, 2000)}`,
    },
    {
      slug: 'what-to-wear-to-a-wedding',
      title: 'What to Wear to a Wedding: Guest Dress Code Guide',
      category: 'occasion-guide',
      seoKeywords: ['what to wear to a wedding', 'wedding guest outfit', 'wedding dress code'],
      prompt: `Occasion context: ${JSON.stringify((OCCASION_GUIDELINES as any).wedding || {}).slice(0, 2000)}`,
    },
    {
      slug: 'work-outfit-guide',
      title: 'Work Outfit Guide: From Business Casual to Corporate',
      category: 'occasion-guide',
      seoKeywords: ['work outfit ideas', 'business casual guide', 'office outfit tips'],
      prompt: `Occasion context: ${JSON.stringify((OCCASION_GUIDELINES as any).work || {}).slice(0, 2000)}`,
    },
    {
      slug: 'elevated-casual-style-guide',
      title: 'Elevated Casual Style: How to Look Polished Without Trying Too Hard',
      category: 'occasion-guide',
      seoKeywords: ['elevated casual outfits', 'smart casual style guide', 'casual chic'],
      prompt: `Occasion context: ${JSON.stringify((OCCASION_GUIDELINES as any).casual || {}).slice(0, 2000)}`,
    },
  ];

  // Add archetype/aesthetic guides for top styles
  const topAesthetics = ['minimalist', 'classic', 'streetwear', 'bohemian', 'preppy', 'romantic', 'edgy', 'sporty'];
  for (const name of topAesthetics) {
    const aesthetic = STYLE_AESTHETICS[name];
    if (!aesthetic) continue;
    specs.push({
      slug: `${name}-style-guide`,
      title: `The ${name.charAt(0).toUpperCase() + name.slice(1)} Style Guide`,
      category: 'archetype-guide',
      seoKeywords: [`${name} style`, `${name} outfit ideas`, `${name} aesthetic fashion`],
      prompt: `Aesthetic: ${name}\nData: ${JSON.stringify(aesthetic).slice(0, 2000)}`,
    });
  }

  return specs;
}

export async function seedStyleGuides(): Promise<void> {
  const specs = buildStyleGuideSpecs();
  let queued = 0;
  let skipped = 0;

  for (const spec of specs) {
    const existing = await prisma.blogDraft.findFirst({
      where: { slug: spec.slug, status: { in: ['published', 'pending_review'] } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const estimated = 3000;
    const reserved = await reserveTokens(estimated, 'learning_content_guide');
    if (!reserved) {
      console.log('[LearningContent] Token budget exceeded — stopping style guide generation');
      break;
    }

    const fullPrompt = `You are an editorial fashion writer for "Or This?" — an AI outfit feedback app. Write an SEO-optimised style guide.

TITLE: ${spec.title}
CATEGORY: ${spec.category}
TARGET KEYWORDS: ${spec.seoKeywords.join(', ')}
${spec.prompt}

Write a comprehensive style guide (1000-1500 words). Structure:
1. Introduction (why this matters, mention Or This? AI scores this)
2. Core principles (3-4 subheadings with ## markers)
3. Common mistakes to avoid
4. Quick reference (bullet points)
5. Closing (encourage trying Or This? for personalised scoring)

Tone: editorial, authoritative, practical. Written for someone who wants actionable advice.
Format: plain text with ## for subheadings. No markdown fences. No HTML.
Include the target keywords naturally throughout.`;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { temperature: 0.5, maxOutputTokens: 3000 },
      });

      const result = await model.generateContent(fullPrompt);
      const content = result.response.text().trim();
      await recordTokenUsage(estimated, estimated, 'learning_content_guide');

      const excerpt = `${spec.title} — comprehensive guide covering what works, common mistakes, and personalised tips from Or This? AI.`;

      // High risk — queue for founder review (cornerstone SEO content)
      await executeOrQueue(
        'learning-content',
        'publish_style_guide',
        'high',
        { slug: spec.slug, title: spec.title, category: spec.category },
        async () => {
          await upsertBlogDraft({
            title: spec.title,
            slug: spec.slug,
            content,
            excerpt,
            metaDescription: `${spec.title}. Complete guide with expert tips, common mistakes, and data-backed insights from Or This? AI.`.slice(0, 155),
            contentType: 'style_guide',
            category: spec.category,
            status: 'pending_review',
            seoKeywords: spec.seoKeywords,
          });
        },
        content,
      );
      queued++;

      // Small delay between API calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[LearningContent] Failed to generate guide: ${spec.slug}`, err);
    }
  }

  console.log(`✅ [LearningContent] Style guides: ${queued} queued for review, ${skipped} skipped (already exist)`);
}

// ─── Weekly Orchestrator ───────────────────────────────────────────────────────

export async function runLearningContentAgent(): Promise<void> {
  console.log('📚 [LearningContent] Running weekly learning content agent...');

  try {
    await generateWeeklyTrendReport();
  } catch (err) {
    console.error('[LearningContent] Trend report failed:', err);
  }

  try {
    await generateStyleTips();
  } catch (err) {
    console.error('[LearningContent] Style tips failed:', err);
  }

  try {
    await generateTikTokScripts();
  } catch (err) {
    console.error('[LearningContent] TikTok scripts failed:', err);
  }

  console.log('✅ [LearningContent] Weekly content agent complete');
}
