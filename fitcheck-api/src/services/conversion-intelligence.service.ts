import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { pushService } from './push.service.js';
import { triggerUpgradeSequence } from './lifecycle-email.service.js';

const UPGRADE_STRENGTH_THRESHOLD = 0.7;

// ─── Signal Detection ─────────────────────────────────────────────────────────

async function detectSignals(): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let signalsCreated = 0;

  // ── hit_daily_limit: free users who hit 3 checks today ──
  try {
    const limitHitters = await prisma.user.findMany({
      where: { tier: 'free', dailyChecksUsed: { gte: 3 } },
      select: { id: true },
    });

    for (const { id } of limitHitters) {
      const alreadyToday = await prisma.conversionSignal.findFirst({
        where: { userId: id, signalType: 'hit_daily_limit', createdAt: { gte: todayStart } },
      });
      if (!alreadyToday) {
        await prisma.conversionSignal.create({
          data: { userId: id, signalType: 'hit_daily_limit', strength: 0.8 },
        });
        signalsCreated++;
      }
    }
    console.log(`[ConversionIntelligence] hit_daily_limit: ${limitHitters.length} users scanned`);
  } catch (err) {
    console.error('[ConversionIntelligence] hit_daily_limit scan failed:', err);
  }

  // ── high_engagement: free users active 5+ of last 7 days ──
  try {
    const freeUsers = await prisma.user.findMany({
      where: { tier: 'free' },
      select: { id: true },
    });

    for (const { id } of freeUsers) {
      const checks = await prisma.outfitCheck.findMany({
        where: { userId: id, isDeleted: false, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      });

      const activeDays = new Set(checks.map(c => c.createdAt.toISOString().slice(0, 10)));
      if (activeDays.size >= 5) {
        const alreadyToday = await prisma.conversionSignal.findFirst({
          where: { userId: id, signalType: 'high_engagement', createdAt: { gte: todayStart } },
        });
        if (!alreadyToday) {
          await prisma.conversionSignal.create({
            data: { userId: id, signalType: 'high_engagement', strength: 0.7 },
          });
          signalsCreated++;
        }
      }
    }
    console.log(`[ConversionIntelligence] high_engagement: ${freeUsers.length} users scanned`);
  } catch (err) {
    console.error('[ConversionIntelligence] high_engagement scan failed:', err);
  }

  // ── loyal_free: free users with 10+ total outfit checks ──
  try {
    const loyalUsers = await prisma.outfitCheck.groupBy({
      by: ['userId'],
      where: { isDeleted: false },
      _count: { id: true },
      having: { id: { _count: { gte: 10 } } },
    });

    for (const { userId } of loyalUsers) {
      const isFree = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
      if (!isFree || isFree.tier !== 'free') continue;

      const alreadyToday = await prisma.conversionSignal.findFirst({
        where: { userId, signalType: 'loyal_free', createdAt: { gte: todayStart } },
      });
      if (!alreadyToday) {
        await prisma.conversionSignal.create({
          data: { userId, signalType: 'loyal_free', strength: 0.5 },
        });
        signalsCreated++;
      }
    }
    console.log(`[ConversionIntelligence] loyal_free: ${loyalUsers.length} users qualified`);
  } catch (err) {
    console.error('[ConversionIntelligence] loyal_free scan failed:', err);
  }

  // ── power_user: free users with 2+ follow-ups on any single outfit ──
  try {
    const heavyFollowUpOutfits = await prisma.followUp.groupBy({
      by: ['outfitCheckId'],
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });

    const outfitIds = heavyFollowUpOutfits.map(f => f.outfitCheckId);
    if (outfitIds.length > 0) {
      const outfits = await prisma.outfitCheck.findMany({
        where: { id: { in: outfitIds }, isDeleted: false },
        select: { userId: true },
        distinct: ['userId'],
      });

      for (const { userId } of outfits) {
        const isFree = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
        if (!isFree || isFree.tier !== 'free') continue;

        const alreadyToday = await prisma.conversionSignal.findFirst({
          where: { userId, signalType: 'power_user', createdAt: { gte: todayStart } },
        });
        if (!alreadyToday) {
          await prisma.conversionSignal.create({
            data: { userId, signalType: 'power_user', strength: 0.6 },
          });
          signalsCreated++;
        }
      }
    }
    console.log(`[ConversionIntelligence] power_user: ${outfitIds.length} outfits with heavy follow-ups`);
  } catch (err) {
    console.error('[ConversionIntelligence] power_user scan failed:', err);
  }

  return signalsCreated;
}

// ─── Act on High-Signal Users ─────────────────────────────────────────────────

async function nudgeHighSignalUsers(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Find free users with unacted signals in the last 7 days
  const signals = await prisma.conversionSignal.findMany({
    where: {
      actedOn: false,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { userId: true, strength: true, id: true },
  });

  // Aggregate strength per user
  const userStrength = new Map<string, { total: number; signalIds: string[] }>();
  for (const s of signals) {
    const existing = userStrength.get(s.userId);
    if (existing) {
      existing.total += s.strength;
      existing.signalIds.push(s.id);
    } else {
      userStrength.set(s.userId, { total: s.strength, signalIds: [s.id] });
    }
  }

  let nudgedCount = 0;

  for (const [userId, { total, signalIds }] of userStrength) {
    if (total < UPGRADE_STRENGTH_THRESHOLD) continue;

    try {
      const payload = { userId, totalStrength: total, signalIds };

      await executeOrQueue(
        'conversion-intelligence',
        'upgrade_nudge',
        'low',
        payload as unknown as Record<string, unknown>,
        async (p) => {
          const data = p as typeof payload;

          // Trigger upgrade email sequence if not already active
          await triggerUpgradeSequence(data.userId);

          // Send upgrade push notification (max 1/day via Notification table check)
          const existingNotif = await prisma.notification.findFirst({
            where: {
              userId: data.userId,
              type: 'upgrade_nudge',
              createdAt: { gte: todayStart },
            },
          });

          if (!existingNotif) {
            await pushService.sendPushNotification(data.userId, {
              title: 'You\'re hitting your limits 🚀',
              body: 'Upgrade to Or This? Pro for unlimited outfit checks and more.',
              data: { type: 'upgrade_nudge', screen: 'subscription' },
            });

            await prisma.notification.create({
              data: {
                userId: data.userId,
                type: 'upgrade_nudge',
                title: 'Unlock unlimited checks',
                body: 'Upgrade to Pro for unlimited outfit checks.',
              },
            });
          }

          // Mark signals as acted on
          await prisma.conversionSignal.updateMany({
            where: { id: { in: data.signalIds } },
            data: { actedOn: true },
          });

          return { userId: data.userId, emailTriggered: true, pushSent: !existingNotif };
        },
      );

      nudgedCount++;
    } catch (err) {
      console.error(`[ConversionIntelligence] Failed to nudge user ${userId}:`, err);
    }
  }

  return nudgedCount;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runConversionIntelligence(): Promise<void> {
  console.log('[ConversionIntelligence] Starting run...');

  const signalsCreated = await detectSignals();
  const nudgedUsers = await nudgeHighSignalUsers();

  console.log(`[ConversionIntelligence] Done — ${signalsCreated} signals created, ${nudgedUsers} users nudged`);
}
