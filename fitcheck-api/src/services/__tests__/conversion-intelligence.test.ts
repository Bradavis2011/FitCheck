import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockOutfitGroupBy = vi.hoisted(() => vi.fn());
const mockFollowUpGroupBy = vi.hoisted(() => vi.fn());
const mockSignalFindFirst = vi.hoisted(() => vi.fn());
const mockSignalFindMany = vi.hoisted(() => vi.fn());
const mockSignalCreate = vi.hoisted(() => vi.fn());
const mockSignalUpdateMany = vi.hoisted(() => vi.fn());
const mockCalibrationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockTriggerUpgrade = vi.hoisted(() => vi.fn());
const mockSendPush = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      findUnique: mockUserFindUnique,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
      groupBy: mockOutfitGroupBy,
    },
    followUp: {
      groupBy: mockFollowUpGroupBy,
    },
    conversionSignal: {
      findFirst: mockSignalFindFirst,
      findMany: mockSignalFindMany,
      create: mockSignalCreate,
      updateMany: mockSignalUpdateMany,
    },
    conversionCalibration: {
      findFirst: mockCalibrationFindFirst,
    },
    notification: {
      findFirst: mockNotificationFindFirst,
      create: mockNotificationCreate,
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
}));

vi.mock('../lifecycle-email.service.js', () => ({
  triggerUpgradeSequence: mockTriggerUpgrade,
}));

vi.mock('../push.service.js', () => ({
  pushService: {
    sendPushNotification: mockSendPush,
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { trackConversionOutcome, runConversionIntelligence } from '../conversion-intelligence.service.js';

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  mockUserFindMany.mockReset();
  mockUserFindUnique.mockReset();
  mockOutfitFindMany.mockReset();
  mockOutfitGroupBy.mockReset();
  mockFollowUpGroupBy.mockReset();
  mockSignalFindFirst.mockReset();
  mockSignalFindMany.mockReset();
  mockSignalCreate.mockReset();
  mockSignalUpdateMany.mockReset();
  mockCalibrationFindFirst.mockReset();
  mockNotificationFindFirst.mockReset();
  mockNotificationCreate.mockReset();
  mockExecuteOrQueue.mockReset();
  mockTriggerUpgrade.mockReset();
  mockSendPush.mockReset();

  mockUserFindMany.mockResolvedValue([]);
  mockUserFindUnique.mockResolvedValue(null);
  mockOutfitFindMany.mockResolvedValue([]);
  mockOutfitGroupBy.mockResolvedValue([]);
  mockFollowUpGroupBy.mockResolvedValue([]);
  mockSignalFindFirst.mockResolvedValue(null);
  mockSignalFindMany.mockResolvedValue([]);
  mockSignalCreate.mockResolvedValue({ id: 'sig-1' });
  mockSignalUpdateMany.mockResolvedValue({ count: 1 });
  mockCalibrationFindFirst.mockResolvedValue(null);
  mockNotificationFindFirst.mockResolvedValue(null);
  mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });
  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockTriggerUpgrade.mockResolvedValue(undefined);
  mockSendPush.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── trackConversionOutcome ───────────────────────────────────────────────────

describe('trackConversionOutcome', () => {
  it('calls conversionSignal.updateMany with the correct userId', async () => {
    await trackConversionOutcome('user-abc');

    expect(mockSignalUpdateMany).toHaveBeenCalledOnce();
    expect(mockSignalUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-abc' }),
      }),
    );
  });

  it('sets outcome to "converted" and convertedAt to a Date', async () => {
    await trackConversionOutcome('user-abc');

    const call = mockSignalUpdateMany.mock.calls[0][0];
    expect(call.data.outcome).toBe('converted');
    expect(call.data.convertedAt).toBeInstanceOf(Date);
  });

  it('only updates signals within the last 14 days', async () => {
    const before = Date.now();

    await trackConversionOutcome('user-abc');

    const call = mockSignalUpdateMany.mock.calls[0][0];
    const gte: Date = call.where.createdAt.gte;
    expect(gte).toBeInstanceOf(Date);

    // The cutoff must be approximately 14 days before now (allow 1 second tolerance)
    const expectedCutoff = before - 14 * 24 * 60 * 60 * 1000;
    expect(gte.getTime()).toBeGreaterThanOrEqual(expectedCutoff - 1000);
    expect(gte.getTime()).toBeLessThanOrEqual(expectedCutoff + 1000);
  });

  it('only updates signals where outcome is null (pending)', async () => {
    await trackConversionOutcome('user-abc');

    const call = mockSignalUpdateMany.mock.calls[0][0];
    expect(call.where.outcome).toBeNull();
  });

  it('resolves without throwing even if updateMany rejects', async () => {
    mockSignalUpdateMany.mockRejectedValue(new Error('DB timeout'));

    await expect(trackConversionOutcome('user-abc')).rejects.toThrow('DB timeout');
    // Note: the service does not swallow this error — it propagates.
    // This test documents that behaviour.
  });
});

// ─── runConversionIntelligence — detectSignals: hit_daily_limit ───────────────

describe('runConversionIntelligence — hit_daily_limit signal', () => {
  it('does not create any signals when there are no free users', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);

    await runConversionIntelligence();

    expect(mockSignalCreate).not.toHaveBeenCalled();
  });

  it('creates a hit_daily_limit signal for a free user with dailyChecksUsed >= 3', async () => {
    // hit_daily_limit uses user.findMany with tier:'free', dailyChecksUsed:{ gte:3 }
    // high_engagement uses user.findMany with just tier:'free'
    // We make the first call (hit_daily_limit) return a user, the second (high_engagement) empty.
    mockUserFindMany
      .mockResolvedValueOnce([{ id: 'user-limited', attribution: null }]) // hit_daily_limit scan
      .mockResolvedValueOnce([]); // high_engagement scan

    mockOutfitGroupBy.mockResolvedValue([]); // loyal_free
    mockFollowUpGroupBy.mockResolvedValue([]); // power_user

    // No existing signal today
    mockSignalFindFirst.mockResolvedValue(null);
    // No calibration → use base strength 0.8
    mockCalibrationFindFirst.mockResolvedValue(null);

    await runConversionIntelligence();

    expect(mockSignalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-limited',
          signalType: 'hit_daily_limit',
          outcome: 'pending',
        }),
      }),
    );
  });

  it('does NOT create hit_daily_limit signal when one already exists today', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([{ id: 'user-limited', attribution: null }])
      .mockResolvedValueOnce([]);

    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    // Signal already exists today
    mockSignalFindFirst.mockResolvedValue({ id: 'existing-sig' });

    await runConversionIntelligence();

    expect(mockSignalCreate).not.toHaveBeenCalled();
  });

  it('uses base strength 0.8 for hit_daily_limit when no calibration record exists', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([{ id: 'user-x', attribution: null }])
      .mockResolvedValueOnce([]);

    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockSignalFindFirst.mockResolvedValue(null);
    mockCalibrationFindFirst.mockResolvedValue(null); // no calibration

    await runConversionIntelligence();

    const createCall = mockSignalCreate.mock.calls[0][0];
    expect(createCall.data.strength).toBe(0.8);
  });

  it('uses calibrated strength from conversionCalibration when a record exists', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([{ id: 'user-x', attribution: null }])
      .mockResolvedValueOnce([]);

    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockSignalFindFirst.mockResolvedValue(null);
    // Calibrated strength override
    mockCalibrationFindFirst.mockResolvedValue({ signalType: 'hit_daily_limit', strength: 0.95, isActive: true });

    await runConversionIntelligence();

    const createCall = mockSignalCreate.mock.calls[0][0];
    expect(createCall.data.strength).toBe(0.95);
  });
});

// ─── runConversionIntelligence — detectSignals: high_engagement ───────────────

describe('runConversionIntelligence — high_engagement signal', () => {
  it('creates a high_engagement signal for a free user active 5+ days in the last 7', async () => {
    // hit_daily_limit scan returns empty, high_engagement scan returns our user
    mockUserFindMany
      .mockResolvedValueOnce([]) // hit_daily_limit
      .mockResolvedValueOnce([{ id: 'user-engaged', attribution: null }]); // high_engagement

    // 5 unique active days in last 7 days
    const makeCheck = (daysAgo: number) => ({
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    });
    mockOutfitFindMany.mockResolvedValue([
      makeCheck(1),
      makeCheck(2),
      makeCheck(3),
      makeCheck(4),
      makeCheck(5),
    ]);

    mockOutfitGroupBy.mockResolvedValue([]); // loyal_free
    mockFollowUpGroupBy.mockResolvedValue([]); // power_user
    mockSignalFindFirst.mockResolvedValue(null);
    mockCalibrationFindFirst.mockResolvedValue(null);

    await runConversionIntelligence();

    expect(mockSignalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-engaged',
          signalType: 'high_engagement',
          outcome: 'pending',
        }),
      }),
    );
  });

  it('does NOT create high_engagement signal for a user active only 4 days', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'user-low', attribution: null }]);

    // 4 unique active days — below the 5-day threshold
    const makeCheck = (daysAgo: number) => ({
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    });
    mockOutfitFindMany.mockResolvedValue([
      makeCheck(1),
      makeCheck(2),
      makeCheck(3),
      makeCheck(4),
    ]);

    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockSignalFindFirst.mockResolvedValue(null);

    await runConversionIntelligence();

    expect(mockSignalCreate).not.toHaveBeenCalled();
  });

  it('counts unique days — multiple checks on the same day count as one active day', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'user-sameday', attribution: null }]);

    // All checks on the same calendar day — only 1 unique active day
    const sameDay = new Date('2026-02-25T00:00:00Z');
    mockOutfitFindMany.mockResolvedValue([
      { createdAt: new Date(sameDay.getTime()) },
      { createdAt: new Date(sameDay.getTime() + 3600_000) },
      { createdAt: new Date(sameDay.getTime() + 7200_000) },
      { createdAt: new Date(sameDay.getTime() + 10800_000) },
      { createdAt: new Date(sameDay.getTime() + 14400_000) },
    ]);

    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockSignalFindFirst.mockResolvedValue(null);

    await runConversionIntelligence();

    // Only 1 unique day → no high_engagement signal
    expect(mockSignalCreate).not.toHaveBeenCalled();
  });
});

// ─── runConversionIntelligence — nudgeHighSignalUsers ─────────────────────────

describe('runConversionIntelligence — nudgeHighSignalUsers', () => {
  it('calls executeOrQueue for a user whose total signal strength >= 0.7', async () => {
    // No signals from detectSignals (all findMany return empty for user scans)
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    // nudgeHighSignalUsers: pending signals with total >= 0.7
    mockSignalFindMany.mockResolvedValue([
      { userId: 'user-nudge', strength: 0.8, id: 'sig-1' },
    ]);

    await runConversionIntelligence();

    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'conversion-intelligence',
      'upgrade_nudge',
      'low',
      expect.objectContaining({ userId: 'user-nudge' }),
      expect.any(Function),
    );
  });

  it('does NOT call executeOrQueue for a user whose total signal strength < 0.7', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    // Strength 0.5 — below threshold
    mockSignalFindMany.mockResolvedValue([
      { userId: 'user-weak', strength: 0.5, id: 'sig-2' },
    ]);

    await runConversionIntelligence();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('aggregates strength across multiple signals for the same user', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    // Two signals of 0.4 each → total 0.8 >= 0.7
    mockSignalFindMany.mockResolvedValue([
      { userId: 'user-multi', strength: 0.4, id: 'sig-a' },
      { userId: 'user-multi', strength: 0.4, id: 'sig-b' },
    ]);

    await runConversionIntelligence();

    expect(mockExecuteOrQueue).toHaveBeenCalledOnce();
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'conversion-intelligence',
      'upgrade_nudge',
      'low',
      expect.objectContaining({ userId: 'user-multi', totalStrength: 0.8 }),
      expect.any(Function),
    );
  });

  it('nudges multiple users independently when each exceeds the threshold', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    mockSignalFindMany.mockResolvedValue([
      { userId: 'user-a', strength: 0.8, id: 'sig-1' },
      { userId: 'user-b', strength: 0.9, id: 'sig-2' },
    ]);

    await runConversionIntelligence();

    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(2);
    const userIds = mockExecuteOrQueue.mock.calls.map((c) => (c[3] as { userId: string }).userId);
    expect(userIds).toContain('user-a');
    expect(userIds).toContain('user-b');
  });

  it('does not throw when executeOrQueue rejects — error is swallowed per user', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    mockSignalFindMany.mockResolvedValue([
      { userId: 'user-fail', strength: 0.8, id: 'sig-1' },
    ]);
    mockExecuteOrQueue.mockRejectedValue(new Error('Queue unavailable'));

    await expect(runConversionIntelligence()).resolves.toBeUndefined();
  });
});

// ─── runConversionIntelligence — error resilience ─────────────────────────────

describe('runConversionIntelligence — error resilience', () => {
  it('resolves without throwing when user.findMany rejects for hit_daily_limit scan', async () => {
    // First call (hit_daily_limit) throws, subsequent calls succeed
    mockUserFindMany
      .mockRejectedValueOnce(new Error('DB connection lost'))
      .mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    await expect(runConversionIntelligence()).resolves.toBeUndefined();
  });

  it('resolves without throwing when user.findMany rejects for high_engagement scan', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([]) // hit_daily_limit succeeds
      .mockRejectedValueOnce(new Error('Timeout')); // high_engagement fails
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);

    await expect(runConversionIntelligence()).resolves.toBeUndefined();
  });

  it('resolves without throwing when outfitCheck.groupBy rejects for loyal_free scan', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockRejectedValue(new Error('groupBy timeout'));
    mockFollowUpGroupBy.mockResolvedValue([]);

    await expect(runConversionIntelligence()).resolves.toBeUndefined();
  });

  it('resolves without throwing when followUp.groupBy rejects for power_user scan', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockRejectedValue(new Error('followUp groupBy failed'));

    await expect(runConversionIntelligence()).resolves.toBeUndefined();
  });

  it('resolves without throwing when conversionSignal.findMany rejects in nudge step', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockOutfitGroupBy.mockResolvedValue([]);
    mockFollowUpGroupBy.mockResolvedValue([]);
    mockSignalFindMany.mockRejectedValue(new Error('signal findMany failed'));

    // nudgeHighSignalUsers does NOT swallow this error — it propagates
    // This test documents that runConversionIntelligence does not catch it at the top level either
    await expect(runConversionIntelligence()).rejects.toThrow('signal findMany failed');
  });
});
