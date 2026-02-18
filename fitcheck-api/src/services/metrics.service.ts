import { prisma } from '../utils/prisma.js';

export interface MetricsSnapshot {
  generatedAt: Date;

  // Users
  totalUsers: number;
  newUsersToday: number;
  freeUsers: number;
  plusUsers: number;
  proUsers: number;

  // Engagement
  dau: number;
  wau: number;
  checksToday: number;
  feedbacksToday: number;
  avgAiScore: number | null;

  // Streaks
  usersWithStreak: number;
  avgStreak: number | null;

  // Revenue events
  newSubscriptions: number;
  cancellations: number;
  renewals: number;

  // Community
  comparisonPosts: number;
  liveSessions: number;

  // Extra detail (not stored in snapshot)
  retention7d: number | null; // % of users who were active 7 days ago and again today
  expertReviewsPending: number;
  avgCommunityScore: number | null;
}

function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  const todayStart = startOfDay();
  const weekAgo = daysAgo(7);
  const sevenDaysAgo = daysAgo(7);

  const [
    totalUsers,
    newUsersToday,
    freeUsers,
    plusUsers,
    proUsers,
    checksToday,
    feedbacksToday,
    aiScoreAgg,
    usersActiveToday,
    usersActiveThisWeek,
    streakStats,
    newSubscriptions,
    cancellations,
    renewals,
    comparisonPosts,
    liveSessions,
    expertReviewsPending,
    communityScoreAgg,
  ] = await Promise.all([
    // total users
    prisma.user.count(),

    // new users today
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),

    // users by tier
    prisma.user.count({ where: { tier: 'free' } }),
    prisma.user.count({ where: { tier: 'plus' } }),
    prisma.user.count({ where: { tier: 'pro' } }),

    // checks today
    prisma.outfitCheck.count({
      where: { createdAt: { gte: todayStart }, isDeleted: false },
    }),

    // community feedbacks today
    prisma.communityFeedback.count({ where: { createdAt: { gte: todayStart } } }),

    // avg AI score today
    prisma.outfitCheck.aggregate({
      where: { createdAt: { gte: todayStart }, aiScore: { not: null }, isDeleted: false },
      _avg: { aiScore: true },
    }),

    // DAU — distinct users who submitted a check OR gave feedback today
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: todayStart }, isDeleted: false },
      select: { userId: true },
      distinct: ['userId'],
    }),

    // WAU — distinct users active in last 7 days
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
      select: { userId: true },
      distinct: ['userId'],
    }),

    // streak stats
    prisma.userStats.aggregate({
      where: { currentStreak: { gt: 0 } },
      _count: { currentStreak: true },
      _avg: { currentStreak: true },
    }),

    // new subscriptions today (initial_purchase events)
    prisma.subscriptionEvent.count({
      where: {
        processedAt: { gte: todayStart },
        eventType: { in: ['INITIAL_PURCHASE', 'initial_purchase'] },
      },
    }),

    // cancellations today
    prisma.subscriptionEvent.count({
      where: {
        processedAt: { gte: todayStart },
        eventType: { in: ['CANCELLATION', 'cancellation'] },
      },
    }),

    // renewals today
    prisma.subscriptionEvent.count({
      where: {
        processedAt: { gte: todayStart },
        eventType: { in: ['RENEWAL', 'renewal'] },
      },
    }),

    // comparison posts today
    prisma.comparisonPost.count({
      where: { createdAt: { gte: todayStart }, isDeleted: false },
    }),

    // live sessions today
    prisma.liveSession.count({ where: { createdAt: { gte: todayStart } } }),

    // expert reviews pending
    prisma.expertReview.count({ where: { status: 'pending' } }),

    // avg community score (all time, non-null)
    prisma.communityFeedback.aggregate({ _avg: { score: true } }),
  ]);

  // Compute DAU — union of outfit check users + feedback users today
  const dauUserIds = new Set(usersActiveToday.map(u => u.userId));
  const feedbackUserIds = await prisma.communityFeedback.findMany({
    where: { createdAt: { gte: todayStart } },
    select: { userId: true },
    distinct: ['userId'],
  });
  feedbackUserIds.forEach(u => dauUserIds.add(u.userId));
  const dau = dauUserIds.size;

  const wauUserIds = new Set(usersActiveThisWeek.map(u => u.userId));
  const wau = wauUserIds.size;

  // 7-day retention: users who were active between 8-14 days ago AND again today
  let retention7d: number | null = null;
  try {
    const eightDaysAgo = daysAgo(8);
    const fifteenDaysAgo = daysAgo(15);

    const cohortUsers = await prisma.outfitCheck.findMany({
      where: { createdAt: { gte: fifteenDaysAgo, lt: eightDaysAgo }, isDeleted: false },
      select: { userId: true },
      distinct: ['userId'],
    });
    if (cohortUsers.length > 0) {
      const cohortIds = cohortUsers.map(u => u.userId);
      const retainedCount = await prisma.outfitCheck.count({
        where: {
          userId: { in: cohortIds },
          createdAt: { gte: sevenDaysAgo },
          isDeleted: false,
        },
      });
      // Count distinct retained users
      const retained = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: cohortIds },
          createdAt: { gte: sevenDaysAgo },
          isDeleted: false,
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      retention7d = Math.round((retained.length / cohortUsers.length) * 100);
    }
  } catch {
    // non-fatal
  }

  return {
    generatedAt: new Date(),
    totalUsers,
    newUsersToday,
    freeUsers,
    plusUsers,
    proUsers,
    dau,
    wau,
    checksToday,
    feedbacksToday,
    avgAiScore: aiScoreAgg._avg.aiScore ?? null,
    usersWithStreak: streakStats._count.currentStreak,
    avgStreak: streakStats._avg.currentStreak ?? null,
    newSubscriptions,
    cancellations,
    renewals,
    comparisonPosts,
    liveSessions,
    retention7d,
    expertReviewsPending,
    avgCommunityScore: communityScoreAgg._avg.score ?? null,
  };
}

export async function storeDailySnapshot(metrics: MetricsSnapshot): Promise<void> {
  const date = startOfDay();
  await prisma.dailyMetricsSnapshot.upsert({
    where: { date },
    update: {
      totalUsers: metrics.totalUsers,
      newUsersToday: metrics.newUsersToday,
      freeUsers: metrics.freeUsers,
      plusUsers: metrics.plusUsers,
      proUsers: metrics.proUsers,
      dau: metrics.dau,
      wau: metrics.wau,
      checksToday: metrics.checksToday,
      feedbacksToday: metrics.feedbacksToday,
      avgAiScore: metrics.avgAiScore,
      usersWithStreak: metrics.usersWithStreak,
      avgStreak: metrics.avgStreak,
      newSubscriptions: metrics.newSubscriptions,
      cancellations: metrics.cancellations,
      renewals: metrics.renewals,
      comparisonPosts: metrics.comparisonPosts,
      liveSessions: metrics.liveSessions,
    },
    create: {
      date,
      totalUsers: metrics.totalUsers,
      newUsersToday: metrics.newUsersToday,
      freeUsers: metrics.freeUsers,
      plusUsers: metrics.plusUsers,
      proUsers: metrics.proUsers,
      dau: metrics.dau,
      wau: metrics.wau,
      checksToday: metrics.checksToday,
      feedbacksToday: metrics.feedbacksToday,
      avgAiScore: metrics.avgAiScore,
      usersWithStreak: metrics.usersWithStreak,
      avgStreak: metrics.avgStreak,
      newSubscriptions: metrics.newSubscriptions,
      cancellations: metrics.cancellations,
      renewals: metrics.renewals,
      comparisonPosts: metrics.comparisonPosts,
      liveSessions: metrics.liveSessions,
    },
  });
}

export async function getSnapshotHistory(days: number = 30) {
  const since = daysAgo(days);
  return prisma.dailyMetricsSnapshot.findMany({
    where: { date: { gte: since } },
    orderBy: { date: 'asc' },
  });
}
