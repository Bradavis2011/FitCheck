/**
 * Feedback Reframe Engine
 *
 * Tracks per-user per-feedback-category engagement to detect "stuck" patterns.
 * A category is "stuck" when the user has been advised 5+ times but acted on
 * the advice < 20% of the time (based on StyleDNA dimension improvement next check).
 *
 * When stuck → inject reframe instruction: AI stops correcting and starts helping
 * the user execute their intentional style BETTER within that category.
 *
 * Categories (aligned to couldImproveCategories in response schema):
 *   fit, color, proportion, formality, style_era, accessories, other
 *
 * Called from:
 *   - ai-feedback.service.ts: getFeedbackReframeContext() before buildAnalysisPrompt()
 *   - ai-feedback.service.ts: trackFeedbackPatterns() after AI response saved
 */

import { prisma } from '../utils/prisma.js';

export type FeedbackCategory = 'fit' | 'color' | 'proportion' | 'formality' | 'style_era' | 'accessories' | 'other';

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'fit', 'color', 'proportion', 'formality', 'style_era', 'accessories', 'other',
];

// Thresholds for "stuck" detection
const STUCK_MIN_ADVICE_COUNT = 5;   // need at least 5 instances before declaring stuck
const STUCK_MAX_ACTED_RATE = 0.2;   // acted_on / advised < 20%

// Reframe instructions per category
// These replace the default "here's what's wrong" approach with
// "here's how to do what you're clearly choosing to do better"
const REFRAME_INSTRUCTIONS: Record<FeedbackCategory, string> = {
  fit: `This user intentionally wears oversized/relaxed silhouettes and consistently does not act on fit-tightening advice. Do NOT suggest tighter fits or standard tailoring. Instead: identify which oversized cuts flatter most for their body, suggest which fabrics drape best in relaxed silhouettes, and note one proportional anchor (e.g., a slim shoe or fitted layer) that makes intentional-oversized look editorial rather than accidental.`,

  color: `This user has their own color palette and does not act on color-adjustment advice. Do NOT suggest changing their color choices. Instead: validate what's working within their palette, suggest color-adjacent experiments they might enjoy (deeper/lighter tones, unexpected neutrals), and identify the one color relationship in the outfit that could be refined within their preferences.`,

  proportion: `This user has a distinct proportional style they are not changing. Do NOT flag the proportion as an issue. Instead: identify what makes their proportional choices work, suggest how to execute their proportion preference at a higher level (better quality pieces, more intentional contrast), and offer one micro-adjustment that enhances without redesigning.`,

  formality: `This user dresses at a formality level that differs from what the occasion might suggest, and this appears intentional. Do NOT push them toward higher formality. Instead: help them execute their formality level with more intentionality — better fabrics, sharper details, accessories that signal effort within a casual or elevated register.`,

  style_era: `This user's wardrobe skews toward a specific era (vintage, classic, contemporary) and they are not changing it. Do NOT call it dated. Instead: identify one modern detail that bridges their aesthetic to the current moment without abandoning it, and suggest how to pair era pieces with minimal contemporary anchors for intentional contrast.`,

  accessories: `This user does not act on accessory suggestions. Either they prefer minimal accessories or have a fixed accessory style. Do NOT recommend new accessories. Instead: if they have accessories, help them optimize what they wear. If they're minimal, validate the choice and focus feedback on clothing elements.`,

  other: `This user has a distinct personal style direction they are not changing. Do NOT repeat general style corrections. Instead: focus on execution quality — fabric, fit at specific points, color relationships within their framework — and offer the highest-leverage single change within their established aesthetic.`,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ReframeContext {
  stuckCategories: FeedbackCategory[];
  promptAddition: string; // text to inject into the analysis prompt
}

/**
 * Get reframe context for a user's analysis prompt.
 * Returns empty context if no stuck categories detected.
 */
export async function getFeedbackReframeContext(userId: string): Promise<ReframeContext> {
  try {
    const patterns = await prisma.userFeedbackPattern.findMany({
      where: {
        userId,
        timesAdvised: { gte: STUCK_MIN_ADVICE_COUNT },
      },
    });

    const stuckCategories: FeedbackCategory[] = [];

    for (const p of patterns) {
      const rate = p.timesAdvised > 0 ? p.timesActedOn / p.timesAdvised : 0;
      if (rate < STUCK_MAX_ACTED_RATE) {
        stuckCategories.push(p.category as FeedbackCategory);
      }
    }

    if (stuckCategories.length === 0) {
      return { stuckCategories: [], promptAddition: '' };
    }

    const instructions = stuckCategories
      .map(cat => `[${cat.toUpperCase()} REFRAME]: ${REFRAME_INSTRUCTIONS[cat]}`)
      .join('\n\n');

    const promptAddition = `\n\nUSER-SPECIFIC REFRAME INSTRUCTIONS (override default advice for these categories):\n${instructions}\n\nFrequency: For stuck categories, reduce advice frequency (mention only every 3rd check, not every check).\n\nIMPORTANT: Reframing affects ADVICE TONE only, not scoring. If fit is genuinely poor, score fitScore accordingly even if you are reframing the advice. Do not inflate scores to match a positive reframe.`;

    return { stuckCategories, promptAddition };
  } catch (err) {
    console.error('[FeedbackReframe] getFeedbackReframeContext failed:', err);
    return { stuckCategories: [], promptAddition: '' };
  }
}

/**
 * Record that categories were advised in the current feedback.
 * Called immediately after AI response is saved.
 */
export async function recordCategoriesAdvised(
  userId: string,
  categories: FeedbackCategory[],
): Promise<void> {
  if (categories.length === 0) return;

  try {
    const now = new Date();
    await Promise.all(
      categories.map(category =>
        prisma.userFeedbackPattern.upsert({
          where: { userId_category: { userId, category } },
          create: {
            userId,
            category,
            timesAdvised: 1,
            timesActedOn: 0,
            lastAdvisedAt: now,
          },
          update: {
            timesAdvised: { increment: 1 },
            lastAdvisedAt: now,
          },
        })
      )
    );
  } catch (err) {
    console.error('[FeedbackReframe] recordCategoriesAdvised failed:', err);
  }
}

/**
 * Record that a category was acted on (StyleDNA improved in that dimension vs prior check).
 * Called from the StyleDNA comparison logic after a new analysis.
 *
 * Improvement criteria (by category):
 *   fit         → fitScore improved >= 0.5
 *   color       → colorScore improved >= 0.5
 *   proportion  → proportionScore improved >= 0.5
 *   formality   → formalityLevel moved closer to occasion target
 *   accessories → overallScore improved >= 0.5 (proxy — harder to isolate)
 *   style_era   → coherenceScore improved >= 0.5
 *   other       → overallScore improved >= 0.5
 */
export async function recordCategoryActedOn(
  userId: string,
  category: FeedbackCategory,
): Promise<void> {
  try {
    await prisma.userFeedbackPattern.upsert({
      where: { userId_category: { userId, category } },
      create: {
        userId,
        category,
        timesAdvised: 0,
        timesActedOn: 1,
      },
      update: {
        timesActedOn: { increment: 1 },
      },
    });
  } catch (err) {
    console.error('[FeedbackReframe] recordCategoryActedOn failed:', err);
  }
}

/**
 * Compare two consecutive StyleDNA records and infer which categories
 * were acted on based on dimension score improvements.
 *
 * Call this after creating a new StyleDNA row, passing the user's prior StyleDNA.
 */
export async function inferAndRecordActedOn(
  userId: string,
  prevDNA: {
    fitScore: number | null;
    colorScore: number | null;
    proportionScore: number | null;
    coherenceScore: number | null;
  } | null,
  newDNA: {
    fitScore: number | null;
    colorScore: number | null;
    proportionScore: number | null;
    coherenceScore: number | null;
  },
  prevOverallScore: number | null,
  newOverallScore: number | null,
): Promise<void> {
  if (!prevDNA) return; // No prior data to compare

  const IMPROVEMENT_THRESHOLD = 0.5;
  const actedOn: FeedbackCategory[] = [];

  if (
    prevDNA.fitScore !== null &&
    newDNA.fitScore !== null &&
    newDNA.fitScore - prevDNA.fitScore >= IMPROVEMENT_THRESHOLD
  ) {
    actedOn.push('fit');
  }

  if (
    prevDNA.colorScore !== null &&
    newDNA.colorScore !== null &&
    newDNA.colorScore - prevDNA.colorScore >= IMPROVEMENT_THRESHOLD
  ) {
    actedOn.push('color');
  }

  if (
    prevDNA.proportionScore !== null &&
    newDNA.proportionScore !== null &&
    newDNA.proportionScore - prevDNA.proportionScore >= IMPROVEMENT_THRESHOLD
  ) {
    actedOn.push('proportion');
  }

  if (
    prevDNA.coherenceScore !== null &&
    newDNA.coherenceScore !== null &&
    newDNA.coherenceScore - prevDNA.coherenceScore >= IMPROVEMENT_THRESHOLD
  ) {
    actedOn.push('style_era');
  }

  if (
    prevOverallScore !== null &&
    newOverallScore !== null &&
    newOverallScore - prevOverallScore >= IMPROVEMENT_THRESHOLD
  ) {
    actedOn.push('accessories');
    actedOn.push('other');
  }

  await Promise.all(actedOn.map(cat => recordCategoryActedOn(userId, cat)));
}
