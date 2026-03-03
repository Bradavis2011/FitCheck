/**
 * Style Journal Service — Personalized editorial articles from wardrobe + StyleDNA
 * Article types: wardrobe_snapshot | color_story | capsule_builder | monthly_report | occasion_playbook
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { reserveTokens, recordTokenUsage } from './token-budget.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export type ArticleType =
  | 'wardrobe_snapshot'
  | 'color_story'
  | 'capsule_builder'
  | 'monthly_report'
  | 'occasion_playbook';

const ALL_TYPES: ArticleType[] = [
  'wardrobe_snapshot',
  'color_story',
  'capsule_builder',
  'monthly_report',
  'occasion_playbook',
];

interface ArticleConfig {
  title: (month?: string) => string;
  previewDescription: string;
  stalenessDays: number;
  dataThreshold: (data: ThresholdData) => { met: boolean; message: string };
}

interface ThresholdData {
  wardrobeItemCount: number;
  outfitCheckCount: number;
  monthlyCheckCount: number;
  coloredItemCount: number;
}

const ARTICLE_CONFIGS: Record<ArticleType, ArticleConfig> = {
  wardrobe_snapshot: {
    title: () => 'Your Closet at a Glance',
    previewDescription:
      'A personalized analysis of your wardrobe\'s color palette, category breakdown, most-worn pieces, and seasonal gaps.',
    stalenessDays: 7,
    dataThreshold: (d) => ({
      met: d.wardrobeItemCount >= 5,
      message: `Add ${Math.max(0, 5 - d.wardrobeItemCount)} more item${5 - d.wardrobeItemCount !== 1 ? 's' : ''} to unlock`,
    }),
  },
  color_story: {
    title: () => 'Your Color Story',
    previewDescription:
      'Your best-performing colors, color season alignment, wardrobe color distribution, and personalized recommendations on what to add.',
    stalenessDays: 14,
    dataThreshold: (d) => ({
      met: d.outfitCheckCount >= 3 || d.coloredItemCount >= 8,
      message: d.outfitCheckCount < 3
        ? `Complete ${Math.max(0, 3 - d.outfitCheckCount)} more outfit check${3 - d.outfitCheckCount !== 1 ? 's' : ''} to unlock`
        : `Add ${Math.max(0, 8 - d.coloredItemCount)} more colored items to unlock`,
    }),
  },
  capsule_builder: {
    title: () => 'Your Essential Capsule',
    previewDescription:
      'Your core wardrobe pieces, redundancies to reconsider, missing gaps to fill, and outfit formulas built from your actual items.',
    stalenessDays: 14,
    dataThreshold: (d) => ({
      met: d.wardrobeItemCount >= 10,
      message: `Add ${Math.max(0, 10 - d.wardrobeItemCount)} more item${10 - d.wardrobeItemCount !== 1 ? 's' : ''} to unlock`,
    }),
  },
  monthly_report: {
    title: () => {
      const now = new Date();
      return `Your ${now.toLocaleString('default', { month: 'long' })} Style Report`;
    },
    previewDescription:
      'Score trends, best looks, archetype shifts, sub-score analysis, and personalized goals for next month.',
    stalenessDays: 30,
    dataThreshold: (d) => ({
      met: d.monthlyCheckCount >= 5,
      message: `Complete ${Math.max(0, 5 - d.monthlyCheckCount)} more outfit check${5 - d.monthlyCheckCount !== 1 ? 's' : ''} this month to unlock`,
    }),
  },
  occasion_playbook: {
    title: () => 'Your Occasion Playbook',
    previewDescription:
      'Outfit formulas for your top 3 occasions, built from your actual wardrobe items with AI-powered styling direction.',
    stalenessDays: 14,
    dataThreshold: (d) => ({
      met: d.wardrobeItemCount >= 5 && d.outfitCheckCount >= 3,
      message: d.wardrobeItemCount < 5
        ? `Add ${Math.max(0, 5 - d.wardrobeItemCount)} more item${5 - d.wardrobeItemCount !== 1 ? 's' : ''} to unlock`
        : `Complete ${Math.max(0, 3 - d.outfitCheckCount)} more outfit check${3 - d.outfitCheckCount !== 1 ? 's' : ''} to unlock`,
    }),
  },
};

export interface StyleArticleOverviewItem {
  type: ArticleType;
  title: string;
  previewDescription: string;
  dataThresholdMet: boolean;
  dataThresholdMessage: string;
  hasArticle: boolean;
  isStale: boolean;
  generatedAt: string | null;
}

function isStale(validUntil: Date): boolean {
  return new Date() > validUntil;
}

async function getThresholdData(userId: string): Promise<ThresholdData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [wardrobeItemCount, outfitCheckCount, monthlyCheckCount, coloredItemCount] =
    await Promise.all([
      prisma.wardrobeItem.count({ where: { userId } }),
      prisma.outfitCheck.count({ where: { userId, isDeleted: false } }),
      prisma.outfitCheck.count({
        where: { userId, isDeleted: false, createdAt: { gte: startOfMonth } },
      }),
      prisma.wardrobeItem.count({
        where: { userId, color: { not: null } },
      }),
    ]);

  return { wardrobeItemCount, outfitCheckCount, monthlyCheckCount, coloredItemCount };
}

// GET /api/style-journal — overview for all tiers
export async function getJournalOverview(userId: string): Promise<StyleArticleOverviewItem[]> {
  const [thresholdData, existingArticles] = await Promise.all([
    getThresholdData(userId),
    prisma.styleArticle.findMany({ where: { userId } }),
  ]);

  const articleMap = new Map(existingArticles.map((a) => [a.articleType, a]));

  return ALL_TYPES.map((type) => {
    const config = ARTICLE_CONFIGS[type];
    const { met, message } = config.dataThreshold(thresholdData);
    const existing = articleMap.get(type);

    return {
      type,
      title: config.title(),
      previewDescription: config.previewDescription,
      dataThresholdMet: met,
      dataThresholdMessage: met ? '' : message,
      hasArticle: !!existing,
      isStale: existing ? isStale(existing.validUntil) : true,
      generatedAt: existing ? existing.generatedAt.toISOString() : null,
    };
  });
}

// GET /api/style-journal/:type — full article (paid only — controller checks tier)
export async function getArticle(userId: string, type: ArticleType) {
  const article = await prisma.styleArticle.findUnique({
    where: { userId_articleType: { userId, articleType: type } },
  });
  return article;
}

// POST /api/style-journal/:type/generate — paid tier only
export async function generateArticle(userId: string, type: ArticleType) {
  if (!ALL_TYPES.includes(type)) throw new Error(`Unknown article type: ${type}`);

  // Check data threshold
  const thresholdData = await getThresholdData(userId);
  const config = ARTICLE_CONFIGS[type];
  const { met, message } = config.dataThreshold(thresholdData);
  if (!met) {
    const err: any = new Error(message);
    err.status = 403;
    throw err;
  }

  // Check daily generation limit (5 per user per day)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await prisma.styleArticle.count({
    where: { userId, updatedAt: { gte: startOfDay } },
  });
  if (todayCount >= 5) {
    const err: any = new Error('Daily article generation limit reached (5/day). Try again tomorrow.');
    err.status = 429;
    throw err;
  }

  // Token budget
  const tokenReserved = await reserveTokens(4000, 'style-journal');
  if (!tokenReserved) {
    const err: any = new Error('Token budget exhausted. Try again later.');
    err.status = 429;
    throw err;
  }

  let inputHash: string;
  let content: string;
  let data: Record<string, unknown>;
  let tokensUsed = 0;

  try {
    const result = await generateArticleContent(userId, type);
    content = result.content;
    data = result.data;
    inputHash = result.inputHash;
    tokensUsed = result.tokensUsed;
  } finally {
    await recordTokenUsage(4000, tokensUsed, 'style-journal');
  }

  const staleDays = config.stalenessDays;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + staleDays);

  const article = await prisma.styleArticle.upsert({
    where: { userId_articleType: { userId, articleType: type } },
    create: {
      userId,
      articleType: type,
      title: config.title(),
      content,
      data: data as any,
      version: 1,
      validUntil,
      inputHash,
    },
    update: {
      title: config.title(),
      content,
      data: data as any,
      version: { increment: 1 },
      generatedAt: new Date(),
      validUntil,
      inputHash,
    },
  });

  return article;
}

async function generateArticleContent(
  userId: string,
  type: ArticleType
): Promise<{ content: string; data: Record<string, unknown>; inputHash: string; tokensUsed: number }> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  });

  let prompt: string;
  let rawInputData: Record<string, unknown>;

  switch (type) {
    case 'wardrobe_snapshot':
      ({ prompt, rawInputData } = await buildWardrobeSnapshotPrompt(userId));
      break;
    case 'color_story':
      ({ prompt, rawInputData } = await buildColorStoryPrompt(userId));
      break;
    case 'capsule_builder':
      ({ prompt, rawInputData } = await buildCapsuleBuilderPrompt(userId));
      break;
    case 'monthly_report':
      ({ prompt, rawInputData } = await buildMonthlyReportPrompt(userId));
      break;
    case 'occasion_playbook':
      ({ prompt, rawInputData } = await buildOccasionPlaybookPrompt(userId));
      break;
  }

  const inputHash = createHash('sha256')
    .update(JSON.stringify(rawInputData))
    .digest('hex')
    .slice(0, 16);

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 1500;

  // Split on ---JSON--- delimiter
  const delimiterIdx = text.indexOf('---JSON---');
  let content: string;
  let data: Record<string, unknown> = {};

  if (delimiterIdx !== -1) {
    content = text.slice(0, delimiterIdx).trim();
    try {
      const jsonStr = text.slice(delimiterIdx + 10).trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) data = JSON.parse(jsonMatch[0]);
    } catch {
      // data stays empty — content still useful
    }
  } else {
    content = text;
  }

  return { content, data, inputHash, tokensUsed };
}

// ── Per-type data gathering + prompt builders ──────────────────────────────

async function buildWardrobeSnapshotPrompt(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, colorSeason: true },
  });

  const items = await prisma.wardrobeItem.findMany({
    where: { userId },
    orderBy: { timesWorn: 'desc' },
  });

  const styleDNA = await prisma.styleDNA.findFirst({
    where: { outfitCheck: { userId, isDeleted: false } },
    orderBy: { createdAt: 'desc' },
    select: { dominantColors: true, styleArchetypes: true },
  });

  // Aggregate by category
  const byCategory: Record<string, string[]> = {};
  for (const item of items) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(`${item.name}${item.color ? ` (${item.color})` : ''}`);
  }

  const topWorn = items.slice(0, 5).map((i) => `${i.name} — worn ${i.timesWorn}x`);
  const neglected = items
    .filter((i) => i.timesWorn === 0)
    .slice(0, 5)
    .map((i) => i.name);

  const rawInputData = { items: items.map((i) => i.id), colorSeason: user?.colorSeason };

  const prompt = `You are the AI fashion editor at Or This?, writing in the voice of the Vogue editorial desk.
Write a personalized "Closet at a Glance" article for ${user?.name ?? 'this user'}.

WARDROBE DATA:
${Object.entries(byCategory)
  .map(([cat, names]) => `${cat.toUpperCase()} (${names.length}): ${names.slice(0, 8).join(', ')}`)
  .join('\n')}

MOST WORN: ${topWorn.join(', ')}
${neglected.length > 0 ? `UNWORN PIECES: ${neglected.join(', ')}` : ''}
COLOR SEASON: ${user?.colorSeason ?? 'unknown'}
AI COLOR PROFILE: ${styleDNA?.dominantColors?.slice(0, 5).join(', ') ?? 'not yet analyzed'}
STYLE ARCHETYPES: ${styleDNA?.styleArchetypes?.slice(0, 3).join(', ') ?? 'not yet analyzed'}

Write 3-4 paragraphs in editorial voice addressing "you". Reference actual piece names. Be specific, decisive, and actionable.
End with 2-3 "Closet Edit" recommendations — what to add, what to reconsider, what to lean into.

After the article, output a line with exactly "---JSON---" then a JSON object:
{
  "categoryBreakdown": { "tops": N, "bottoms": N, ... },
  "topWorn": ["item name", ...],
  "neglected": ["item name", ...],
  "colorSeason": "...",
  "topColors": ["color", ...]
}`;

  return { prompt, rawInputData };
}

async function buildColorStoryPrompt(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, colorSeason: true },
  });

  const styleDNAEntries = await prisma.styleDNA.findMany({
    where: { outfitCheck: { userId, isDeleted: false } },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      dominantColors: true,
      colorHarmony: true,
      outfitCheck: { select: { aiScore: true, feedbackRating: true } },
    },
  });

  // Color frequency + average score
  const colorScores: Record<string, { total: number; count: number }> = {};
  for (const dna of styleDNAEntries) {
    const score = dna.outfitCheck.aiScore ?? 6;
    for (const color of dna.dominantColors ?? []) {
      if (!colorScores[color]) colorScores[color] = { total: 0, count: 0 };
      colorScores[color].total += score;
      colorScores[color].count++;
    }
  }
  const topColors = Object.entries(colorScores)
    .map(([color, { total, count }]) => ({ color, avgScore: total / count, count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8);

  const wardrobeColors = await prisma.wardrobeItem.findMany({
    where: { userId, color: { not: null } },
    select: { color: true, name: true },
  });
  const wardrobeColorDist: Record<string, number> = {};
  for (const item of wardrobeColors) {
    if (item.color) wardrobeColorDist[item.color] = (wardrobeColorDist[item.color] ?? 0) + 1;
  }

  const rawInputData = { colorSeason: user?.colorSeason, colorScoreCount: Object.keys(colorScores).length };

  const prompt = `You are the AI fashion editor at Or This?, writing in the voice of the Vogue editorial desk.
Write a personalized "Color Story" article for ${user?.name ?? 'this user'}.

COLOR SEASON: ${user?.colorSeason ?? 'not set'}
TOP PERFORMING COLORS (by AI score):
${topColors.map((c) => `  ${c.color}: avg score ${c.avgScore.toFixed(1)}/10 across ${c.count} outfit${c.count !== 1 ? 's' : ''}`).join('\n')}

WARDROBE COLOR DISTRIBUTION:
${Object.entries(wardrobeColorDist)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([color, count]) => `  ${color}: ${count} item${count !== 1 ? 's' : ''}`)
  .join('\n')}

COMMON COLOR HARMONIES: ${[...new Set(styleDNAEntries.map((d) => d.colorHarmony).filter(Boolean))].join(', ') || 'varied'}

Write 3-4 paragraphs analyzing this user's color language. Reference their color season, best-performing colors, wardrobe distribution. Give concrete advice on what to add or avoid. Editorial voice — decisive, specific, no hedging.

After the article, output a line with exactly "---JSON---" then a JSON object:
{
  "colorSeason": "...",
  "topPerformingColors": [{ "color": "...", "avgScore": N }],
  "wardrobeColors": { "color": N, ... },
  "recommendation": "one sentence on what color direction to pursue"
}`;

  return { prompt, rawInputData };
}

async function buildCapsuleBuilderPrompt(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, lifestyle: true, fashionGoals: true, fitPreference: true },
  });

  const items = await prisma.wardrobeItem.findMany({ where: { userId }, orderBy: { timesWorn: 'desc' } });

  const styleDNA = await prisma.styleDNA.findFirst({
    where: { outfitCheck: { userId, isDeleted: false } },
    orderBy: { createdAt: 'desc' },
    select: { styleArchetypes: true, formalityLevel: true },
  });

  const outfitChecks = await prisma.outfitCheck.findMany({
    where: { userId, isDeleted: false },
    select: { occasions: true },
    take: 30,
  });
  const occasionCounts: Record<string, number> = {};
  for (const oc of outfitChecks) {
    for (const occ of oc.occasions) {
      occasionCounts[occ] = (occasionCounts[occ] ?? 0) + 1;
    }
  }
  const topOccasions = Object.entries(occasionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([occ]) => occ);

  const rawInputData = { itemCount: items.length, topOccasions };

  const itemList = items
    .map((i) => `- ${i.name} (${i.category}${i.color ? `, ${i.color}` : ''}) — worn ${i.timesWorn}x`)
    .join('\n');

  const prompt = `You are the AI fashion editor at Or This?, writing in the voice of the Vogue editorial desk.
Write a personalized "Essential Capsule" article for ${user?.name ?? 'this user'}.

FULL WARDROBE:
${itemList}

TOP OCCASIONS: ${topOccasions.join(', ') || 'general/everyday'}
STYLE ARCHETYPES: ${styleDNA?.styleArchetypes?.slice(0, 3).join(', ') ?? 'not analyzed'}
FORMALITY LEVEL (1-10): ${styleDNA?.formalityLevel ?? 'unknown'}
LIFESTYLE: ${user?.lifestyle?.join(', ') ?? 'not set'}
FIT PREFERENCE: ${user?.fitPreference ?? 'not set'}
FASHION GOALS: ${user?.fashionGoals?.join(', ') ?? 'not set'}

Write 4-5 paragraphs covering: core pieces that are working hard, redundancies to reconsider, clear gaps, and 2-3 specific outfit formulas using actual piece names. Editorial voice — decisive, Vogue-desk authority.

After the article, output a line with exactly "---JSON---" then a JSON object:
{
  "coreHeroPieces": ["item name", ...],
  "redundancies": ["item name", ...],
  "gaps": ["what to add", ...],
  "outfitFormulas": [{ "name": "...", "pieces": ["..."] }]
}`;

  return { prompt, rawInputData };
}

async function buildMonthlyReportPrompt(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const [thisMonthChecks, lastMonthChecks, milestones, narrative] = await Promise.all([
    prisma.outfitCheck.findMany({
      where: { userId, isDeleted: false, createdAt: { gte: startOfMonth } },
      select: {
        aiScore: true,
        occasions: true,
        createdAt: true,
        styleDNA: { select: { styleArchetypes: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.outfitCheck.findMany({
      where: {
        userId,
        isDeleted: false,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      select: { aiScore: true },
    }),
    prisma.milestoneMessage.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
      select: { milestoneKey: true },
    }),
    prisma.styleNarrative.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { narrative: true },
    }),
  ]);

  const thisMonthScores = thisMonthChecks.map((c) => c.aiScore ?? 0).filter((s) => s > 0);
  const avgScore = thisMonthScores.length
    ? thisMonthScores.reduce((a, b) => a + b, 0) / thisMonthScores.length
    : 0;
  const lastMonthScores = lastMonthChecks.map((c) => c.aiScore ?? 0).filter((s) => s > 0);
  const lastMonthAvg = lastMonthScores.length
    ? lastMonthScores.reduce((a, b) => a + b, 0) / lastMonthScores.length
    : 0;

  const archetypes: Record<string, number> = {};
  for (const c of thisMonthChecks) {
    for (const arch of c.styleDNA?.styleArchetypes ?? []) {
      archetypes[arch] = (archetypes[arch] ?? 0) + 1;
    }
  }
  const topArchetype = Object.entries(archetypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([a]) => a)
    .join(', ');

  const month = now.toLocaleString('default', { month: 'long' });
  const rawInputData = { checkCount: thisMonthChecks.length, avgScore, month };

  const prompt = `You are the AI fashion editor at Or This?, writing in the voice of the Vogue editorial desk.
Write a personalized "${month} Style Report" for ${user?.name ?? 'this user'}.

THIS MONTH'S STATS:
- Outfit checks: ${thisMonthChecks.length}
- Average AI score: ${avgScore.toFixed(1)}/10
- Previous month average: ${lastMonthAvg.toFixed(1)}/10
- Score trend: ${avgScore > lastMonthAvg ? `+${(avgScore - lastMonthAvg).toFixed(1)} (improving)` : avgScore < lastMonthAvg ? `${(avgScore - lastMonthAvg).toFixed(1)} (declining)` : 'steady'}
- Top style archetypes this month: ${topArchetype || 'varied'}
- Milestones reached: ${milestones.map((m) => m.milestoneKey).join(', ') || 'none'}
${narrative ? `- AI Style Observation: "${narrative.narrative}"` : ''}

Write 4 paragraphs: opening reflection on this month's style, score trend analysis, archetype evolution, goals for next month. Be editorial, direct, and motivating without being generic. Reference the actual numbers.

After the article, output a line with exactly "---JSON---" then a JSON object:
{
  "checkCount": N,
  "avgScore": N,
  "lastMonthAvg": N,
  "topArchetype": "...",
  "milestones": ["..."],
  "nextMonthGoal": "one specific goal"
}`;

  return { prompt, rawInputData };
}

async function buildOccasionPlaybookPrompt(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const items = await prisma.wardrobeItem.findMany({ where: { userId } });

  const outfitChecks = await prisma.outfitCheck.findMany({
    where: { userId, isDeleted: false },
    select: { occasions: true, aiScore: true, styleDNA: { select: { garments: true, styleArchetypes: true } } },
    take: 50,
  });

  // Top 3 occasions
  const occasionCounts: Record<string, number> = {};
  for (const oc of outfitChecks) {
    for (const occ of oc.occasions) {
      occasionCounts[occ] = (occasionCounts[occ] ?? 0) + 1;
    }
  }
  const topOccasions = Object.entries(occasionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([occ]) => occ);

  const itemList = items
    .map((i) => `${i.name} (${i.category}${i.color ? `, ${i.color}` : ''})`)
    .join(', ');

  const rawInputData = { topOccasions, itemCount: items.length };

  const prompt = `You are the AI fashion editor at Or This?, writing in the voice of the Vogue editorial desk.
Write a personalized "Occasion Playbook" article for ${user?.name ?? 'this user'}.

TOP 3 OCCASIONS: ${topOccasions.join(', ') || 'everyday, casual, work'}

WARDROBE ITEMS:
${itemList}

For each occasion, write:
1. One paragraph of editorial guidance on what the right look looks like for this user
2. A specific outfit formula using 2-4 actual pieces from their wardrobe (by exact name)
3. One power move or styling tip

Structure the article with clear sections per occasion. Editorial voice throughout.

After the article, output a line with exactly "---JSON---" then a JSON object:
{
  "occasions": [
    {
      "name": "...",
      "formula": ["item name", ...],
      "powerMove": "..."
    }
  ]
}`;

  return { prompt, rawInputData };
}
