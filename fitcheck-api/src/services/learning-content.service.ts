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

// ─── Series Topic Pool ────────────────────────────────────────────────────────

interface SeriesDef {
  id: string;
  title: string;
  category: string;
  episodes: string[];
}

const SERIES_POOL: SeriesDef[] = [
  // Culture & Identity
  { id: 'style-identity', title: 'Your Style, Your Identity', category: 'Culture & Identity',
    episodes: ['What Is Personal Style Really?', 'How Childhood Shapes What You Wear', 'Style as Self-Expression vs. Social Signaling', 'Finding Your Signature Look'] },
  { id: 'dress-codes-decoded', title: 'Dress Codes Decoded', category: 'Culture & Identity',
    episodes: ['Black Tie vs. Cocktail — The Real Difference', 'Business Casual: The Vague Rule Explained', 'Smart Casual Done Right', "When Dress Codes Don't Apply"] },
  { id: 'fashion-archetypes', title: 'Fashion Archetypes Explained', category: 'Culture & Identity',
    episodes: ['The Classic Archetype', 'The Minimalist Archetype', 'The Trendsetter Archetype', 'The Creative Archetype', "Mixed Archetypes: When You're a Blend"] },
  { id: 'color-psychology', title: 'Color Psychology in Fashion', category: 'Culture & Identity',
    episodes: ['Why Red Commands Attention', 'The Power of Neutral Palettes', 'Color Seasons Explained Simply', 'Building Outfits Around Color Harmony'] },
  // Data-Driven Style
  { id: 'outfit-score-factors', title: 'What Our AI Scores Look For', category: 'Data-Driven Style',
    episodes: ['The #1 Factor That Moves Your Score', 'How Occasion Fit Is Scored', 'Color Harmony by the Numbers', 'Why Proportion Matters More Than Brand'] },
  { id: 'occasion-by-numbers', title: 'Occasion Dressing by the Numbers', category: 'Data-Driven Style',
    episodes: ['What Scores Highest for Interviews', 'Date Night: What Actually Works', 'Casual Outfits That Score 8+', 'Event Dressing Patterns from 10K Checks'] },
  { id: 'fit-data', title: 'Why Fit Wins Every Time (Data)', category: 'Data-Driven Style',
    episodes: ['Fit vs. Brand: Our Data', 'How Proportion Affects Perception', 'Tailoring Impact on Scores', 'The Best-Fitting Items by Category'] },
  { id: 'archetype-performance', title: 'Style Archetypes & Score Patterns', category: 'Data-Driven Style',
    episodes: ['Which Archetypes Score Highest', 'Minimalist vs. Maximalist: Score Breakdown', 'The Hidden Strengths of Classic Style', 'How Mixed Archetypes Perform'] },
  // Practical Guides
  { id: 'capsule-wardrobe', title: 'Building Your Capsule Wardrobe', category: 'Practical Guides',
    episodes: ['What a Capsule Wardrobe Actually Is', 'The 10 Pieces Everyone Needs', 'Building Around a Color Palette', 'Capsule for Different Lifestyles'] },
  { id: 'seasonal-dressing', title: 'Seasonal Dressing Done Right', category: 'Practical Guides',
    episodes: ['Spring Transition Outfits That Work', 'Summer Dressing Without Sacrificing Style', 'Fall Layering the Right Way', 'Winter Outfits That Still Look Good'] },
  { id: 'budget-style', title: 'Style on Any Budget', category: 'Practical Guides',
    episodes: ['Where to Spend vs. Save', 'The Best Investment Pieces Under $100', 'Thrift Shopping Strategy', 'Cost-Per-Wear Thinking'] },
  { id: 'body-dressing', title: 'Dressing for Your Body Type', category: 'Practical Guides',
    episodes: ["Why Body Type Isn't a Limit", 'Proportion Tricks That Work for Everyone', "What Silhouettes Say About Your Shape", 'Breaking the Rules Intentionally'] },
  // Industry Commentary
  { id: 'fast-vs-investment', title: 'Fast Fashion vs. Investment Pieces', category: 'Industry Commentary',
    episodes: ['The Real Cost of Fast Fashion', 'When to Invest and When to Save', 'Brands Worth the Price Tag', 'Building a Wardrobe That Lasts'] },
  { id: 'social-media-style', title: 'How Social Media Changed Style', category: 'Industry Commentary',
    episodes: ['The Trend Cycle Is Now 3 Months', 'Algorithm Fashion: Is It Real?', 'De-influencing: The Counter-Movement', 'Finding Your Style Outside the Feed'] },
  { id: 'ai-and-fashion', title: 'AI and the Future of Fashion', category: 'Industry Commentary',
    episodes: ['How AI Scores Your Outfit', 'The Future of Personal Styling', 'AI vs. Human Stylists: Who Wins?', 'What Data-Driven Fashion Looks Like'] },
  { id: 'sustainable-practice', title: 'Sustainable Style in Practice', category: 'Industry Commentary',
    episodes: ['Beyond the Eco Label', 'Secondhand Styling That Works', 'Brands Doing It Right', 'The Sustainable Capsule Wardrobe'] },
];

interface SeriesPosition {
  seriesIndex: number;
  episodeNumber: number; // 1-based
}

/** Determine the next series/episode to generate, offset by `advance` additional steps. */
async function getNextSeriesPosition(advance = 0): Promise<SeriesPosition> {
  // Find the last generated series episode in chronological order
  const lastEpisodes = await prisma.blogDraft.findMany({
    where: { contentType: 'series_episode' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  let baseSeriesIndex = 0;
  let baseEpisodeNumber = 0;

  for (const ep of lastEpisodes) {
    const data = ep.scriptData as Record<string, unknown> | null;
    const seriesInfo = data?.seriesInfo as { seriesId?: string; episodeNumber?: number } | undefined;
    if (seriesInfo?.seriesId && typeof seriesInfo.episodeNumber === 'number') {
      const idx = SERIES_POOL.findIndex(s => s.id === seriesInfo.seriesId);
      if (idx !== -1) {
        baseSeriesIndex = idx;
        baseEpisodeNumber = seriesInfo.episodeNumber;
        break;
      }
    }
  }

  // Advance from base position by `advance` steps
  let seriesIndex = baseSeriesIndex;
  let episodeNumber = baseEpisodeNumber + 1 + advance;

  while (episodeNumber > SERIES_POOL[seriesIndex].episodes.length) {
    episodeNumber -= SERIES_POOL[seriesIndex].episodes.length;
    seriesIndex = (seriesIndex + 1) % SERIES_POOL.length;
  }

  return { seriesIndex, episodeNumber };
}

// ─── Content Factory: Daily Scripts ──────────────────────────────────────────

export async function generateDailyScripts(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Dedup: skip if any factory scripts already exist for today
  const existingToday = await prisma.blogDraft.findFirst({
    where: {
      contentType: { in: ['series_episode', 'data_drop', 'trend_take'] },
      trendPeriod: today,
    },
  });
  if (existingToday) {
    console.log(`[ContentFactory] Scripts already generated for ${today} — skipping`);
    return;
  }

  const estimated = 8000;
  const reserved = await reserveTokens(estimated, 'content_factory');
  if (!reserved) {
    console.log('[ContentFactory] Token budget exceeded — skipping daily scripts');
    return;
  }

  // Fetch data for content generation
  const [trend, topRules, calibration, pos1, pos2] = await Promise.all([
    prisma.fashionTrend.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.discoveredRule.findMany({
      where: { confidence: { gte: 0.65 } },
      orderBy: { confidence: 'desc' },
      take: 5,
    }),
    prisma.calibrationSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
    getNextSeriesPosition(0),
    getNextSeriesPosition(1),
  ]);

  const trendContext = trend
    ? `Current trending styles: ${trend.trendingStyles.slice(0, 3).join(', ')}. Key pieces: ${trend.keyPieces.slice(0, 3).join(', ')}. Colors: ${trend.seasonalColors.slice(0, 3).join(', ')}.`
    : 'No trend data available — use general fashion principles.';

  const topRule = topRules[0];
  const rulesContext = topRules.length > 0
    ? topRules.slice(0, 3).map(r => `"${r.rule}" — ${Math.round(r.confidence * 100)}% confidence, n=${r.sampleSize}`).join('\n')
    : 'No rule data yet.';

  const calibrationNote = calibration
    ? `AI averages ${calibration.avgAiScore.toFixed(1)}/10 vs community ${calibration.avgCommunity.toFixed(1)}/10 across ${calibration.sampleSize} outfits.`
    : '';

  const series1 = SERIES_POOL[pos1.seriesIndex];
  const series2 = SERIES_POOL[pos2.seriesIndex];
  const ep1Title = series1.episodes[pos1.episodeNumber - 1] || series1.episodes[0];
  const ep2Title = series2.episodes[pos2.episodeNumber - 1] || series2.episodes[0];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.75, maxOutputTokens: 8192 },
  });

  const scriptPrompt = `You are the content strategist for "Or This?" — an AI outfit scoring app (orthis.app) that has scored 10,000+ outfits. Generate 5 production-ready short video scripts (45–90 seconds each) for TikTok/Reels.

TODAY'S DATA:
${trendContext}
${calibrationNote}

TOP DATA-BACKED STYLE RULES:
${rulesContext}

Generate exactly 5 scripts in this JSON format (array of 5):
[
  {
    "scriptType": "series_episode",
    "title": "<episode title>",
    "seriesInfo": { "seriesId": "<series id>", "seriesTitle": "<series title>", "episodeNumber": <n>, "episodeCount": <total episodes in series> },
    "totalDuration": "60s",
    "coldOpen": { "duration": "5s", "exactWords": "<exact words to say>", "cameraDirection": "<what to show on camera>" },
    "sections": [
      { "label": "<section name>", "duration": "20s", "exactWords": "<exact words>", "cameraDirection": "<camera>", "bRollSuggestion": "<optional>", "textOverlay": "<optional>", "dataPoint": "<optional stat>" }
    ],
    "callToAction": { "duration": "10s", "exactWords": "<exact words>", "cameraDirection": "<camera direction>" },
    "teleprompterText": "<full script as one flowing paragraph for reading>",
    "caption": "<social caption with line breaks>",
    "hashtags": ["#OrThis", "<2-4 more relevant hashtags>"],
    "filmingStatus": "ready"
  }
]

SCRIPTS TO GENERATE:
1. Series episode: "${series1.title}" — Episode ${pos1.episodeNumber}: "${ep1Title}" (series has ${series1.episodes.length} episodes, category: ${series1.category})
2. Series episode: "${series2.title}" — Episode ${pos2.episodeNumber}: "${ep2Title}" (series has ${series2.episodes.length} episodes, category: ${series2.category})
3. Data drop: One surprising stat from our outfit scoring data. Use the top rule: ${topRule ? `"${topRule.rule}" (${Math.round((topRule?.confidence || 0) * 100)}% confidence, n=${topRule?.sampleSize})` : 'best performing outfit pattern'}
4. Trend take: Hot take on current fashion trend — ${trend?.trendingStyles[0] || 'current fashion'} — with a counterintuitive Or This? angle
5. Style tip: Actionable, specific tip from our data. Use rule: ${topRules[1] ? `"${topRules[1].rule}"` : topRules[0] ? `"${topRules[0].rule}"` : 'fit matters most'}

RULES:
- Cold opens MUST stop the scroll — be bold, specific, counterintuitive
- Use exact numbers from our data wherever possible ("73% of outfits scored above 8 had...")
- Scripts should feel like a real person talking to camera, not a corporate voice
- Each section exactWords should be word-for-word what the creator says
- teleprompterText = all spoken words concatenated, reading-friendly
- Keep individual sections 10-25 seconds of speaking content
- Always reference "Or This?" naturally in the CTA

Return ONLY the JSON array. No markdown fences, no explanatory text.`;

  try {
    const result = await model.generateContent(scriptPrompt);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');

    await recordTokenUsage(estimated, estimated, 'content_factory');

    const scripts = JSON.parse(raw) as Array<Record<string, unknown>>;

    if (!Array.isArray(scripts) || scripts.length === 0) {
      console.error('[ContentFactory] Gemini returned empty or non-array response');
      return;
    }

    let created = 0;

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const scriptType = String(script.scriptType || 'style_tip');
      const title = String(script.title || `Script ${i + 1}`);

      let slug: string;
      if (scriptType === 'series_episode') {
        const si = script.seriesInfo as { seriesId?: string } | undefined;
        const sid = si?.seriesId ? String(si.seriesId) : `series-${i}`;
        const epNum = (script.seriesInfo as { episodeNumber?: number } | undefined)?.episodeNumber ?? i + 1;
        slug = slugify(`cf-series-${sid}-ep${epNum}-${today}`);
      } else {
        slug = slugify(`cf-${scriptType}-${today}`);
      }

      const existing = await prisma.blogDraft.findFirst({ where: { slug } });
      if (existing) {
        console.log(`[ContentFactory] Script already exists for slug ${slug} — skipping`);
        continue;
      }

      const coldOpenWords = (script.coldOpen as { exactWords?: string } | undefined)?.exactWords || '';
      const excerpt = coldOpenWords.slice(0, 200);
      const content = buildScriptMarkdown(script);

      await executeOrQueue(
        'content-factory',
        `save_${scriptType}`,
        'low',
        { slug, title, scriptType, today },
        async () => {
          await upsertBlogDraft({
            title,
            slug,
            content,
            excerpt,
            metaDescription: `${title} — Or This? video script for ${today}`.slice(0, 155),
            contentType: scriptType,
            category: (script.seriesInfo as { category?: string } | undefined)?.category || 'social',
            status: 'pending_review',
            seoKeywords: ['fashion content', 'style video script', 'orthis'],
            trendPeriod: today,
            scriptData: script,
          });
        },
      );
      created++;
    }

    console.log(`✅ [ContentFactory] Generated ${created} script(s) for ${today}`);
  } catch (err) {
    console.error('[ContentFactory] Daily script generation failed:', err);
  }
}

function buildScriptMarkdown(script: Record<string, unknown>): string {
  const cold = script.coldOpen as { exactWords?: string; cameraDirection?: string; duration?: string } | undefined;
  const cta = script.callToAction as { exactWords?: string; cameraDirection?: string; duration?: string } | undefined;
  const sections = script.sections as Array<{ label?: string; duration?: string; exactWords?: string; cameraDirection?: string; bRollSuggestion?: string; textOverlay?: string; dataPoint?: string }> | undefined;

  const sectionMd = (sections || []).map(s =>
    `### ${s.label || 'Section'} (${s.duration || ''})\n${s.exactWords || ''}\n*Camera: ${s.cameraDirection || ''}*${s.dataPoint ? `\n**Data:** ${s.dataPoint}` : ''}${s.bRollSuggestion ? `\n*B-roll: ${s.bRollSuggestion}*` : ''}`,
  ).join('\n\n');

  return [
    `## Cold Open (${cold?.duration || '5s'})`,
    cold?.exactWords || '',
    `*Camera: ${cold?.cameraDirection || ''}*`,
    '',
    sectionMd,
    '',
    `## Call to Action (${cta?.duration || '10s'})`,
    cta?.exactWords || '',
    `*Camera: ${cta?.cameraDirection || ''}*`,
    '',
    `**Caption:** ${String(script.caption || '')}`,
    `**Hashtags:** ${(script.hashtags as string[] | undefined || []).join(' ')}`,
    `**Total Duration:** ${String(script.totalDuration || '')}`,
  ].join('\n');
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

// ─── Daily Orchestrator ───────────────────────────────────────────────────────

export async function runLearningContentAgent(): Promise<void> {
  console.log('🎬 [ContentFactory] Running daily content factory...');

  // Daily: 5 production scripts
  try {
    await generateDailyScripts();
  } catch (err) {
    console.error('[ContentFactory] Daily scripts failed:', err);
  }

  // Weekly: trend report (Tuesdays only — day 2 UTC)
  const dayOfWeek = new Date().getUTCDay();
  if (dayOfWeek === 2) {
    try {
      await generateWeeklyTrendReport();
    } catch (err) {
      console.error('[ContentFactory] Weekly trend report failed:', err);
    }
  }

  console.log('✅ [ContentFactory] Daily content factory complete');
}
