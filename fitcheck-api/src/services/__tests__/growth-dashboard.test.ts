import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockUserCount = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

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
      findMany: mockUserFindMany,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runGrowthDashboard, getGrowthSummary } from '../growth-dashboard.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // getGrowthMetrics calls user.count 5 times via Promise.all + subsequent retention queries:
  //   1st: prisma.user.count()                       → totalUsers
  //   2nd: prisma.user.count({ where: { createdAt gte ago24h } }) → newSignups24h
  //   3rd: prisma.user.count({ where: { createdAt gte ago48h, lt ago24h } }) → newSignups48hTo24h
  //   4th: prisma.user.count({ where: { createdAt gte ago7d } }) → newSignups7d
  //   5th: prisma.user.count({ where: { outfitChecks: { some: {} } } }) → usersWithOutfitCheck
  mockUserCount
    .mockResolvedValueOnce(500)  // totalUsers
    .mockResolvedValueOnce(10)   // newSignups24h
    .mockResolvedValueOnce(8)    // newSignups48hTo24h
    .mockResolvedValueOnce(60)   // newSignups7d
    .mockResolvedValueOnce(300); // usersWithOutfitCheck

  // outfitCheck.findMany called twice in Promise.all:
  //   1st: usersActiveToday (distinct userId, createdAt >= todayStart)
  //   2nd: usersActiveWeek  (distinct userId, createdAt >= ago7d)
  // Then called again inside retention1d and retention7d blocks
  mockOutfitFindMany.mockResolvedValue([]);

  // user.findMany called inside retention1d and retention7d blocks
  mockUserFindMany.mockResolvedValue([]);

  mockEmailSend.mockResolvedValue({ id: 'email-123' });
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runGrowthDashboard ───────────────────────────────────────────────────────

describe('runGrowthDashboard', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runGrowthDashboard();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runGrowthDashboard();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls resend.emails.send once with correct subject', async () => {
    await runGrowthDashboard();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('Or This? Growth');
    expect(args.to).toBe('founder@orthis.app');
  }, 15000);

  it('publishes attribution metrics to intelligence bus when users have attribution data', async () => {
    // getGrowthMetrics and getAttributionMetrics run concurrently in Promise.all.
    // Using mockResolvedValue (persistent) avoids ordering fragility across concurrent calls.
    // user.findMany is called by retention blocks AND getAttributionMetrics concurrently.
    // We want getAttributionMetrics to see a user with attribution, so we return one
    // on every call. The retention blocks handle any non-empty array gracefully (they
    // just compute a retention % based on subsequent outfitCheck queries).
    mockUserFindMany.mockResolvedValue([
      { id: 'user-attr-1', attribution: { source: 'instagram' } },
    ]);
    // outfitCheck.findMany is called for active users (DAU/WAU), retention, and
    // attribution firstOutfitRate. Return an empty array for all of them.
    mockOutfitFindMany.mockResolvedValue([]);

    await runGrowthDashboard();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'growth-dashboard',
      'attribution_metrics',
      expect.objectContaining({ periodDays: 7 }),
    );
  }, 15000);

  it('does not publish to intelligence bus when no users have attribution data', async () => {
    // user.findMany returns empty for recentUsers → no attribution sources → no publish
    mockUserFindMany.mockResolvedValue([]);

    await runGrowthDashboard();

    expect(mockPublishBus).not.toHaveBeenCalled();
  });

  it('does not throw when email send fails', async () => {
    mockEmailSend.mockRejectedValue(new Error('Resend API error'));

    await expect(runGrowthDashboard()).resolves.toBeUndefined();
  });
});

// ─── getGrowthSummary ─────────────────────────────────────────────────────────

describe('getGrowthSummary', () => {
  it('returns metrics object with newSignups24h, totalUsers, dau, and wau fields', async () => {
    // 3 active users today, 5 active this week
    mockOutfitFindMany
      .mockResolvedValueOnce([
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
      ]) // usersActiveToday → dau = 3
      .mockResolvedValueOnce([
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' }, { userId: 'u5' },
      ]); // usersActiveWeek → wau = 5

    const metrics = await getGrowthSummary();

    expect(metrics).toHaveProperty('newSignups24h', 10);
    expect(metrics).toHaveProperty('totalUsers', 500);
    expect(metrics).toHaveProperty('dau', 3);
    expect(metrics).toHaveProperty('wau', 5);
  });
});
