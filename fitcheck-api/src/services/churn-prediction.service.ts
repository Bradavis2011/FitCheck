/**
 * Churn Prediction Service
 *
 * Computes 0.0–1.0 risk scores for every user from multiple engagement signals
 * and proactively sends re-engagement pushes to high-risk paid users.
 */

import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { createNotification } from '../controllers/notification.controller.js';

const BATCH_SIZE = 50;

// ─── Risk Score Computation ───────────────────────────────────────────────────

interface RiskResult {
  score: number;
  factors: string[];
}

export async function computeChurnRisk(userId: string): Promise<RiskResult> {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysFuture = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let score = 0;
  const factors: string[] = [];

  // Fetch everything in one round-trip
  const [userRaw, statsRaw, last7dChecks, prev7dChecks, last5Checks, lastCheck] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, subscriptionExpiresAt: true },
    }),
    prisma.userStats.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
    }),
    prisma.outfitCheck.count({
      where: { userId, isDeleted: false, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.outfitCheck.count({
      where: {
        userId,
        isDeleted: false,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
    prisma.outfitCheck.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { aiScore: true },
    }),
    prisma.outfitCheck.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  if (!userRaw) return { score: 0, factors: [] };
  const user = {
    tier: userRaw.tier,
    subscriptionExpiresAt: userRaw.subscriptionExpiresAt,
    currentStreak: statsRaw?.currentStreak ?? 0,
    longestStreak: statsRaw?.longestStreak ?? 0,
    lastActiveDate: statsRaw?.lastActiveDate ?? null,
  };

  // Signal 1 (weight 0.30): Declining usage — last 7d checks < 50% of prior 7d
  if (prev7dChecks > 0 && last7dChecks < prev7dChecks * 0.5) {
    score += 0.3;
    factors.push(`declining_usage (last7d=${last7dChecks}, prev7d=${prev7dChecks})`);
  }

  // Signal 2 (weight 0.25): No check in 5+ days
  if (!lastCheck || lastCheck.createdAt < fiveDaysAgo) {
    score += 0.25;
    factors.push('inactive_5d');
  }

  // Signal 3 (weight 0.20): Avg score on last 5 checks < 5 (frustration)
  if (last5Checks.length >= 3) {
    const avgScore =
      last5Checks.reduce((sum, c) => sum + (c.aiScore ?? 0), 0) / last5Checks.length;
    if (avgScore < 5) {
      score += 0.2;
      factors.push(`low_avg_score (avg=${avgScore.toFixed(1)})`);
    }
  }

  // Signal 4 (weight 0.15): Paid user with subscription expiring in 7 days
  if (
    user.tier !== 'free' &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt <= sevenDaysFuture &&
    user.subscriptionExpiresAt > now
  ) {
    score += 0.15;
    factors.push('subscription_expiring_7d');
  }

  // Signal 5 (weight 0.10): Had streak >= 3 but current streak is 0
  if (user.longestStreak >= 3 && user.currentStreak === 0) {
    score += 0.1;
    factors.push('streak_broken');
  }

  return { score: Math.min(1.0, score), factors };
}

// ─── Batch Runner ─────────────────────────────────────────────────────────────

export async function runChurnPrediction(): Promise<void> {
  console.log('[ChurnPrediction] Starting run...');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let skip = 0;
  let highRiskCount = 0;
  let medRiskCount = 0;
  let actionsToday = 0;
  let processed = 0;

  // Find all users with at least one outfit check
  const eligibleIds = await prisma.outfitCheck.findMany({
    where: { isDeleted: false },
    distinct: ['userId'],
    select: { userId: true },
  });

  const totalUsers = eligibleIds.length;
  console.log(`[ChurnPrediction] Processing ${totalUsers} users in batches of ${BATCH_SIZE}`);

  while (skip < totalUsers) {
    const batch = eligibleIds.slice(skip, skip + BATCH_SIZE);
    skip += BATCH_SIZE;

    await Promise.all(
      batch.map(async ({ userId }) => {
        try {
          const { score, factors } = await computeChurnRisk(userId);
          processed++;

          // Upsert risk record
          await prisma.churnRiskScore.upsert({
            where: { userId },
            update: { riskScore: score, riskFactors: factors, computedAt: new Date() },
            create: { userId, riskScore: score, riskFactors: factors, computedAt: new Date() },
          });

          if (score >= 0.6) highRiskCount++;
          else if (score >= 0.3) medRiskCount++;

          // Take action for high-risk users who haven't been actioned recently
          if (score >= 0.6) {
            const existing = await prisma.churnRiskScore.findUnique({
              where: { userId },
              select: { actionTaken: true, actionTakenAt: true },
            });

            const recentlyActioned =
              existing?.actionTakenAt && existing.actionTakenAt >= sevenDaysAgo;

            if (!recentlyActioned) {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { tier: true, email: true },
              });

              if (user && user.tier !== 'free') {
                const body =
                  user.tier === 'pro'
                    ? "You're a Pro member — come check your latest outfit and keep your streak alive!"
                    : "Your Plus subscription is active — snap an outfit and let the AI do its thing!";

                await createNotification({
                  userId,
                  type: 'milestone',
                  title: 'Come back!',
                  body,
                });

                await prisma.churnRiskScore.update({
                  where: { userId },
                  data: { actionTaken: 'push_sent', actionTakenAt: new Date() },
                });

                actionsToday++;
              }
            }
          }
        } catch (err) {
          console.error(`[ChurnPrediction] Error processing user ${userId}:`, err);
        }
      }),
    );
  }

  // Publish metrics
  try {
    await publishToIntelligenceBus('churn-prediction', 'churn_metrics', {
      highRiskCount,
      medRiskCount,
      actionsToday,
      usersProcessed: processed,
    });
  } catch (err) {
    console.error('[ChurnPrediction] Failed to publish metrics:', err);
  }

  console.log(
    `[ChurnPrediction] Done — high:${highRiskCount} med:${medRiskCount} actioned:${actionsToday}`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getChurnSummary(): Promise<{
  highRiskCount: number;
  actionsThisWeek: number;
}> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [highRiskCount, actionsThisWeek] = await Promise.all([
    prisma.churnRiskScore.count({ where: { riskScore: { gte: 0.6 } } }),
    prisma.churnRiskScore.count({
      where: { actionTakenAt: { gte: since }, actionTaken: { not: null } },
    }),
  ]);

  return { highRiskCount, actionsThisWeek };
}
