import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockUserCount = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockOutfitAggregate = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockCommunityFeedbackCount = vi.hoisted(() => vi.fn());
const mockCommunityFeedbackAggregate = vi.hoisted(() => vi.fn());
const mockCommunityFeedbackFindMany = vi.hoisted(() => vi.fn());
const mockUserStatsAggregate = vi.hoisted(() => vi.fn());
const mockSubscriptionEventCount = vi.hoisted(() => vi.fn());
const mockComparisonPostCount = vi.hoisted(() => vi.fn());
const mockLiveSessionCount = vi.hoisted(() => vi.fn());
const mockExpertReviewCount = vi.hoisted(() => vi.fn());
const mockReportCount = vi.hoisted(() => vi.fn());
const mockDailyMetricsSnapshotUpsert = vi.hoisted(() => vi.fn());
const mockDailyMetricsSnapshotFindMany = vi.hoisted(() => vi.fn());
const mockGet5xxCount = vi.hoisted(() => vi.fn());
const mockGetAiCounters = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      count: mockUserCount,
    },
    outfitCheck: {
      count: mockOutfitCount,
      aggregate: mockOutfitAggregate,
      findMany: mockOutfitFindMany,
    },
    communityFeedback: {
      count: mockCommunityFeedbackCount,
      aggregate: mockCommunityFeedbackAggregate,
      findMany: mockCommunityFeedbackFindMany,
    },
    userStats: {
      aggregate: mockUserStatsAggregate,
    },
    subscriptionEvent: {
      count: mockSubscriptionEventCount,
    },
    comparisonPost: {
      count: mockComparisonPostCount,
    },
    liveSession: {
      count: mockLiveSessionCount,
    },
    expertReview: {
      count: mockExpertReviewCount,
    },
    report: {
      count: mockReportCount,
    },
    dailyMetricsSnapshot: {
      upsert: mockDailyMetricsSnapshotUpsert,
      findMany: mockDailyMetricsSnapshotFindMany,
    },
  },
}));

vi.mock('../../middleware/errorHandler.js', () => ({
  get5xxCount: mockGet5xxCount,
}));

vi.mock('../ai-feedback.service.js', () => ({
  getAiCounters: mockGetAiCounters,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  getMetricsSnapshot,
  storeDailySnapshot,
  getSnapshotHistory,
  type MetricsSnapshot,
} from '../metrics.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // user.count called 5 times in Promise.all:
  //   1st: prisma.user.count()                          → totalUsers
  //   2nd: prisma.user.count({ where: { createdAt } })  → newUsersToday
  //   3rd: prisma.user.count({ where: { tier: 'free' } }) → freeUsers
  //   4th: prisma.user.count({ where: { tier: 'plus' } }) → plusUsers
  //   5th: prisma.user.count({ where: { tier: 'pro' } })  → proUsers
  mockUserCount.mockResolvedValue(100);

  // outfitCheck.count called once in Promise.all → checksToday
  mockOutfitCount.mockResolvedValue(10);

  // communityFeedback.count called once in Promise.all → feedbacksToday
  mockCommunityFeedbackCount.mockResolvedValue(5);

  // outfitCheck.aggregate called once in Promise.all → aiScoreAgg
  mockOutfitAggregate.mockResolvedValue({ _avg: { aiScore: 8.0 } });

  // outfitCheck.findMany called in Promise.all (usersActiveToday + usersActiveWeek)
  // and again for retention cohort queries — use a single default
  mockOutfitFindMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);

  // communityFeedback.findMany called after Promise.all for DAU union
  mockCommunityFeedbackFindMany.mockResolvedValue([{ userId: 'user-3' }]);

  // userStats.aggregate called once in Promise.all
  mockUserStatsAggregate.mockResolvedValue({
    _count: { currentStreak: 5 },
    _avg: { currentStreak: 3.2 },
  });

  // subscriptionEvent.count called 3 times in Promise.all:
  //   1st: INITIAL_PURCHASE  → newSubscriptions
  //   2nd: CANCELLATION      → cancellations
  //   3rd: RENEWAL           → renewals
  mockSubscriptionEventCount.mockResolvedValue(2);

  // comparisonPost.count called once in Promise.all
  mockComparisonPostCount.mockResolvedValue(3);

  // liveSession.count called once in Promise.all
  mockLiveSessionCount.mockResolvedValue(1);

  // expertReview.count called once in Promise.all
  mockExpertReviewCount.mockResolvedValue(0);

  // communityFeedback.aggregate called once in Promise.all → communityScoreAgg
  mockCommunityFeedbackAggregate.mockResolvedValue({ _avg: { score: 4.1 } });

  // report.count called once in Promise.all → pendingReportsOlderThan24h
  mockReportCount.mockResolvedValue(0);

  // In-memory counters
  mockGet5xxCount.mockReturnValue(0);
  mockGetAiCounters.mockReturnValue({ success: 90, fallback: 10 });

  // storeDailySnapshot
  mockDailyMetricsSnapshotUpsert.mockResolvedValue({});

  // getSnapshotHistory
  mockDailyMetricsSnapshotFindMany.mockResolvedValue([]);
});

// ─── getMetricsSnapshot ───────────────────────────────────────────────────────

describe('getMetricsSnapshot', () => {
  it('returns an object with totalUsers, dau, wau, checksToday, errorCount5xx, and aiFallbackRate fields', async () => {
    const snapshot = await getMetricsSnapshot();

    expect(snapshot).toHaveProperty('totalUsers');
    expect(snapshot).toHaveProperty('dau');
    expect(snapshot).toHaveProperty('wau');
    expect(snapshot).toHaveProperty('checksToday');
    expect(snapshot).toHaveProperty('errorCount5xx');
    expect(snapshot).toHaveProperty('aiFallbackRate');
  });

  it('calculates aiFallbackRate as 10 when counters are { success: 90, fallback: 10 }', async () => {
    mockGetAiCounters.mockReturnValue({ success: 90, fallback: 10 });

    const snapshot = await getMetricsSnapshot();

    // fallback / (success + fallback) × 100 = 10 / 100 × 100 = 10
    expect(snapshot.aiFallbackRate).toBe(10);
  });

  it('returns null for aiFallbackRate when success + fallback === 0', async () => {
    mockGetAiCounters.mockReturnValue({ success: 0, fallback: 0 });

    const snapshot = await getMetricsSnapshot();

    expect(snapshot.aiFallbackRate).toBeNull();
  });

  it('computes dau as the union of outfit check users and community feedback users', async () => {
    // outfit check users active today: user-1, user-2 (2 distinct)
    // community feedback users today:  user-3       (1 new distinct)
    // union size = 3
    mockOutfitFindMany
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }]) // usersActiveToday (DAU)
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }]) // usersActiveThisWeek (WAU)
      .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);    // retention findMany calls

    mockCommunityFeedbackFindMany.mockResolvedValue([{ userId: 'user-3' }]);

    const snapshot = await getMetricsSnapshot();

    expect(snapshot.dau).toBe(3);
  });

  it('returns null for retention7d when cohort findMany returns empty array', async () => {
    // Return active users for DAU / WAU queries, then empty for retention cohort
    mockOutfitFindMany
      .mockResolvedValueOnce([{ userId: 'user-1' }]) // usersActiveToday → DAU
      .mockResolvedValueOnce([{ userId: 'user-1' }]) // usersActiveThisWeek → WAU
      .mockResolvedValueOnce([])                     // cohortUsers (8-15 days ago) → empty → null
      .mockResolvedValue([]);                        // any further calls

    const snapshot = await getMetricsSnapshot();

    expect(snapshot.retention7d).toBeNull();
  });

  it('does not throw when the retention query rejects (non-fatal try/catch)', async () => {
    mockOutfitFindMany
      .mockResolvedValueOnce([{ userId: 'user-1' }]) // usersActiveToday → DAU
      .mockResolvedValueOnce([{ userId: 'user-1' }]) // usersActiveThisWeek → WAU
      .mockRejectedValueOnce(new Error('DB connection lost')); // cohort query → error swallowed

    const snapshot = await getMetricsSnapshot();

    expect(snapshot.retention7d).toBeNull();
    expect(snapshot.totalUsers).toBe(100); // rest of snapshot still populated
  });
});

// ─── storeDailySnapshot ───────────────────────────────────────────────────────

describe('storeDailySnapshot', () => {
  it('calls dailyMetricsSnapshot.upsert with totalUsers and checksToday from the provided metrics', async () => {
    const metrics: MetricsSnapshot = {
      generatedAt: new Date(),
      totalUsers: 200,
      newUsersToday: 5,
      freeUsers: 150,
      plusUsers: 40,
      proUsers: 10,
      dau: 30,
      wau: 120,
      checksToday: 42,
      feedbacksToday: 7,
      avgAiScore: 7.5,
      usersWithStreak: 10,
      avgStreak: 3.0,
      newSubscriptions: 3,
      cancellations: 1,
      renewals: 2,
      comparisonPosts: 5,
      liveSessions: 2,
      retention7d: 60,
      expertReviewsPending: 0,
      avgCommunityScore: 4.2,
      errorCount5xx: 0,
      aiFallbackRate: 5,
      pendingReportsOlderThan24h: 0,
    };

    await storeDailySnapshot(metrics);

    expect(mockDailyMetricsSnapshotUpsert).toHaveBeenCalledOnce();
    const callArgs = mockDailyMetricsSnapshotUpsert.mock.calls[0][0];
    expect(callArgs.create.totalUsers).toBe(200);
    expect(callArgs.create.checksToday).toBe(42);
    expect(callArgs.update.totalUsers).toBe(200);
    expect(callArgs.update.checksToday).toBe(42);
  });

  it('returns undefined (void)', async () => {
    const metrics: MetricsSnapshot = {
      generatedAt: new Date(),
      totalUsers: 50,
      newUsersToday: 1,
      freeUsers: 40,
      plusUsers: 8,
      proUsers: 2,
      dau: 5,
      wau: 20,
      checksToday: 8,
      feedbacksToday: 2,
      avgAiScore: null,
      usersWithStreak: 3,
      avgStreak: null,
      newSubscriptions: 0,
      cancellations: 0,
      renewals: 0,
      comparisonPosts: 0,
      liveSessions: 0,
      retention7d: null,
      expertReviewsPending: 0,
      avgCommunityScore: null,
      errorCount5xx: 0,
      aiFallbackRate: null,
      pendingReportsOlderThan24h: 0,
    };

    const result = await storeDailySnapshot(metrics);

    expect(result).toBeUndefined();
  });
});

// ─── getSnapshotHistory ───────────────────────────────────────────────────────

describe('getSnapshotHistory', () => {
  it('calls dailyMetricsSnapshot.findMany with a date filter (gte)', async () => {
    await getSnapshotHistory(30);

    expect(mockDailyMetricsSnapshotFindMany).toHaveBeenCalledOnce();
    const callArgs = mockDailyMetricsSnapshotFindMany.mock.calls[0][0];
    expect(callArgs).toHaveProperty('where.date.gte');
    expect(callArgs.where.date.gte).toBeInstanceOf(Date);
  });

  it('returns the array returned by dailyMetricsSnapshot.findMany', async () => {
    const fakeRows = [
      { date: new Date('2026-02-01'), totalUsers: 80, checksToday: 15 },
      { date: new Date('2026-02-02'), totalUsers: 85, checksToday: 18 },
    ];
    mockDailyMetricsSnapshotFindMany.mockResolvedValue(fakeRows);

    const result = await getSnapshotHistory(7);

    expect(result).toBe(fakeRows);
    expect(result).toHaveLength(2);
  });
});
