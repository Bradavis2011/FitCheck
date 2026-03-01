import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockGetAiCounters = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: {
      aggregate: mockAggregate,
      count: mockOutfitCount,
    },
  },
}));

vi.mock('../ai-feedback.service.js', () => ({
  getAiCounters: mockGetAiCounters,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runAiQualityMonitor, getAiQualitySummary } from '../ai-quality-monitor.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // Default: fallback rate 5% (under threshold), healthy avg rating
  mockGetAiCounters.mockReturnValue({ success: 100, fallback: 5 });
  mockAggregate.mockResolvedValue({
    _avg: { feedbackRating: 4.2 },
    _count: { feedbackRating: 10 },
  });
  mockOutfitCount.mockResolvedValue(1);
  mockEmailSend.mockResolvedValue({ id: 'email-aq-1' });
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runAiQualityMonitor ──────────────────────────────────────────────────────

describe('runAiQualityMonitor', () => {
  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runAiQualityMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runAiQualityMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('does NOT send email when no alerts (fallbackRate <= 10 AND avgRating >= 3.5)', async () => {
    // Default setup: 5% fallback rate, 4.2 avg rating — no alerts
    await runAiQualityMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends email when fallbackRate > 10', async () => {
    // 20 fallbacks / 100 total = 20%
    mockGetAiCounters.mockReturnValue({ success: 80, fallback: 20 });

    await runAiQualityMonitor();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('AI Quality Alert');
    expect(args.to).toBe('founder@orthis.app');
  });

  it('sends email when avgFeedbackRating < 3.5 AND ratingCount >= 5', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { feedbackRating: 3.0 },
      _count: { feedbackRating: 8 },
    });

    await runAiQualityMonitor();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.subject).toContain('AI Quality Alert');
  });

  it('does NOT send email when avgRating < 3.5 BUT ratingCount < 5 (not enough data)', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { feedbackRating: 2.0 },
      _count: { feedbackRating: 3 },
    });

    await runAiQualityMonitor();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('publishes to intelligence bus when alert email is sent', async () => {
    // Trigger an alert by setting fallback rate > 10%
    mockGetAiCounters.mockReturnValue({ success: 80, fallback: 20 });

    await runAiQualityMonitor();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'ai-quality-monitor',
      'quality_alert',
      expect.objectContaining({
        fallbackRate: expect.any(Number),
        alerts: expect.any(Array),
      }),
    );
  });

  it('does not throw when email send fails (caught in try/catch)', async () => {
    // Trigger an alert so the email path is reached
    mockGetAiCounters.mockReturnValue({ success: 80, fallback: 20 });
    mockEmailSend.mockRejectedValue(new Error('Resend API error'));

    await expect(runAiQualityMonitor()).resolves.toBeUndefined();
  });
});

// ─── getAiQualitySummary ──────────────────────────────────────────────────────

describe('getAiQualitySummary', () => {
  it('returns metrics object with fallbackRate and avgFeedbackRating fields', async () => {
    const result = await getAiQualitySummary();

    expect(result).toHaveProperty('fallbackRate');
    expect(result).toHaveProperty('avgFeedbackRating');
    expect(result).toHaveProperty('ratingCount');
    expect(result).toHaveProperty('lowRatingCount');
    expect(result).toHaveProperty('aiSuccessCount');
    expect(result).toHaveProperty('aiFallbackCount');
    // Default: 100 success, 5 fallback → fallbackRate = 5%
    expect(result.fallbackRate).toBe(5);
    expect(result.avgFeedbackRating).toBe(4.2);
  });
});
