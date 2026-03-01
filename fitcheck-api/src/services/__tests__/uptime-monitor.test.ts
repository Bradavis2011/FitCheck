import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.stubGlobal('fetch', mockFetch);

import { runUptimeCheck, trackDailyUptime, getUptimeSummary } from '../uptime-monitor.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  mockEmailSend.mockReset();
  mockPublishBus.mockReset();
  mockFetch.mockReset();

  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });

  // Reset module-level counters between tests:
  //   1. success check → consecutiveFailures = 0
  //   2. trackDailyUptime → dailyFailureCount = 0
  mockFetch.mockResolvedValue({ ok: true });
  await runUptimeCheck();
  mockFetch.mockReset();

  await trackDailyUptime();

  // Clear mock call records from the reset sequence
  mockPublishBus.mockReset();
  mockEmailSend.mockReset();
  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runUptimeCheck', () => {
  it('does not send an alert when the health endpoint returns 200', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await runUptimeCheck();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('does not send an alert after only 1 failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await runUptimeCheck();

    expect(mockEmailSend).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('does not send an alert after 2 consecutive failures', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockFetch.mockRejectedValue(new Error('timeout'));

    await runUptimeCheck(); // 1
    await runUptimeCheck(); // 2

    expect(mockEmailSend).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('sends an alert after exactly 3 consecutive failures', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    await runUptimeCheck(); // 1
    await runUptimeCheck(); // 2
    await runUptimeCheck(); // 3 → alert

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });

  it('resets the consecutive counter after sending the alert', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockFetch.mockRejectedValue(new Error('down'));

    await runUptimeCheck(); // 1
    await runUptimeCheck(); // 2
    await runUptimeCheck(); // 3 → alert fires, counter → 0

    mockEmailSend.mockReset();

    await runUptimeCheck(); // 1 (after reset)
    await runUptimeCheck(); // 2

    // Must not re-alert until another 3 consecutive failures
    expect(mockEmailSend).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('does not send an alert when 2 failures are followed by a recovery', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true }); // recovery breaks the streak

    await runUptimeCheck(); // 1
    await runUptimeCheck(); // 2
    await runUptimeCheck(); // recovery → consecutiveFailures = 0

    expect(mockEmailSend).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('increments dailyFailureCount on each failure', async () => {
    mockFetch.mockRejectedValue(new Error('down'));

    await runUptimeCheck();
    await runUptimeCheck();

    const { failureCount } = await getUptimeSummary();
    expect(failureCount).toBe(2);
  });

  it('does not increment dailyFailureCount on success', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await runUptimeCheck();
    await runUptimeCheck();

    const { failureCount } = await getUptimeSummary();
    expect(failureCount).toBe(0);
  });
});

describe('trackDailyUptime', () => {
  it('publishes uptime_metrics to the intelligence bus', async () => {
    await trackDailyUptime();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'uptime-monitor',
      'uptime_metrics',
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        failureCount: expect.any(Number),
        uptimePct: expect.any(Number),
      }),
    );
  });

  it('reports 100% uptime when there are no failures', async () => {
    await trackDailyUptime();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.failureCount).toBe(0);
    expect(payload.uptimePct).toBe(100);
  });

  it('calculates uptime percentage correctly given a failure count', async () => {
    mockFetch.mockRejectedValue(new Error('down'));
    await runUptimeCheck(); // +1 failure

    await trackDailyUptime();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.failureCount).toBe(1);
    // 287/288 = ~99.65%
    expect(payload.uptimePct).toBeCloseTo(99.65, 1);
  });

  it('resets dailyFailureCount to 0 after publishing', async () => {
    mockFetch.mockRejectedValue(new Error('down'));
    await runUptimeCheck();
    await runUptimeCheck();

    await trackDailyUptime(); // publishes 2 failures + resets

    const { failureCount } = await getUptimeSummary();
    expect(failureCount).toBe(0);
  });

  it('second publish reflects only failures accumulated after the last reset', async () => {
    mockFetch.mockRejectedValue(new Error('down'));
    await runUptimeCheck(); // 1 failure

    await trackDailyUptime(); // publish + reset
    mockPublishBus.mockReset();
    mockPublishBus.mockResolvedValue(undefined);

    await trackDailyUptime(); // second publish — 0 failures since reset

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.failureCount).toBe(0);
    expect(payload.uptimePct).toBe(100);
  });
});

describe('getUptimeSummary', () => {
  it('returns failureCount 0 when there are no recorded failures', async () => {
    const result = await getUptimeSummary();
    expect(result.failureCount).toBe(0);
  });

  it('returns the current accumulated failureCount', async () => {
    mockFetch.mockRejectedValue(new Error('down'));
    await runUptimeCheck();
    await runUptimeCheck();
    await runUptimeCheck();

    const result = await getUptimeSummary();
    expect(result.failureCount).toBe(3);
  });
});
