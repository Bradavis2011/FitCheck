import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockStatsFindUnique = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockRiskUpsert = vi.hoisted(() => vi.fn());
const mockRiskFindUnique = vi.hoisted(() => vi.fn());
const mockRiskUpdate = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    userStats: { findUnique: mockStatsFindUnique },
    outfitCheck: {
      count: mockOutfitCount,
      findMany: mockOutfitFindMany,
      findFirst: mockOutfitFindFirst,
    },
    churnRiskScore: {
      upsert: mockRiskUpsert,
      findUnique: mockRiskFindUnique,
      update: mockRiskUpdate,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.mock('../../controllers/notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

import { computeChurnRisk } from '../churn-prediction.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<{
  tier: string;
  subscriptionExpiresAt: Date | null;
}> = {}) {
  return {
    tier: 'free',
    subscriptionExpiresAt: null,
    ...overrides,
  };
}

function makeStats(overrides: Partial<{
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}> = {}) {
  return {
    currentStreak: 1,
    longestStreak: 3,
    lastActiveDate: new Date(),
    ...overrides,
  };
}

const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const OLD_DATE = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);   // 10 days ago

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockStatsFindUnique.mockReset();
  mockOutfitCount.mockReset();
  mockOutfitFindMany.mockReset();
  mockOutfitFindFirst.mockReset();
  mockRiskUpsert.mockReset();
  mockRiskFindUnique.mockReset();
  mockRiskUpdate.mockReset();
  mockPublishBus.mockReset();
  mockCreateNotification.mockReset();

  // Default: healthy user with no risk signals
  mockUserFindUnique.mockResolvedValue(makeUser());
  mockStatsFindUnique.mockResolvedValue(makeStats());
  mockOutfitCount.mockResolvedValue(3);            // both 7d windows: 3 checks each
  mockOutfitFindMany.mockResolvedValue([           // last 5 checks: avg score 7
    { aiScore: 7 }, { aiScore: 7 }, { aiScore: 7 },
  ]);
  mockOutfitFindFirst.mockResolvedValue({ createdAt: RECENT_DATE }); // active recently
});

// ─── Tests: computeChurnRisk ──────────────────────────────────────────────────

describe('computeChurnRisk', () => {
  it('returns score 0 and empty factors when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await computeChurnRisk('user-missing');

    expect(result).toEqual({ score: 0, factors: [] });
  });

  it('returns score 0 for a healthy active user with no risk signals', async () => {
    const result = await computeChurnRisk('user-healthy');

    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  describe('Signal 1: declining usage (+0.30)', () => {
    it('fires when last 7d checks are < 50% of prior 7d checks', async () => {
      // prev7d = 6, last7d = 2  →  2 < 6 * 0.5 = 3  ✓
      mockOutfitCount
        .mockResolvedValueOnce(2)  // last7d
        .mockResolvedValueOnce(6); // prev7d

      const result = await computeChurnRisk('user-1');

      expect(result.score).toBeCloseTo(0.3, 5);
      expect(result.factors.some(f => f.startsWith('declining_usage'))).toBe(true);
    });

    it('does not fire when prev7d is 0 (avoids divide-by-zero)', async () => {
      mockOutfitCount
        .mockResolvedValueOnce(0) // last7d
        .mockResolvedValueOnce(0); // prev7d = 0 → signal should not fire

      const result = await computeChurnRisk('user-1');

      expect(result.factors.some(f => f.startsWith('declining_usage'))).toBe(false);
    });

    it('does not fire when last7d >= 50% of prev7d', async () => {
      mockOutfitCount
        .mockResolvedValueOnce(4) // last7d
        .mockResolvedValueOnce(6); // prev7d  →  4 >= 3  ✗

      const result = await computeChurnRisk('user-1');

      expect(result.factors.some(f => f.startsWith('declining_usage'))).toBe(false);
    });
  });

  describe('Signal 2: inactive for 5+ days (+0.25)', () => {
    it('fires when last outfit was more than 5 days ago', async () => {
      mockOutfitFindFirst.mockResolvedValue({ createdAt: OLD_DATE });

      const result = await computeChurnRisk('user-1');

      expect(result.score).toBeGreaterThanOrEqual(0.25);
      expect(result.factors).toContain('inactive_5d');
    });

    it('fires when no outfit check exists at all', async () => {
      mockOutfitFindFirst.mockResolvedValue(null);

      const result = await computeChurnRisk('user-1');

      expect(result.factors).toContain('inactive_5d');
    });

    it('does not fire when last outfit was recent', async () => {
      mockOutfitFindFirst.mockResolvedValue({ createdAt: RECENT_DATE });

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('inactive_5d');
    });
  });

  describe('Signal 3: low average score (+0.20)', () => {
    it('fires when avg of last 5 checks is below 5 and there are >= 3 checks', async () => {
      mockOutfitFindMany.mockResolvedValue([
        { aiScore: 3 }, { aiScore: 4 }, { aiScore: 2 },
      ]);

      const result = await computeChurnRisk('user-1');

      expect(result.factors.some(f => f.startsWith('low_avg_score'))).toBe(true);
    });

    it('does not fire with fewer than 3 checks', async () => {
      mockOutfitFindMany.mockResolvedValue([
        { aiScore: 2 }, { aiScore: 2 },
      ]);

      const result = await computeChurnRisk('user-1');

      expect(result.factors.some(f => f.startsWith('low_avg_score'))).toBe(false);
    });

    it('does not fire when avg score is >= 5', async () => {
      mockOutfitFindMany.mockResolvedValue([
        { aiScore: 6 }, { aiScore: 6 }, { aiScore: 6 },
      ]);

      const result = await computeChurnRisk('user-1');

      expect(result.factors.some(f => f.startsWith('low_avg_score'))).toBe(false);
    });
  });

  describe('Signal 4: subscription expiring soon (+0.15)', () => {
    it('fires for a paid user with subscription expiring within 7 days', async () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
      mockUserFindUnique.mockResolvedValue(makeUser({ tier: 'plus', subscriptionExpiresAt: expiresAt }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).toContain('subscription_expiring_7d');
    });

    it('does not fire for free users', async () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      mockUserFindUnique.mockResolvedValue(makeUser({ tier: 'free', subscriptionExpiresAt: expiresAt }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('subscription_expiring_7d');
    });

    it('does not fire when subscription has already expired', async () => {
      const expiresAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      mockUserFindUnique.mockResolvedValue(makeUser({ tier: 'plus', subscriptionExpiresAt: expiresAt }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('subscription_expiring_7d');
    });

    it('does not fire when subscription expires beyond 7 days', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days out
      mockUserFindUnique.mockResolvedValue(makeUser({ tier: 'plus', subscriptionExpiresAt: expiresAt }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('subscription_expiring_7d');
    });
  });

  describe('Signal 5: broken streak (+0.10)', () => {
    it('fires when user had a long streak but it is now 0', async () => {
      mockStatsFindUnique.mockResolvedValue(makeStats({ currentStreak: 0, longestStreak: 5 }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).toContain('streak_broken');
    });

    it('does not fire when longestStreak is less than 3', async () => {
      mockStatsFindUnique.mockResolvedValue(makeStats({ currentStreak: 0, longestStreak: 2 }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('streak_broken');
    });

    it('does not fire when current streak is still active', async () => {
      mockStatsFindUnique.mockResolvedValue(makeStats({ currentStreak: 4, longestStreak: 10 }));

      const result = await computeChurnRisk('user-1');

      expect(result.factors).not.toContain('streak_broken');
    });

    it('uses default streak values of 0 when userStats record does not exist', async () => {
      mockStatsFindUnique.mockResolvedValue(null);

      const result = await computeChurnRisk('user-1');

      // longestStreak defaults to 0 → signal should not fire
      expect(result.factors).not.toContain('streak_broken');
    });
  });

  describe('Score accumulation', () => {
    it('clamps score at 1.0 when all signals fire simultaneously', async () => {
      // Signal 1: declining
      mockOutfitCount.mockResolvedValueOnce(1).mockResolvedValueOnce(10);
      // Signal 2: inactive
      mockOutfitFindFirst.mockResolvedValue({ createdAt: OLD_DATE });
      // Signal 3: low score
      mockOutfitFindMany.mockResolvedValue([{ aiScore: 2 }, { aiScore: 2 }, { aiScore: 2 }]);
      // Signal 4: expiring subscription
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      mockUserFindUnique.mockResolvedValue(makeUser({ tier: 'plus', subscriptionExpiresAt: expiresAt }));
      // Signal 5: broken streak
      mockStatsFindUnique.mockResolvedValue(makeStats({ currentStreak: 0, longestStreak: 7 }));

      const result = await computeChurnRisk('user-all-signals');

      expect(result.score).toBe(1.0); // 0.30 + 0.25 + 0.20 + 0.15 + 0.10 = 1.0 → clamped
      expect(result.factors).toHaveLength(5);
    });

    it('accumulates partial score correctly when only 2 signals fire', async () => {
      // Signal 2: inactive
      mockOutfitFindFirst.mockResolvedValue({ createdAt: OLD_DATE });
      // Signal 5: broken streak
      mockStatsFindUnique.mockResolvedValue(makeStats({ currentStreak: 0, longestStreak: 4 }));

      const result = await computeChurnRisk('user-partial');

      expect(result.score).toBeCloseTo(0.35, 5); // 0.25 + 0.10
      expect(result.factors).toHaveLength(2);
    });
  });
});
