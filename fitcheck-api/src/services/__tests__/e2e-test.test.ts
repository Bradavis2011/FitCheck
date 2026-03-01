import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockPublishBus = vi.hoisted(() => vi.fn());
const mockGetLatestBusEntry = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
  getLatestBusEntry: mockGetLatestBusEntry,
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.stubGlobal('fetch', mockFetch);

import { runE2eTests, getE2eSummary } from '../e2e-test.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPublishBus.mockReset();
  mockGetLatestBusEntry.mockReset();
  mockEmailSend.mockReset();
  mockFetch.mockReset();

  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
  mockGetLatestBusEntry.mockResolvedValue(null);

  // Default: all three endpoints return expected statuses
  mockFetch
    .mockResolvedValueOnce({ status: 200 }) // GET /health → 200
    .mockResolvedValueOnce({ status: 401 }) // POST /api/auth/signin bad creds → 401
    .mockResolvedValueOnce({ status: 401 }); // GET /api/outfits no auth → 401
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runE2eTests', () => {
  describe('all checks pass', () => {
    it('publishes e2e_metrics with passed=3 and failed=0', async () => {
      await runE2eTests();

      expect(mockPublishBus).toHaveBeenCalledWith(
        'e2e-test',
        'e2e_metrics',
        expect.objectContaining({ total: 3, passed: 3, failed: 0 }),
      );
    });

    it('does not send an alert email when all checks pass', async () => {
      await runE2eTests();

      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  describe('one check fails', () => {
    beforeEach(() => {
      mockFetch.mockReset();
      // /health returns 500 (unexpected) instead of 200
      mockFetch
        .mockResolvedValueOnce({ status: 500 })
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 401 });
    });

    it('publishes metrics with failed=1', async () => {
      await runE2eTests();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.failed).toBe(1);
      expect(payload.passed).toBe(2);
    });

    it('includes the failing endpoint in the failures array', async () => {
      await runE2eTests();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.failures).toHaveLength(1);
      expect(payload.failures[0].endpoint).toContain('/health');
      expect(payload.failures[0].got).toBe(500);
    });

    it('sends an alert email when Resend is configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

      await runE2eTests();

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      vi.unstubAllEnvs();
    });

    it('does not send alert email when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_API_KEY', '');

      await runE2eTests();

      expect(mockEmailSend).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });

  describe('network error on a check', () => {
    it('records a network_error failure and continues', async () => {
      mockFetch.mockReset();
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))  // /health fails
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 401 });

      await runE2eTests();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.failed).toBe(1);
      expect(String(payload.failures[0].got)).toContain('network_error');
    });

    it('still runs remaining checks after a network error', async () => {
      mockFetch.mockReset();
      mockFetch
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 401 });

      await runE2eTests();

      // 2 of 3 checks still pass
      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.passed).toBe(2);
    });
  });

  describe('bus publish failure', () => {
    it('resolves without throwing when bus publish fails', async () => {
      mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

      await expect(runE2eTests()).resolves.toBeUndefined();
    });
  });
});

describe('getE2eSummary', () => {
  it('returns { lastRunPassed: true, failureCount: 0 } when no bus entry exists', async () => {
    mockGetLatestBusEntry.mockResolvedValue(null);

    const result = await getE2eSummary();

    expect(result).toEqual({ lastRunPassed: true, failureCount: 0 });
  });

  it('returns lastRunPassed=true when the latest run had 0 failures', async () => {
    mockGetLatestBusEntry.mockResolvedValue({
      payload: { total: 3, passed: 3, failed: 0, failures: [] },
    });

    const result = await getE2eSummary();

    expect(result.lastRunPassed).toBe(true);
    expect(result.failureCount).toBe(0);
  });

  it('returns lastRunPassed=false when the latest run had failures', async () => {
    mockGetLatestBusEntry.mockResolvedValue({
      payload: { total: 3, passed: 1, failed: 2, failures: [{}, {}] },
    });

    const result = await getE2eSummary();

    expect(result.lastRunPassed).toBe(false);
    expect(result.failureCount).toBe(2);
  });

  it('returns { lastRunPassed: true, failureCount: 0 } when bus query throws', async () => {
    mockGetLatestBusEntry.mockRejectedValue(new Error('DB error'));

    const result = await getE2eSummary();

    expect(result).toEqual({ lastRunPassed: true, failureCount: 0 });
  });
});
