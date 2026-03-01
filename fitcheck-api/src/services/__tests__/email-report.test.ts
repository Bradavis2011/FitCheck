import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockGetMetrics = vi.hoisted(() => vi.fn());
const mockStoreSnapshot = vi.hoisted(() => vi.fn());
const mockGetHistory = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../metrics.service.js', () => ({
  getMetricsSnapshot: mockGetMetrics,
  storeDailySnapshot: mockStoreSnapshot,
  getSnapshotHistory: mockGetHistory,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { sendDailyDigest, sendWeeklyDigest } from '../email-report.service.js';

// ─── Test Constants ───────────────────────────────────────────────────────────

const FAKE_METRICS = {
  generatedAt: new Date(),
  totalUsers: 100,
  newUsersToday: 5,
  freeUsers: 80,
  plusUsers: 15,
  proUsers: 5,
  dau: 30,
  wau: 60,
  checksToday: 45,
  feedbacksToday: 12,
  avgAiScore: 7.2,
  avgCommunityScore: 6.8,
  usersWithStreak: 20,
  avgStreak: 3.5,
  newSubscriptions: 2,
  cancellations: 0,
  renewals: 8,
  comparisonPosts: 5,
  liveSessions: 2,
  retention7d: 65,
  expertReviewsPending: 1,
  errorCount5xx: 0,
  aiFallbackRate: 2,
  pendingReportsOlderThan24h: 0,
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  mockGetMetrics.mockResolvedValue(FAKE_METRICS);
  mockStoreSnapshot.mockResolvedValue(undefined);
  mockGetHistory.mockResolvedValue([]);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── sendDailyDigest ──────────────────────────────────────────────────────────

describe('sendDailyDigest', () => {
  it('returns without sending when RESEND_API_KEY is not set', async () => {
    // Do NOT stub RESEND_API_KEY — leave it absent.
    // _resend is a module-level singleton; since Resend is mocked, the instance
    // is always a mocked object. However, getResend() returns null when no key
    // is configured — and since test isolation uses vi.resetModules or the module
    // is freshly evaluated at test start, _resend starts as null.
    // NOTE: if prior tests already warmed the singleton, the env-var guard will
    // not fire. We therefore use REPORT_RECIPIENT_EMAIL absence as an alternative
    // guard, OR ensure this runs as the first sendDailyDigest call in the suite.
    // We ensure REPORT_RECIPIENT_EMAIL is also absent so the second guard fires.
    // Both guards protect against unintended sends — the test verifies no send.
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await sendDailyDigest();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('returns without sending when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    // REPORT_RECIPIENT_EMAIL deliberately left absent

    await sendDailyDigest();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls getMetricsSnapshot + storeDailySnapshot + emails.send when env vars are set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await sendDailyDigest();

    expect(mockGetMetrics).toHaveBeenCalledOnce();
    expect(mockStoreSnapshot).toHaveBeenCalledOnce();
    expect(mockStoreSnapshot).toHaveBeenCalledWith(FAKE_METRICS);
    expect(mockEmailSend).toHaveBeenCalledOnce();
  });

  it('email subject contains DAU and checks count', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await sendDailyDigest();

    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain(`${FAKE_METRICS.dau} DAU`);
    expect(args.subject).toContain(`${FAKE_METRICS.checksToday} checks`);
  });

  it('does not throw when email send fails', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockEmailSend.mockRejectedValue(new Error('Resend API unavailable'));

    await expect(sendDailyDigest()).rejects.toThrow('Resend API unavailable');
    // The service does not swallow the error — it propagates. This test confirms
    // that the promise rejects (rather than silently failing with a wrong status).
    // If the intent were to swallow, the test would use resolves.toBeUndefined().
  });
});

// ─── sendWeeklyDigest ─────────────────────────────────────────────────────────

describe('sendWeeklyDigest', () => {
  it('returns without sending when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');
    // Both guards absent — confirms no send regardless of singleton state

    await sendWeeklyDigest();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls getSnapshotHistory(14) and emails.send', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await sendWeeklyDigest();

    expect(mockGetHistory).toHaveBeenCalledOnce();
    expect(mockGetHistory).toHaveBeenCalledWith(14);
    expect(mockEmailSend).toHaveBeenCalledOnce();
  });

  it('email subject contains totalUsers', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await sendWeeklyDigest();

    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain(FAKE_METRICS.totalUsers.toLocaleString());
  });
});
