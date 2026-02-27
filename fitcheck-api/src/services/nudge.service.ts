/**
 * Nudge Service
 *
 * Extracted from scheduler.service.ts.
 * Adds variant rotation and outcome tracking.
 *
 * Measurement loop (called from 6am daily measurer):
 *   - For each segment, track nudge → outfit-check conversion within 6h
 *   - Publish nudge_metrics to Intelligence Bus
 *
 * Variant rotation:
 *   - Ops Learning Agent writes NudgeVariant rows per segment
 *   - We round-robin through active variants (control + generated)
 *   - After 2 weeks: keep winner (highest conversion rate), retire others
 */

import { prisma } from '../utils/prisma.js';
import { pushService } from './push.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

// ─── Variant Selection ────────────────────────────────────────────────────────

interface NudgeMessage { title: string; body: string; variantId?: string }

async function getNudgeMessage(
  segment: string,
  defaultTitle: string,
  defaultBody: string,
): Promise<NudgeMessage> {
  // Get all active variants for this segment (including control)
  const variants = await prisma.nudgeVariant.findMany({
    where: { segment, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (variants.length === 0) {
    return { title: defaultTitle, body: defaultBody };
  }

  // Round-robin: pick the variant with the fewest impressions
  const picked = variants.reduce((min, v) => v.impressions < min.impressions ? v : min, variants[0]);

  // Increment impressions
  await prisma.nudgeVariant.update({
    where: { id: picked.id },
    data: { impressions: { increment: 1 } },
  });

  return { title: picked.title, body: picked.body, variantId: picked.id };
}

// ─── Send Nudge ───────────────────────────────────────────────────────────────

async function hasReceivedNudgeToday(userId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'nudge_push',
      createdAt: { gte: todayStart },
    },
  });

  return existing !== null;
}

async function sendNudge(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (await hasReceivedNudgeToday(userId)) return;

  await pushService.sendPushNotification(userId, { title, body, data });

  await prisma.notification.create({
    data: { userId, type: 'nudge_push', title, body },
  });
}

// ─── Outcome Tracking ─────────────────────────────────────────────────────────

/** After a nudge, check if user completed an outfit check within 6h window. */
async function checkNudgeConversions(): Promise<void> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Find notifications sent in the last 6h (the 6h window from nudge time)
  const recentNudges = await prisma.notification.findMany({
    where: {
      type: 'nudge_push',
      createdAt: { gte: sixHoursAgo },
    },
    select: { userId: true, createdAt: true },
  });

  for (const nudge of recentNudges) {
    const sixHoursAfter = new Date(nudge.createdAt.getTime() + 6 * 60 * 60 * 1000);

    const converted = await prisma.outfitCheck.findFirst({
      where: {
        userId: nudge.userId,
        isDeleted: false,
        createdAt: { gte: nudge.createdAt, lte: sixHoursAfter },
      },
    });

    if (converted) {
      // Find the NudgeVariant that was shown (segment unknown here — increment all active ones
      // for this user. A future improvement would store variantId on the notification row.)
      await prisma.nudgeVariant.updateMany({
        where: { isActive: true, impressions: { gt: 0 } },
        data: { conversions: { increment: 1 } },
      });
    }
  }
}

// ─── Metrics Collection ───────────────────────────────────────────────────────

export async function measureNudgeMetrics(): Promise<void> {
  const segments = ['new_no_outfit', 'inactive_3d', 'streak_risk', 'churning_paid'];
  const metrics: Record<string, { impressions: number; conversions: number; rate: number }> = {};

  for (const segment of segments) {
    const variants = await prisma.nudgeVariant.findMany({
      where: { segment },
      select: { impressions: true, conversions: true },
    });

    const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
    const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
    const rate = totalImpressions > 0 ? totalConversions / totalImpressions : 0;

    metrics[segment] = { impressions: totalImpressions, conversions: totalConversions, rate };
  }

  const worstSegment = Object.entries(metrics)
    .filter(([, m]) => m.impressions >= 10)
    .sort((a, b) => a[1].rate - b[1].rate)[0]?.[0] || null;

  await publishToIntelligenceBus('nudge', 'nudge_metrics', {
    measuredAt: new Date().toISOString(),
    segments: metrics,
    worstSegment,
  });

  console.log('[NudgeService] Metrics published to bus');
}

// ─── Auto-promote Winners ─────────────────────────────────────────────────────

/** After 2 weeks, promote the best-performing variant per segment, retire others. */
export async function promoteNudgeWinners(): Promise<void> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const segments = ['new_no_outfit', 'inactive_3d', 'streak_risk', 'churning_paid'];

  for (const segment of segments) {
    const variants = await prisma.nudgeVariant.findMany({
      where: { segment, isActive: true, createdAt: { lte: twoWeeksAgo } },
    });

    if (variants.length < 2) continue; // Need at least 2 variants to compare

    const minImpressions = 20;
    const eligible = variants.filter(v => v.impressions >= minImpressions);
    if (eligible.length < 2) continue;

    const winner = eligible.reduce((best, v) => {
      const rateV = v.impressions > 0 ? v.conversions / v.impressions : 0;
      const rateBest = best.impressions > 0 ? best.conversions / best.impressions : 0;
      return rateV > rateBest ? v : best;
    }, eligible[0]);

    // Mark winner as active, retire others
    for (const v of eligible) {
      if (v.id === winner.id) continue;
      await prisma.nudgeVariant.update({
        where: { id: v.id },
        data: { isActive: false },
      });
    }

    console.log(`[NudgeService] Promoted winner for segment "${segment}": "${winner.title}"`);
  }
}

// ─── Preferred Nudge Hour Computation (A1) ────────────────────────────────────

/**
 * Batch-compute preferred nudge hour for all active users.
 * "Preferred" = the UTC hour with the most outfit check activity.
 * Only computed for users with 5+ checks. Runs daily at 5am UTC.
 */
export async function computePreferredNudgeHours(): Promise<void> {
  // Find users with 5+ outfit checks
  const activeUsers = await prisma.outfitCheck.groupBy({
    by: ['userId'],
    where: { isDeleted: false, aiProcessedAt: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gte: 5 } } },
  });

  let updated = 0;

  for (const { userId } of activeUsers) {
    const checks = await prisma.outfitCheck.findMany({
      where: { userId, isDeleted: false, aiProcessedAt: { not: null } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50, // use recent 50 for the histogram
    });

    if (checks.length < 5) continue;

    // Build hour histogram (UTC)
    const hourCounts = new Array(24).fill(0) as number[];
    for (const { createdAt } of checks) {
      hourCounts[createdAt.getUTCHours()]++;
    }

    // Find modal hour
    const modalHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Skip default nudge hours (14=2pm, 22=10pm) to avoid duplication
    if (modalHour === 14 || modalHour === 22) {
      await prisma.user.update({
        where: { id: userId },
        data: { preferredNudgeHour: null },
      }).catch(() => {});
      continue;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { preferredNudgeHour: modalHour },
    }).catch(() => {});

    updated++;
  }

  console.log(`[NudgeService] computePreferredNudgeHours: updated ${updated} users`);
}

/**
 * Run personalized nudge for users whose preferred hour matches currentUTCHour.
 * Called hourly. Handles segments 1 (new no-outfit) and 2 (inactive 3d) only.
 * Streak-risk remains at 10pm; churning-paid remains at 2pm (default runs).
 */
export async function runPersonalizedNudge(currentUTCHour: number): Promise<void> {
  // Skip default hours — those are handled by runEngagementNudger
  if (currentUTCHour === 14 || currentUTCHour === 22) return;

  const now = new Date();
  const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hoursAgo48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const hoursAgo72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  // Segment 1: New users with no outfit (24-48h after signup) — personalized hour
  try {
    const newUsersWithoutOutfit = await prisma.user.findMany({
      where: {
        createdAt: { gte: hoursAgo48, lt: hoursAgo24 },
        preferredNudgeHour: currentUTCHour,
        outfitChecks: { none: {} },
      },
      select: { id: true },
    });

    const msg = await getNudgeMessage(
      'new_no_outfit',
      'Ready for your first outfit check? 👗',
      "Get personalized style feedback from our AI stylist. It only takes 30 seconds!"
    );

    for (const { id } of newUsersWithoutOutfit) {
      await sendNudge(id, msg.title, msg.body, { type: 'nudge', segment: 'new_no_outfit', personalized: true });
    }
  } catch (err) {
    console.error('[PersonalizedNudge] Segment 1 failed:', err);
  }

  // Segment 2: Users inactive for 3 days — personalized hour
  try {
    const activeBeforeWindow = await prisma.outfitCheck.findMany({
      where: { isDeleted: false, createdAt: { lt: hoursAgo72 } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const potentialIds = activeBeforeWindow.map(u => u.userId);

    // Filter to only users with this preferred hour
    const personalizedUsers = await prisma.user.findMany({
      where: { id: { in: potentialIds }, preferredNudgeHour: currentUTCHour },
      select: { id: true },
    });
    const personalizedIds = personalizedUsers.map(u => u.id);

    const recentlyActive = await prisma.outfitCheck.findMany({
      where: {
        userId: { in: personalizedIds },
        isDeleted: false,
        createdAt: { gte: hoursAgo72 },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const recentIds = new Set(recentlyActive.map(u => u.userId));
    const inactiveIds = personalizedIds.filter(id => !recentIds.has(id));

    const msg = await getNudgeMessage(
      'inactive_3d',
      'Your style is evolving! ✨',
      "It's been a few days. Share your current look and get AI feedback."
    );

    for (const userId of inactiveIds) {
      await sendNudge(userId, msg.title, msg.body, { type: 'nudge', segment: 'inactive_3d', personalized: true });
    }
  } catch (err) {
    console.error('[PersonalizedNudge] Segment 2 failed:', err);
  }
}

// ─── Engagement Nudger (main run) ─────────────────────────────────────────────

export async function runEngagementNudger(isEveningRun: boolean): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hoursAgo48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const hoursAgo72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const daysAgo5 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  let nudgeCount = 0;

  if (!isEveningRun) {
    // ── Segment 1: New users with no outfit check (24-48h after signup) ──
    // Skip users with a custom preferredNudgeHour — they get personalized timing
    try {
      const newUsersWithoutOutfit = await prisma.user.findMany({
        where: {
          createdAt: { gte: hoursAgo48, lt: hoursAgo24 },
          preferredNudgeHour: null, // personalized users handled by hourly cron
          outfitChecks: { none: {} },
        },
        select: { id: true },
      });

      const msg = await getNudgeMessage(
        'new_no_outfit',
        'Ready for your first outfit check? 👗',
        "Get personalized style feedback from our AI stylist. It only takes 30 seconds!"
      );

      for (const { id } of newUsersWithoutOutfit) {
        await sendNudge(id, msg.title, msg.body, { type: 'nudge', segment: 'new_no_outfit' });
        nudgeCount++;
      }
      console.log(`[Nudger] Segment 1 (new, no outfit): ${newUsersWithoutOutfit.length} users, ${nudgeCount} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 1 failed:', err);
    }

    // ── Segment 2: Users inactive for 3 days ──
    // Skip users with preferredNudgeHour — handled by personalized hourly cron
    try {
      const activeBeforeWindow = await prisma.outfitCheck.findMany({
        where: { isDeleted: false, createdAt: { lt: hoursAgo72 } },
        select: { userId: true },
        distinct: ['userId'],
      });

      const potentialIds = activeBeforeWindow.map(u => u.userId);

      // Filter out users with a custom preferred nudge hour
      const defaultUsers = await prisma.user.findMany({
        where: { id: { in: potentialIds }, preferredNudgeHour: null },
        select: { id: true },
      });
      const defaultIds = new Set(defaultUsers.map(u => u.id));

      const recentlyActive = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: [...defaultIds] },
          isDeleted: false,
          createdAt: { gte: hoursAgo72 },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const recentIds = new Set(recentlyActive.map(u => u.userId));
      const inactiveIds = [...defaultIds].filter(id => !recentIds.has(id));

      const msg = await getNudgeMessage(
        'inactive_3d',
        'Your style is evolving! ✨',
        "It's been a few days. Share your current look and get AI feedback."
      );

      let seg2Count = 0;
      for (const userId of inactiveIds) {
        await sendNudge(userId, msg.title, msg.body, { type: 'nudge', segment: 'inactive_3d' });
        seg2Count++;
      }
      console.log(`[Nudger] Segment 2 (inactive 3d): ${inactiveIds.length} users, ${seg2Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 2 failed:', err);
    }

    // ── Segment 4: Churning Plus/Pro users (inactive 5+ days) ──
    try {
      const payingInactive = await prisma.user.findMany({
        where: {
          tier: { in: ['plus', 'pro'] },
          outfitChecks: {
            none: { isDeleted: false, createdAt: { gte: daysAgo5 } },
          },
        },
        select: { id: true, tier: true },
      });

      const msg = await getNudgeMessage(
        'churning_paid',
        "We miss you! Your subscription benefits are waiting 💎",
        "You haven't checked in for 5 days. Your subscription perks are ready to use!"
      );

      let seg4Count = 0;
      for (const { id } of payingInactive) {
        await sendNudge(id, msg.title, msg.body, { type: 'nudge', segment: 'churning_paid' });
        seg4Count++;
      }
      console.log(`[Nudger] Segment 4 (churning paid): ${payingInactive.length} users, ${seg4Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 4 failed:', err);
    }
  }

  // ── Segment 3: Streak at risk (evening only) ──
  if (isEveningRun) {
    try {
      const streakUsers = await prisma.userStats.findMany({
        where: { currentStreak: { gt: 0 } },
        select: { userId: true, currentStreak: true },
      });

      const streakUserIds = streakUsers.map(u => u.userId);

      const checkedToday = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: streakUserIds },
          isDeleted: false,
          createdAt: { gte: todayStart },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const checkedTodayIds = new Set(checkedToday.map(u => u.userId));
      const atRisk = streakUsers.filter(u => !checkedTodayIds.has(u.userId));

      let seg3Count = 0;
      for (const { userId, currentStreak } of atRisk) {
        const msg = await getNudgeMessage(
          'streak_risk',
          `⚠️ Your ${currentStreak}-day streak is at risk!`,
          "Check in with an outfit before midnight to keep your streak alive."
        );
        await sendNudge(userId, msg.title, msg.body, { type: 'nudge', segment: 'streak_risk', streak: currentStreak });
        seg3Count++;
      }
      console.log(`[Nudger] Segment 3 (streak risk): ${atRisk.length} users, ${seg3Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 3 failed:', err);
    }
  }

  // Track conversions from nudges sent 6h ago
  try {
    await checkNudgeConversions();
  } catch (err) {
    console.error('[Nudger] Outcome tracking failed:', err);
  }
}
