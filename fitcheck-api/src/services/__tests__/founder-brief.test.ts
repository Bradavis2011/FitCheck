import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockUserCount = vi.hoisted(() => vi.fn());
const mockGetMetrics = vi.hoisted(() => vi.fn());
const mockGetAiQuality = vi.hoisted(() => vi.fn());
const mockGetRevenue = vi.hoisted(() => vi.fn());
const mockGetSecurity = vi.hoisted(() => vi.fn());
const mockGetCodeReview = vi.hoisted(() => vi.fn());
const mockGetAso = vi.hoisted(() => vi.fn());
const mockGetBusEntry = vi.hoisted(() => vi.fn());
const mockGetUptime = vi.hoisted(() => vi.fn());
const mockGetInfra = vi.hoisted(() => vi.fn());
const mockGetE2e = vi.hoisted(() => vi.fn());
const mockGetChurn = vi.hoisted(() => vi.fn());
const mockGetSupport = vi.hoisted(() => vi.fn());

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
  },
}));

vi.mock('../metrics.service.js', () => ({
  getMetricsSnapshot: mockGetMetrics,
}));

vi.mock('../ai-quality-monitor.service.js', () => ({
  getAiQualitySummary: mockGetAiQuality,
}));

vi.mock('../revenue-cost.service.js', () => ({
  getRevenueSummary: mockGetRevenue,
}));

vi.mock('../security-auditor.service.js', () => ({
  getSecurityAuditSummary: mockGetSecurity,
}));

vi.mock('../code-reviewer.service.js', () => ({
  getCodeReviewSummary: mockGetCodeReview,
}));

vi.mock('../aso-intelligence.service.js', () => ({
  getAsoSummary: mockGetAso,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  getLatestBusEntry: mockGetBusEntry,
}));

vi.mock('../uptime-monitor.service.js', () => ({
  getUptimeSummary: mockGetUptime,
}));

vi.mock('../infra-monitor.service.js', () => ({
  getInfraSummary: mockGetInfra,
}));

vi.mock('../e2e-test.service.js', () => ({
  getE2eSummary: mockGetE2e,
}));

vi.mock('../churn-prediction.service.js', () => ({
  getChurnSummary: mockGetChurn,
}));

vi.mock('../support-bot.service.js', () => ({
  getSupportSummary: mockGetSupport,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runFounderBrief } from '../founder-brief.service.js';

// ─── Default Mock Return Values ───────────────────────────────────────────────

function setDefaultMocks() {
  // prisma.user.count is called twice in Promise.all:
  //   1st: newUsersThisWeek  (gte ago7d)
  //   2nd: newUsersPriorWeek (gte ago14d, lt ago7d)
  mockUserCount
    .mockResolvedValueOnce(12)   // newUsersThisWeek
    .mockResolvedValueOnce(8);   // newUsersPriorWeek

  mockGetMetrics.mockResolvedValue({
    totalUsers: 100,
    dau: 10,
    wau: 50,
    retention7d: 25,
    checksToday: 5,
    errorCount5xx: 0,
    pendingReportsOlderThan24h: 0,
    expertReviewsPending: 0,
  });

  mockGetAiQuality.mockResolvedValue({
    fallbackRate: 2,
    avgFeedbackRating: 4.2,
  });

  mockGetRevenue.mockResolvedValue({
    estimatedMRR: 199,
    plusUsers: 20,
    proUsers: 10,
    newSubscriptions7d: 3,
    cancellations7d: 1,
    estimatedGeminiCost: 5.50,
    trialToPaidConversion: 12,
    totalPaidUsers: 30,
  });

  mockGetSecurity.mockResolvedValue({
    total: 2,
    critical: 0,
    high: 0,
    medium: 2,
    low: 0,
  });

  mockGetCodeReview.mockResolvedValue({
    total: 3,
    high: 0,
    medium: 1,
    low: 2,
  });

  mockGetAso.mockResolvedValue(null);
  mockGetBusEntry.mockResolvedValue(null);

  mockGetUptime.mockResolvedValue({
    failureCount: 0,
    uptimePct: 100,
  });

  mockGetInfra.mockResolvedValue({
    heapUsedPct: 0.45,
  });

  mockGetE2e.mockResolvedValue({
    lastRunPassed: true,
    failureCount: 0,
  });

  mockGetChurn.mockResolvedValue({
    highRiskCount: 0,
  });

  mockGetSupport.mockResolvedValue({
    openTickets: 0,
    escalated7d: 0,
  });

  mockEmailSend.mockResolvedValue({ id: 'email-founder-1' });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setDefaultMocks();

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runFounderBrief ──────────────────────────────────────────────────────────

describe('runFounderBrief', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runFounderBrief();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runFounderBrief();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls all 12 summary functions and sends one email', async () => {
    await runFounderBrief();

    expect(mockGetMetrics).toHaveBeenCalledOnce();
    expect(mockGetAiQuality).toHaveBeenCalledOnce();
    expect(mockGetRevenue).toHaveBeenCalledOnce();
    expect(mockGetSecurity).toHaveBeenCalledOnce();
    expect(mockGetCodeReview).toHaveBeenCalledOnce();
    expect(mockGetAso).toHaveBeenCalledOnce();
    expect(mockGetBusEntry).toHaveBeenCalledOnce();
    expect(mockGetUptime).toHaveBeenCalledOnce();
    expect(mockGetInfra).toHaveBeenCalledOnce();
    expect(mockGetE2e).toHaveBeenCalledOnce();
    expect(mockGetChurn).toHaveBeenCalledOnce();
    expect(mockGetSupport).toHaveBeenCalledOnce();

    expect(mockEmailSend).toHaveBeenCalledOnce();
  });

  it('email subject includes total users and MRR', async () => {
    await runFounderBrief();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    // totalUsers = 100, MRR = 199
    expect(args.subject).toContain('100');
    expect(args.subject).toContain('199');
  });

  it('does not throw when one summary function fails (Promise.all rejects, caught by outer try/catch)', async () => {
    // Promise.all will reject when any member rejects — the outer catch handles it
    // and returns without sending an email
    mockGetMetrics.mockRejectedValue(new Error('metrics DB down'));

    await expect(runFounderBrief()).resolves.toBeUndefined();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('adds "Churn outpacing" risk when cancellations exceed new subscriptions', async () => {
    mockGetRevenue.mockResolvedValue({
      estimatedMRR: 199,
      plusUsers: 20,
      proUsers: 10,
      newSubscriptions7d: 1,   // fewer than cancellations
      cancellations7d: 5,       // more than new subs
      estimatedGeminiCost: 5.50,
      trialToPaidConversion: 12,
      totalPaidUsers: 30,
    });

    await runFounderBrief();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const html: string = mockEmailSend.mock.calls[0][0].html;
    expect(html).toContain('Churn');
    expect(html).toContain('outpacing');
  });

  it('adds "CRITICAL security" risk when securitySummary.critical > 0', async () => {
    mockGetSecurity.mockResolvedValue({
      total: 3,
      critical: 2,
      high: 1,
      medium: 0,
      low: 0,
    });

    await runFounderBrief();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const html: string = mockEmailSend.mock.calls[0][0].html;
    expect(html).toContain('CRITICAL');
    expect(html).toContain('security');
  });

  it('adds "Memory" risk when infraSummary.heapUsedPct exceeds 0.80', async () => {
    mockGetInfra.mockResolvedValue({
      heapUsedPct: 0.92,
    });

    await runFounderBrief();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const html: string = mockEmailSend.mock.calls[0][0].html;
    expect(html).toContain('Memory');
    expect(html).toContain('92%');
  });

  it('includes ASO section when asoSummary is non-null', async () => {
    mockGetAso.mockResolvedValue({
      topKeywords: ['outfit ideas', 'fashion ai'],
      keywords: [
        { keyword: 'outfit ideas', store: 'apple', traffic: 85, difficulty: 40 },
        { keyword: 'fashion ai', store: 'apple', traffic: 60, difficulty: 30 },
      ],
      biggestMovers: [
        { keyword: 'outfit ideas', store: 'apple', change: -2 },
      ],
      competitors: [{ name: 'StyleSnap' }, { name: 'Whering' }],
    });

    await runFounderBrief();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const html: string = mockEmailSend.mock.calls[0][0].html;
    expect(html).toContain('ASO');
    expect(html).toContain('outfit ideas');
  });
});
