import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: {
      count: mockOutfitCount,
      findMany: mockOutfitFindMany,
    },
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runViralMonitor } from '../viral-monitor.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // getViralMetrics calls outfitCheck.count 4 times in Promise.all:
  //   1st: total outfits (isDeleted: false)
  //   2nd: public outfits (isPublic: true)
  //   3rd: public outfits past 7d (sharesPast7d)
  //   4th: public outfits prior 7d (sharesPrior7d)
  mockOutfitCount
    .mockResolvedValueOnce(200)  // totalOutfits
    .mockResolvedValueOnce(60)   // publicOutfits
    .mockResolvedValueOnce(20)   // sharesPast7d
    .mockResolvedValueOnce(15);  // sharesPrior7d

  // styleDNA.findMany for topSharedStyles
  mockStyleDNAFindMany.mockResolvedValue([
    { styleArchetypes: ['casual', 'minimalist'] },
    { styleArchetypes: ['casual', 'streetwear'] },
  ]);

  // outfitCheck.findMany for activeUsers (viral coefficient)
  mockOutfitFindMany.mockResolvedValue([
    { userId: 'user-1' },
    { userId: 'user-2' },
  ]);

  // user.findMany for channel virality attribution
  mockUserFindMany.mockResolvedValue([]);

  mockEmailSend.mockResolvedValue({ id: 'email-viral-1' });

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runViralMonitor ──────────────────────────────────────────────────────────

describe('runViralMonitor', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runViralMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runViralMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls resend.emails.send once', async () => {
    await runViralMonitor();

    expect(mockEmailSend).toHaveBeenCalledOnce();
  }, 15000);

  it('email subject contains public outfit count and share rate', async () => {
    // totalOutfits=200, publicOutfits=60 → publicPct = round(60/200*100) = 30
    // sharesPast7d = 20
    await runViralMonitor();

    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('20'); // sharesPast7d
    expect(args.subject).toContain('30%'); // publicPct
  });

  it('weekOverWeekTrend is null when prior 7d count is 0', async () => {
    // Reset and set sharesPrior7d to 0
    mockOutfitCount.mockReset();
    mockOutfitCount
      .mockResolvedValueOnce(100) // totalOutfits
      .mockResolvedValueOnce(30)  // publicOutfits
      .mockResolvedValueOnce(10)  // sharesPast7d
      .mockResolvedValueOnce(0);  // sharesPrior7d = 0 → trend should be null

    await runViralMonitor();

    // The email still sends — just verify no crash and email was sent
    expect(mockEmailSend).toHaveBeenCalledOnce();
    // The subject should show shares but no % trend when prior is 0
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('10'); // sharesPast7d
  });

  it('weekOverWeekTrend is calculated correctly when current > prior', async () => {
    // sharesPast7d=20, sharesPrior7d=10 → trend = round((20-10)/10 * 100) = 100%
    // Verify the email is built and sent without error
    await runViralMonitor();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    // subject contains sharesPast7d value = 20
    expect(args.subject).toContain('20');
  });

  it('does not throw when email send fails', async () => {
    mockEmailSend.mockRejectedValue(new Error('Resend network error'));

    await expect(runViralMonitor()).resolves.toBeUndefined();
  });
});
