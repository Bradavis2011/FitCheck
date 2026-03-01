import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockMilestoneCreate = vi.hoisted(() => vi.fn());
const mockMilestoneFindMany = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockOutfitGroupBy = vi.hoisted(() => vi.fn());
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockCanSend = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    milestoneMessage: {
      create: mockMilestoneCreate,
      findMany: mockMilestoneFindMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
    outfitCheck: {
      groupBy: mockOutfitGroupBy,
      findFirst: mockOutfitFindFirst,
    },
  },
}));

vi.mock('../event-followup.service.js', () => ({
  canSendRelationshipNotification: mockCanSend,
}));

vi.mock('../../controllers/notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

import {
  checkMilestones,
  runMilestoneScanner,
  measureMilestoneMetrics,
} from '../milestone-message.service.js';

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  mockMilestoneCreate.mockReset();
  mockMilestoneFindMany.mockReset();
  mockUserFindMany.mockReset();
  mockOutfitGroupBy.mockReset();
  mockOutfitFindFirst.mockReset();
  mockCanSend.mockReset();
  mockCreateNotification.mockReset();
  mockPublishBus.mockReset();

  mockMilestoneCreate.mockResolvedValue({ id: 'ms-1' });
  mockMilestoneFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
  mockOutfitGroupBy.mockResolvedValue([]);
  mockOutfitFindFirst.mockResolvedValue(null);
  mockCanSend.mockResolvedValue(true);
  mockCreateNotification.mockResolvedValue({ id: 'notif-1' });
  mockPublishBus.mockResolvedValue(undefined);
});

// ─── checkMilestones ──────────────────────────────────────────────────────────

describe('checkMilestones', () => {
  it('fires 10th_outfit when outfitCount === 10', async () => {
    await checkMilestones('user-1', { outfitCount: 10 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', milestoneKey: '10th_outfit' }),
      }),
    );
  });

  it('does NOT fire 10th_outfit when outfitCount === 11', async () => {
    await checkMilestones('user-1', { outfitCount: 11 });

    const calls = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(calls).not.toContain('10th_outfit');
  });

  it('fires 25th_outfit when outfitCount === 25', async () => {
    await checkMilestones('user-1', { outfitCount: 25 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', milestoneKey: '25th_outfit' }),
      }),
    );
  });

  it('fires first_9_plus when latestScore === 9.5', async () => {
    await checkMilestones('user-1', { latestScore: 9.5 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', milestoneKey: 'first_9_plus' }),
      }),
    );
  });

  it('fires first_9_plus when latestScore === 9.0 (boundary)', async () => {
    await checkMilestones('user-1', { latestScore: 9.0 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ milestoneKey: 'first_9_plus' }),
      }),
    );
  });

  it('does NOT fire first_9_plus when latestScore === 8.9', async () => {
    await checkMilestones('user-1', { latestScore: 8.9 });

    const calls = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(calls).not.toContain('first_9_plus');
  });

  it('fires 7_day_streak when currentStreak === 7', async () => {
    await checkMilestones('user-1', { currentStreak: 7 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', milestoneKey: '7_day_streak' }),
      }),
    );
  });

  it('fires 30_day_streak when currentStreak === 30', async () => {
    await checkMilestones('user-1', { currentStreak: 30 });

    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', milestoneKey: '30_day_streak' }),
      }),
    );
  });

  it('fires multiple milestones in one call (outfitCount=10 AND currentStreak=7)', async () => {
    await checkMilestones('user-1', { outfitCount: 10, currentStreak: 7 });

    expect(mockMilestoneCreate).toHaveBeenCalledTimes(2);
    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys).toContain('10th_outfit');
    expect(keys).toContain('7_day_streak');
  });

  it('silently skips when milestoneMessage.create throws P2002 (duplicate)', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockMilestoneCreate.mockRejectedValue(p2002);

    await expect(checkMilestones('user-1', { outfitCount: 10 })).resolves.toBeUndefined();
    // canSend and createNotification must NOT be called — create already threw
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('does NOT send notification when canSendRelationshipNotification returns false', async () => {
    mockCanSend.mockResolvedValue(false);

    await checkMilestones('user-1', { outfitCount: 10 });

    expect(mockMilestoneCreate).toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('sends notification via createNotification when milestone fires', async () => {
    await checkMilestones('user-1', { outfitCount: 10 });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'milestone',
      }),
    );
  });

  it('does not throw when DB fails with a non-P2002 error', async () => {
    mockMilestoneCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(checkMilestones('user-1', { outfitCount: 10 })).resolves.toBeUndefined();
  });

  it('fires no milestones when context values are all non-triggering', async () => {
    await checkMilestones('user-1', { outfitCount: 5, latestScore: 7.0, currentStreak: 3 });

    expect(mockMilestoneCreate).not.toHaveBeenCalled();
  });
});

// ─── runMilestoneScanner ──────────────────────────────────────────────────────

describe('runMilestoneScanner', () => {
  it('fires first_month for users created in the 29-31 day window', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 'user-month-1' }, { id: 'user-month-2' }]);

    await runMilestoneScanner();

    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys.filter((k) => k === 'first_month')).toHaveLength(2);
    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-month-1', milestoneKey: 'first_month' }),
      }),
    );
  });

  it('fires score_improvement when recent avg >= prev avg + 1.0 and recent count >= 2', async () => {
    mockOutfitGroupBy
      .mockResolvedValueOnce([
        // recentChecks: userId=user-a, avg=8.0, count=3
        { userId: 'user-a', _avg: { aiScore: 8.0 }, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        // prevChecks: userId=user-a, avg=6.5
        { userId: 'user-a', _avg: { aiScore: 6.5 }, _count: { id: 2 } },
      ]);

    await runMilestoneScanner();

    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys).toContain('score_improvement');
    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-a', milestoneKey: 'score_improvement' }),
      }),
    );
  });

  it('does NOT fire score_improvement when improvement < 1.0', async () => {
    mockOutfitGroupBy
      .mockResolvedValueOnce([
        // recentChecks: avg=7.5, count=3
        { userId: 'user-b', _avg: { aiScore: 7.5 }, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        // prevChecks: avg=6.9 — diff is 0.6, below threshold
        { userId: 'user-b', _avg: { aiScore: 6.9 }, _count: { id: 3 } },
      ]);

    await runMilestoneScanner();

    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys).not.toContain('score_improvement');
  });

  it('does NOT fire score_improvement when recent count < 2', async () => {
    mockOutfitGroupBy
      .mockResolvedValueOnce([
        // recentChecks: only 1 outfit in last 7 days
        { userId: 'user-c', _avg: { aiScore: 9.0 }, _count: { id: 1 } },
      ])
      .mockResolvedValueOnce([
        { userId: 'user-c', _avg: { aiScore: 5.0 }, _count: { id: 4 } },
      ]);

    await runMilestoneScanner();

    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys).not.toContain('score_improvement');
  });

  it('does NOT fire score_improvement when user has no previous check data', async () => {
    mockOutfitGroupBy
      .mockResolvedValueOnce([
        // recentChecks: user with no prev record
        { userId: 'user-new', _avg: { aiScore: 8.0 }, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        // prevChecks: different user, user-new has no entry
        { userId: 'user-other', _avg: { aiScore: 5.0 }, _count: { id: 2 } },
      ]);

    await runMilestoneScanner();

    const keys = mockMilestoneCreate.mock.calls.map((c) => c[0].data.milestoneKey);
    expect(keys).not.toContain('score_improvement');
  });

  it('resolves without throwing on DB error in first_month scan', async () => {
    mockUserFindMany.mockRejectedValue(new Error('DB unavailable'));

    await expect(runMilestoneScanner()).resolves.toBeUndefined();
  });

  it('resolves without throwing on DB error in score_improvement scan', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockRejectedValue(new Error('groupBy failed'));

    await expect(runMilestoneScanner()).resolves.toBeUndefined();
  });

  it('fires no milestones when no users and no outfit data', async () => {
    await runMilestoneScanner();

    expect(mockMilestoneCreate).not.toHaveBeenCalled();
  });
});

// ─── measureMilestoneMetrics ──────────────────────────────────────────────────

describe('measureMilestoneMetrics', () => {
  it('does nothing when no milestones in last 30 days', async () => {
    mockMilestoneFindMany.mockResolvedValue([]);

    await measureMilestoneMetrics();

    expect(mockPublishBus).not.toHaveBeenCalled();
  });

  it('publishes milestone_metrics to bus with correct structure', async () => {
    const createdAt = new Date('2026-02-01T10:00:00Z');
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: '10th_outfit', createdAt },
      { userId: 'user-2', milestoneKey: '10th_outfit', createdAt },
    ]);
    mockOutfitFindFirst.mockResolvedValue(null); // no conversions

    await measureMilestoneMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ops-learning',
      'milestone_metrics',
      expect.objectContaining({
        measuredAt: expect.any(String),
        metrics: expect.arrayContaining([
          expect.objectContaining({
            milestoneKey: '10th_outfit',
            total: 2,
            conversionRate: 0,
          }),
        ]),
      }),
    );
  });

  it('marks converted when outfit check exists within 24h of milestone', async () => {
    const createdAt = new Date('2026-02-01T10:00:00Z');
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: '7_day_streak', createdAt },
    ]);
    // Simulate conversion: outfit check found within 24h
    mockOutfitFindFirst.mockResolvedValue({ id: 'outfit-convert' });

    await measureMilestoneMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ops-learning',
      'milestone_metrics',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            milestoneKey: '7_day_streak',
            total: 1,
            conversionRate: 1,
          }),
        ]),
      }),
    );
  });

  it('computes partial conversion rates correctly', async () => {
    const createdAt = new Date('2026-02-01T10:00:00Z');
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: 'first_9_plus', createdAt },
      { userId: 'user-2', milestoneKey: 'first_9_plus', createdAt },
      { userId: 'user-3', milestoneKey: 'first_9_plus', createdAt },
      { userId: 'user-4', milestoneKey: 'first_9_plus', createdAt },
    ]);
    // First two convert, last two do not
    mockOutfitFindFirst
      .mockResolvedValueOnce({ id: 'o-1' })
      .mockResolvedValueOnce({ id: 'o-2' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await measureMilestoneMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ops-learning',
      'milestone_metrics',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            milestoneKey: 'first_9_plus',
            total: 4,
            conversionRate: 0.5,
          }),
        ]),
      }),
    );
  });

  it('queries outfitCheck.findFirst with correct time window for each milestone', async () => {
    const createdAt = new Date('2026-02-01T12:00:00Z');
    const expectedWindow = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: '10th_outfit', createdAt },
    ]);

    await measureMilestoneMetrics();

    expect(mockOutfitFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          isDeleted: false,
          createdAt: expect.objectContaining({
            gte: createdAt,
            lte: expectedWindow,
          }),
        }),
      }),
    );
  });

  it('sets worstMilestone to null when no milestone type has >= 3 entries', async () => {
    const createdAt = new Date('2026-02-01T10:00:00Z');
    // Only 2 entries — below the threshold of 3 required for worstMilestone
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: '10th_outfit', createdAt },
      { userId: 'user-2', milestoneKey: '10th_outfit', createdAt },
    ]);
    mockOutfitFindFirst.mockResolvedValue(null);

    await measureMilestoneMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ops-learning',
      'milestone_metrics',
      expect.objectContaining({
        worstMilestone: null,
      }),
    );
  });

  it('identifies worstMilestone when a type has >= 3 entries and low conversion', async () => {
    const createdAt = new Date('2026-02-01T10:00:00Z');
    mockMilestoneFindMany.mockResolvedValue([
      { userId: 'user-1', milestoneKey: '30_day_streak', createdAt },
      { userId: 'user-2', milestoneKey: '30_day_streak', createdAt },
      { userId: 'user-3', milestoneKey: '30_day_streak', createdAt },
    ]);
    mockOutfitFindFirst.mockResolvedValue(null); // 0% conversion

    await measureMilestoneMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ops-learning',
      'milestone_metrics',
      expect.objectContaining({
        worstMilestone: '30_day_streak',
        worstConversionRate: null,
      }),
    );
  });
});
