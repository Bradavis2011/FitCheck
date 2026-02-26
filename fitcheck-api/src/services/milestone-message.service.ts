import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';
import { canSendRelationshipNotification } from './event-followup.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

export interface MilestoneContext {
  outfitCount?: number;
  latestScore?: number;
  currentStreak?: number;
}

type MessageFn = (ctx: MilestoneContext) => string;

const MILESTONE_MESSAGES: Record<string, MessageFn> = {
  '10th_outfit': () =>
    "10 outfits in. You're building a real style story. Let's see where it goes.",
  '25th_outfit': () =>
    "25 outfits. That's commitment. Your StyleDNA is seriously dialed in.",
  'first_9_plus': (ctx) =>
    `Your first 9+! ${ctx.latestScore?.toFixed(1)} on that look. You know what you're doing.`,
  '7_day_streak': () =>
    "Seven days straight. That's not luck — that's a style habit forming.",
  '30_day_streak': () =>
    "30 days. You've made style part of your daily life. That's rare.",
  'first_month': () =>
    "One month in. Your eye for style is sharper than when you started.",
  'score_improvement': () =>
    'Your scores are climbing. The feedback is working.',
};

export async function checkMilestones(
  userId: string,
  context: MilestoneContext,
): Promise<void> {
  try {
    const toFire: string[] = [];

    if (context.outfitCount === 10) toFire.push('10th_outfit');
    if (context.outfitCount === 25) toFire.push('25th_outfit');
    if (context.latestScore !== undefined && context.latestScore >= 9.0) {
      toFire.push('first_9_plus');
    }
    if (context.currentStreak === 7) toFire.push('7_day_streak');
    if (context.currentStreak === 30) toFire.push('30_day_streak');

    for (const milestoneKey of toFire) {
      const msg = MILESTONE_MESSAGES[milestoneKey]?.(context) ?? milestoneKey;
      await fireIfNew(userId, milestoneKey, msg);
    }
  } catch (err) {
    console.error('[Milestones] checkMilestones failed:', err);
  }
}

export async function runMilestoneScanner(): Promise<void> {
  const now = new Date();

  // first_month: user createdAt 29-31 days ago (fire once in that window)
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  try {
    const firstMonthUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: thirtyOneDaysAgo,
          lte: twentyNineDaysAgo,
        },
      },
      select: { id: true },
    });

    for (const { id } of firstMonthUsers) {
      await fireIfNew(id, 'first_month', MILESTONE_MESSAGES['first_month']({}));
    }

    console.log(`[Milestones] Checked first_month for ${firstMonthUsers.length} users`);
  } catch (err) {
    console.error('[Milestones] first_month scan failed:', err);
  }

  // score_improvement: avg score last 7 days vs previous 7 days, diff >= 1.0
  try {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentChecks = await prisma.outfitCheck.groupBy({
      by: ['userId'],
      where: {
        isDeleted: false,
        aiProcessedAt: { not: null },
        aiScore: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      _avg: { aiScore: true },
      _count: { id: true },
    });

    const prevChecks = await prisma.outfitCheck.groupBy({
      by: ['userId'],
      where: {
        isDeleted: false,
        aiProcessedAt: { not: null },
        aiScore: { not: null },
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _avg: { aiScore: true },
      _count: { id: true },
    });

    const prevMap = new Map(prevChecks.map((r) => [r.userId, r._avg.aiScore ?? 0]));

    for (const recent of recentChecks) {
      if ((recent._count.id ?? 0) < 2) continue;
      const prevAvg = prevMap.get(recent.userId);
      if (!prevAvg || !recent._avg.aiScore) continue;
      if (recent._avg.aiScore - prevAvg >= 1.0) {
        await fireIfNew(
          recent.userId,
          'score_improvement',
          MILESTONE_MESSAGES['score_improvement']({}),
        );
      }
    }

    console.log('[Milestones] score_improvement scan complete');
  } catch (err) {
    console.error('[Milestones] score_improvement scan failed:', err);
  }
}

/**
 * B3: Measure milestone message effectiveness.
 * For each milestone type, compute the % of users who submitted an outfit check within 24h.
 * Publishes to Intelligence Bus for ops-learning weekly critique.
 */
export async function measureMilestoneMetrics(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const milestones = await prisma.milestoneMessage.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { userId: true, milestoneKey: true, createdAt: true },
  });

  if (milestones.length === 0) return;

  const byKey = new Map<string, { total: number; converted: number }>();

  for (const m of milestones) {
    if (!byKey.has(m.milestoneKey)) byKey.set(m.milestoneKey, { total: 0, converted: 0 });
    const stats = byKey.get(m.milestoneKey)!;
    stats.total++;

    // Check for outfit check within 24h after milestone notification
    const twentyFourHoursAfter = new Date(m.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const check = await prisma.outfitCheck.findFirst({
      where: {
        userId: m.userId,
        isDeleted: false,
        createdAt: { gte: m.createdAt, lte: twentyFourHoursAfter },
      },
    });
    if (check) stats.converted++;
  }

  const metrics = [...byKey.entries()].map(([milestoneKey, m]) => ({
    milestoneKey,
    total: m.total,
    conversionRate: m.total > 0 ? m.converted / m.total : 0,
  }));

  const worstMilestone = metrics
    .filter(m => m.total >= 3)
    .sort((a, b) => a.conversionRate - b.conversionRate)[0] || null;

  await publishToIntelligenceBus('ops-learning', 'milestone_metrics', {
    measuredAt: new Date().toISOString(),
    metrics,
    worstMilestone: worstMilestone?.milestoneKey || null,
    worstConversionRate: worstMilestone?.conversionRate || null,
  });

  console.log(`[Milestones] Metrics published: ${milestones.length} milestone events across ${metrics.length} types`);
}

async function fireIfNew(
  userId: string,
  milestoneKey: string,
  message: string,
): Promise<void> {
  try {
    // create throws on unique constraint violation (already fired) — that's the dedup mechanism
    await prisma.milestoneMessage.create({
      data: { userId, milestoneKey, message },
    });

    if (!(await canSendRelationshipNotification(userId))) return;

    await createNotification({
      userId,
      type: 'milestone',
      title: 'Style milestone! ✨',
      body: message,
    });

    console.log(`[Milestones] Fired ${milestoneKey} for user ${userId}`);
  } catch (err: any) {
    // P2002 = unique constraint violation → already fired, skip silently
    if (err?.code !== 'P2002') {
      console.error(`[Milestones] fireIfNew(${milestoneKey}) failed:`, err);
    }
  }
}
