import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockOutfitGroupBy = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: { findMany: mockUserFindMany },
    outfitCheck: { groupBy: mockOutfitGroupBy },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

import { runOnboardingOptimizer, getOnboardingSummary } from '../onboarding-optimizer.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUsers(specs: Array<{ id: string; username?: string | null }>) {
  return specs.map(s => ({ id: s.id, username: s.username ?? null }));
}

function makeGroupBy(userOutfitCounts: Record<string, number>) {
  return Object.entries(userOutfitCounts).map(([userId, count]) => ({
    userId,
    _count: { id: count },
  }));
}

beforeEach(() => {
  mockUserFindMany.mockReset();
  mockOutfitGroupBy.mockReset();
  mockPublishBus.mockReset();

  mockPublishBus.mockResolvedValue(undefined);

  // Default: 5 users, all completed profile, 3 did outfit checks, 2 are hooked
  mockUserFindMany.mockResolvedValue(
    makeUsers([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
      { id: 'u3', username: 'carol' },
      { id: 'u4', username: 'dave' },
      { id: 'u5', username: null }, // incomplete profile
    ])
  );
  mockOutfitGroupBy.mockResolvedValue(
    makeGroupBy({ u1: 5, u2: 3, u3: 1 })
  );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runOnboardingOptimizer', () => {
  it('publishes onboarding_metrics to the intelligence bus', async () => {
    await runOnboardingOptimizer();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'onboarding-optimizer',
      'onboarding_metrics',
      expect.objectContaining({
        cohort7d: expect.objectContaining({ step1_signedUp: expect.any(Number) }),
        cohort30d: expect.objectContaining({ step1_signedUp: expect.any(Number) }),
        dropOffRates: expect.objectContaining({ '7d': expect.any(Object), '30d': expect.any(Object) }),
      }),
    );
  });

  it('correctly counts step1_signedUp from user cohort', async () => {
    mockUserFindMany.mockResolvedValue(makeUsers([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
      { id: 'u3', username: null },
    ]));
    mockOutfitGroupBy.mockResolvedValue([]);

    await runOnboardingOptimizer();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.cohort7d.step1_signedUp).toBe(3);
  });

  it('counts step2_profileComplete only for users with a non-empty username', async () => {
    mockUserFindMany.mockResolvedValue(makeUsers([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: '' },
      { id: 'u3', username: null },
    ]));
    mockOutfitGroupBy.mockResolvedValue([]);

    await runOnboardingOptimizer();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.cohort7d.step2_profileComplete).toBe(1);
  });

  it('counts step3_firstOutfitCheck for users with >=1 outfit check', async () => {
    mockUserFindMany.mockResolvedValue(makeUsers([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
      { id: 'u3', username: 'carol' },
    ]));
    mockOutfitGroupBy.mockResolvedValue(makeGroupBy({ u1: 2, u2: 0, u3: 1 }));
    // Note: groupBy won't return u2 if count is 0, so only u1 and u3 appear
    mockOutfitGroupBy.mockResolvedValue(makeGroupBy({ u1: 2, u3: 1 }));

    await runOnboardingOptimizer();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.cohort7d.step3_firstOutfitCheck).toBe(2);
  });

  it('counts step4_hooked for users with >=3 outfit checks', async () => {
    mockUserFindMany.mockResolvedValue(makeUsers([
      { id: 'u1', username: 'a' },
      { id: 'u2', username: 'b' },
      { id: 'u3', username: 'c' },
    ]));
    mockOutfitGroupBy.mockResolvedValue(makeGroupBy({ u1: 5, u2: 2, u3: 3 }));

    await runOnboardingOptimizer();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.cohort7d.step4_hooked).toBe(2); // u1 (5) and u3 (3)
  });

  it('returns all zeros and does not crash when cohort is empty', async () => {
    mockUserFindMany.mockResolvedValue([]);

    await runOnboardingOptimizer();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.cohort7d).toEqual({
      step1_signedUp: 0,
      step2_profileComplete: 0,
      step3_firstOutfitCheck: 0,
      step4_hooked: 0,
    });
  });

  describe('drop-off rate calculation', () => {
    it('calculates drop-off as percentage of users lost between steps', async () => {
      // 4 users, 4 complete profile, 2 first check, 1 hooked
      mockUserFindMany.mockResolvedValue(makeUsers([
        { id: 'u1', username: 'a' },
        { id: 'u2', username: 'b' },
        { id: 'u3', username: 'c' },
        { id: 'u4', username: 'd' },
      ]));
      mockOutfitGroupBy.mockResolvedValue(makeGroupBy({ u1: 4, u2: 1 }));

      await runOnboardingOptimizer();

      const rates = mockPublishBus.mock.calls[0][2].dropOffRates['7d'];
      // step1to2: 4→4 = 0% drop
      expect(rates.step1to2).toBe(0);
      // step2to3: 4→2 = 50% drop
      expect(rates.step2to3).toBe(50);
      // step3to4: 2→1 = 50% drop
      expect(rates.step3to4).toBe(50);
    });

    it('returns null drop-off rate when the preceding step has 0 users', async () => {
      // Empty cohort → all nulls
      mockUserFindMany.mockResolvedValue([]);

      await runOnboardingOptimizer();

      const rates = mockPublishBus.mock.calls[0][2].dropOffRates['7d'];
      expect(rates.step1to2).toBeNull();
      expect(rates.step2to3).toBeNull();
      expect(rates.step3to4).toBeNull();
    });
  });

  it('runs two cohort queries (7d and 30d)', async () => {
    await runOnboardingOptimizer();

    // user.findMany called twice (once per cohort window)
    expect(mockUserFindMany).toHaveBeenCalledTimes(2);
  });

  it('resolves without throwing when bus publish fails', async () => {
    mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

    await expect(runOnboardingOptimizer()).resolves.toBeUndefined();
  });
});

describe('getOnboardingSummary', () => {
  it('returns day7Completion as percentage of signups who did first outfit check', async () => {
    mockUserFindMany.mockResolvedValue(makeUsers([
      { id: 'u1', username: 'a' },
      { id: 'u2', username: 'b' },
      { id: 'u3', username: 'c' },
      { id: 'u4', username: 'd' },
    ]));
    mockOutfitGroupBy.mockResolvedValue(makeGroupBy({ u1: 1, u2: 1 }));

    const result = await getOnboardingSummary();

    // 2 out of 4 did first check = 50%
    expect(result.day7Completion).toBe(50);
  });

  it('returns 0 when cohort is empty (no signups in 7d)', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const result = await getOnboardingSummary();

    expect(result.day7Completion).toBe(0);
  });

  it('returns { day7Completion: 0 } when DB query throws', async () => {
    mockUserFindMany.mockRejectedValue(new Error('DB error'));

    const result = await getOnboardingSummary();

    expect(result).toEqual({ day7Completion: 0 });
  });
});
