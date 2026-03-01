import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockUserCount = vi.hoisted(() => vi.fn());
const mockSubEventCount = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockDailyTokenFindMany = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      count: mockUserCount,
    },
    subscriptionEvent: {
      count: mockSubEventCount,
    },
    outfitCheck: {
      count: mockOutfitCount,
    },
    dailyTokenUsage: {
      findMany: mockDailyTokenFindMany,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runRevenueCostTracker, getRevenueSummary } from '../revenue-cost.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // mockUserCount called 4 times across Promise.all + separate newUsers7d call:
  //   1st: prisma.user.count()                          → totalUsers
  //   2nd: prisma.user.count({ where: { tier: 'plus' } }) → plusUsers
  //   3rd: prisma.user.count({ where: { tier: 'pro' } })  → proUsers
  //   4th: prisma.user.count({ where: { createdAt: ... } }) → newUsers7d (after Promise.all)
  mockUserCount
    .mockResolvedValueOnce(100) // totalUsers
    .mockResolvedValueOnce(10)  // plusUsers
    .mockResolvedValueOnce(3)   // proUsers
    .mockResolvedValueOnce(20); // newUsers7d

  // mockSubEventCount called 2 times inside Promise.all:
  //   1st: INITIAL_PURCHASE / initial_purchase → newSubs7d
  //   2nd: CANCELLATION / cancellation         → cancellations7d
  mockSubEventCount
    .mockResolvedValueOnce(5)  // newSubs7d
    .mockResolvedValueOnce(2); // cancellations7d

  mockOutfitCount.mockResolvedValue(50);

  // No token rows → cost falls back to per-analysis estimate
  mockDailyTokenFindMany.mockResolvedValue([]);

  mockEmailSend.mockResolvedValue({ id: 'email-1' });

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runRevenueCostTracker ────────────────────────────────────────────────────

describe('runRevenueCostTracker', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runRevenueCostTracker();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runRevenueCostTracker();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends revenue email with correct subject containing MRR and paid user count', async () => {
    // 10 plus × $4.99 + 3 pro × $9.99 = $49.90 + $29.97 = $79.87 → toFixed(0) = '$80'
    // totalPaidUsers = 10 + 3 = 13
    await runRevenueCostTracker();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('MRR $');
    expect(callArgs.subject).toContain('80');  // estimatedMRR.toFixed(0)
    expect(callArgs.subject).toContain('13');  // totalPaidUsers
    expect(callArgs.to).toBe('founder@orthis.app');
  });

  it('does not throw when email sending fails', async () => {
    mockEmailSend.mockRejectedValue(new Error('Resend API error'));

    await expect(runRevenueCostTracker()).resolves.toBeUndefined();
  });
});

// ─── getRevenueSummary ────────────────────────────────────────────────────────

describe('getRevenueSummary', () => {
  describe('MRR calculation', () => {
    it('calculates estimatedMRR as (plusUsers × 4.99) + (proUsers × 9.99)', async () => {
      // 10 × $4.99 = $49.90, 3 × $9.99 = $29.97, total = $79.87
      const metrics = await getRevenueSummary();

      expect(metrics.estimatedMRR).toBeCloseTo(79.87, 2);
    });

    it('returns 0 MRR when no paid users', async () => {
      // Clear the beforeEach queue before setting test-specific values
      mockUserCount.mockReset();
      mockSubEventCount.mockReset();

      mockUserCount
        .mockResolvedValueOnce(50) // totalUsers
        .mockResolvedValueOnce(0)  // plusUsers
        .mockResolvedValueOnce(0)  // proUsers
        .mockResolvedValueOnce(10); // newUsers7d
      mockSubEventCount
        .mockResolvedValueOnce(2)  // newSubs7d
        .mockResolvedValueOnce(1); // cancellations7d
      mockOutfitCount.mockResolvedValue(20);
      mockDailyTokenFindMany.mockResolvedValue([]);

      const metrics = await getRevenueSummary();

      expect(metrics.estimatedMRR).toBe(0);
    });
  });

  describe('totalPaidUsers', () => {
    it('is the sum of plusUsers and proUsers', async () => {
      const metrics = await getRevenueSummary();

      // plusUsers (10) + proUsers (3) = 13
      expect(metrics.totalPaidUsers).toBe(13);
      expect(metrics.plusUsers).toBe(10);
      expect(metrics.proUsers).toBe(3);
    });
  });

  describe('Gemini cost estimation', () => {
    it('uses real token data when dailyTokenUsage rows exist', async () => {
      mockDailyTokenFindMany.mockResolvedValue([
        { userTokens: 1000000, learningTokens: 500000, reservedTokens: 500000 },
      ]);

      const metrics = await getRevenueSummary();

      // Total = 2,000,000 tokens × $0.00000020 = $0.40
      expect(metrics.estimatedGeminiCost).toBeCloseTo(0.40, 5);
    });

    it('falls back to per-analysis cost when no token rows exist', async () => {
      // mockDailyTokenFindMany already returns [] in beforeEach
      const metrics = await getRevenueSummary();

      // 50 analyses × $0.000225 = $0.01125
      expect(metrics.estimatedGeminiCost).toBeCloseTo(0.01125, 5);
    });

    it('estimatedCostPerUser is geminiCost / totalUsers', async () => {
      const metrics = await getRevenueSummary();

      // geminiCost = 0.01125, totalUsers = 100 → 0.0001125
      expect(metrics.estimatedCostPerUser).toBeCloseTo(metrics.estimatedGeminiCost / metrics.totalUsers, 8);
    });
  });

  describe('subscription metrics', () => {
    it('includes newSubscriptions7d and cancellations7d from subscriptionEvent counts', async () => {
      const metrics = await getRevenueSummary();

      expect(metrics.newSubscriptions7d).toBe(5);
      expect(metrics.cancellations7d).toBe(2);
    });
  });

  describe('trialToPaidConversion', () => {
    it('calculates conversion as percentage of new users who subscribed', async () => {
      // newSubs7d = 5, newUsers7d = 20 → Math.round(5/20 * 100) = 25
      const metrics = await getRevenueSummary();

      expect(metrics.trialToPaidConversion).toBe(25);
    });

    it('returns null when there are no new users in the last 7 days', async () => {
      // Clear the beforeEach queue and replace with 0 for newUsers7d
      mockUserCount.mockReset();
      mockSubEventCount.mockReset();

      mockUserCount
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(10)  // plusUsers
        .mockResolvedValueOnce(3)   // proUsers
        .mockResolvedValueOnce(0);  // newUsers7d = 0 → null conversion
      mockSubEventCount
        .mockResolvedValueOnce(5)  // newSubs7d
        .mockResolvedValueOnce(2); // cancellations7d
      mockOutfitCount.mockResolvedValue(50);
      mockDailyTokenFindMany.mockResolvedValue([]);

      const metrics = await getRevenueSummary();

      expect(metrics.trialToPaidConversion).toBeNull();
    });
  });

  describe('totals', () => {
    it('returns totalUsers and totalOutfitChecks30d', async () => {
      const metrics = await getRevenueSummary();

      expect(metrics.totalUsers).toBe(100);
      expect(metrics.totalOutfitChecks30d).toBe(50);
    });
  });
});
