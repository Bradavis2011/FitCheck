import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { getTrendData } from './content-calendar.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getWeekPeriod(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

function getSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month <= 2) return 'Winter';
  if (month <= 5) return 'Spring';
  if (month <= 8) return 'Summer';
  return 'Fall';
}

// Returns the latest trend record formatted for prompt injection, or null if none exists
// Filters out Gemini-claimed trends that diverge from platform StyleDNA data (A3)
export async function getLatestFashionTrendText(): Promise<string | null> {
  try {
    const trend = await prisma.fashionTrend.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!trend) return null;

    // Check if we have validation metadata
    const raw = trend.rawAnalysis as Record<string, unknown> | null;
    const validatedStyles = raw?.validatedStyles as string[] | undefined;
    const divergentStyles = raw?.divergentStyles as string[] | undefined;

    // Use validated styles if available, otherwise fall through to all styles
    let trendingStylesText: string;
    if (validatedStyles && validatedStyles.length > 0 && divergentStyles) {
      // Show validated styles as confirmed, still show divergent ones as "emerging"
      const parts: string[] = [];
      if (validatedStyles.length > 0) parts.push(validatedStyles.join(', '));
      if (divergentStyles.length > 0) parts.push(`${divergentStyles.join(', ')} (emerging — not yet platform-confirmed)`);
      trendingStylesText = parts.join('; ');
    } else {
      trendingStylesText = trend.trendingStyles.join(', ');
    }

    const lines = [`Current Fashion Context (${trend.period}):`];
    if (trend.seasonalColors.length > 0) lines.push(`- Seasonal colors in style: ${trend.seasonalColors.join(', ')}`);
    if (trend.trendingStyles.length > 0) lines.push(`- Trending aesthetics: ${trendingStylesText}`);
    if (trend.keyPieces.length > 0) lines.push(`- Key pieces this season: ${trend.keyPieces.join(', ')}`);
    if (trend.trendingPatterns.length > 0) lines.push(`- Trending patterns/textures: ${trend.trendingPatterns.join(', ')}`);
    if (trend.fadingTrends.length > 0) lines.push(`- Moving out (avoid recommending): ${trend.fadingTrends.join(', ')}`);

    return lines.join('\n');
  } catch (error) {
    console.error('[FashionTrends] Failed to get latest trend:', error);
    return null;
  }
}

/**
 * Validate Gemini-generated trend claims against actual platform StyleDNA data (A3).
 * If Gemini says "oversized is trending" but our platform data shows fitted outperforming,
 * we flag it as "divergent" and reduce its weight in prompt injection.
 * Runs after runFashionTrendCron().
 */
export async function validateTrendAccuracy(): Promise<void> {
  const trend = await prisma.fashionTrend.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!trend) return;

  const platformData = trend.platformTrends as { topStyles?: string[] } | null;
  if (!platformData?.topStyles || platformData.topStyles.length === 0) return;

  const platformStylesLower = platformData.topStyles.map(s => s.toLowerCase());
  const geminiStyles = trend.trendingStyles;

  const validated: string[] = [];
  const divergent: string[] = [];

  for (const style of geminiStyles) {
    const styleLower = style.toLowerCase();
    const isInPlatform = platformStylesLower.some(p =>
      p.includes(styleLower) || styleLower.includes(p) ||
      // fuzzy: check if any word in the style matches platform
      styleLower.split(/\s+/).some(word => word.length > 3 && p.includes(word))
    );
    if (isInPlatform) validated.push(style);
    else divergent.push(style);
  }

  const existingRaw = (trend.rawAnalysis as Record<string, unknown>) || {};
  await prisma.fashionTrend.update({
    where: { id: trend.id },
    data: {
      rawAnalysis: {
        ...existingRaw,
        validatedStyles: validated,
        divergentStyles: divergent,
        validatedAt: new Date().toISOString(),
      } as any,
    },
  });

  console.log(`[FashionTrends] Validation: ${validated.length} confirmed by platform data, ${divergent.length} divergent${divergent.length > 0 ? ': ' + divergent.join(', ') : ''}`);
}

// Weekly cron: generate and store fresh trend data via Gemini
export async function runFashionTrendCron(): Promise<void> {
  const period = getWeekPeriod();

  // Skip if we already have a trend for this week
  try {
    const existing = await prisma.fashionTrend.findUnique({ where: { period } });
    if (existing) {
      console.log(`[FashionTrends] Trend already exists for ${period} — skipping`);
      return;
    }
  } catch (error) {
    console.error('[FashionTrends] DB lookup failed:', error);
    return;
  }

  // Get internal platform data to include in context
  const platformData = await getTrendData();
  const season = getSeason();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prompt = `You are a fashion trend analyst. Based on your knowledge, generate accurate fashion trend data for ${season} ${now.getFullYear()} (${dateStr}).

Platform data showing what users are actually wearing this week:
- Most worn styles: ${platformData.topStyles.join(', ')}
- Popular occasions: ${platformData.popularOccasions.join(', ')}
- Most used colors: ${platformData.colorTrends.join(', ')}

Generate current trend data. Return ONLY a JSON object with these exact fields:
{
  "seasonalColors": ["color1", "color2", ...],
  "trendingStyles": ["style1", "style2", ...],
  "keyPieces": ["piece1", "piece2", ...],
  "trendingPatterns": ["pattern1", ...],
  "fadingTrends": ["trend1", ...]
}

Field guidance:
- seasonalColors: 5-8 colors that are trending right now (e.g., "butter yellow", "cobalt blue", "terracotta")
- trendingStyles: 4-6 dominant aesthetics (e.g., "quiet luxury", "coastal grandmother", "clean girl", "ballet core")
- keyPieces: 5-8 must-have items this season (e.g., "wide-leg trousers", "trench coat", "ballet flats")
- trendingPatterns: 3-5 trending patterns/textures (e.g., "glen plaid", "bouclé", "sheer fabrics")
- fadingTrends: 3-5 styles moving out so you can steer users away from dated looks (e.g., "tiny micro-bags", "loud logomania")

Be specific and accurate for ${season} ${now.getFullYear()}. Return only the JSON object, no markdown fences.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Strip markdown fences if present
    const cleanText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const trendData = JSON.parse(cleanText);

    if (!Array.isArray(trendData.seasonalColors) || !Array.isArray(trendData.trendingStyles)) {
      throw new Error('Invalid trend data structure from Gemini');
    }

    await prisma.fashionTrend.create({
      data: {
        period,
        region: 'global',
        seasonalColors: trendData.seasonalColors || [],
        trendingStyles: trendData.trendingStyles || [],
        keyPieces: trendData.keyPieces || [],
        trendingPatterns: trendData.trendingPatterns || [],
        fadingTrends: trendData.fadingTrends || [],
        rawAnalysis: trendData,
        platformTrends: platformData,
      },
    });

    console.log(`✅ [FashionTrends] Generated and saved trend data for ${period}: ${trendData.trendingStyles.slice(0, 3).join(', ')}`);

    // Validate trend accuracy against platform data (A3)
    validateTrendAccuracy().catch(err => console.error('[FashionTrends] Validation failed:', err));

    // Publish to Intelligence Bus for learning system
    publishToIntelligenceBus('fashion-trends', 'trend_signal', {
      period,
      trendingStyles: trendData.trendingStyles,
      seasonalColors: trendData.seasonalColors,
      keyPieces: trendData.keyPieces,
      fadingTrends: trendData.fadingTrends,
    }).catch(() => {});
  } catch (error) {
    console.error('[FashionTrends] Failed to generate trend data:', error);
  }
}
