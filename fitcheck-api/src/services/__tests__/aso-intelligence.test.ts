import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockAnalyzeKeyword = vi.hoisted(() => vi.fn());
const mockGetSimilarApps = vi.hoisted(() => vi.fn());
const mockAsoSearch = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockAsoSnapshotFindFirst = vi.hoisted(() => vi.fn());
const mockAsoSnapshotCreate = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockGetLatestBusEntry = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('aso-v2', () => ({
  ASO: class {
    analyzeKeyword = mockAnalyzeKeyword;
    getSimilarApps = mockGetSimilarApps;
    search = mockAsoSearch;
  },
  ASOAnalyzer: {
    analyzeCompetitiveGap: vi.fn().mockReturnValue({ advantages: [], opportunities: [] }),
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    asoSnapshot: {
      findFirst: mockAsoSnapshotFindFirst,
      create: mockAsoSnapshotCreate,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
  getLatestBusEntry: mockGetLatestBusEntry,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { getAsoSummary, getAsoKeywordHint, runAsoIntelligence } from '../aso-intelligence.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();

  mockAnalyzeKeyword.mockReset();
  mockGetSimilarApps.mockReset();
  mockAsoSearch.mockReset();
  mockEmailSend.mockReset();
  mockAsoSnapshotFindFirst.mockReset();
  mockAsoSnapshotCreate.mockReset();
  mockPublishBus.mockReset();
  mockGetLatestBusEntry.mockReset();

  // Defaults
  mockAnalyzeKeyword.mockResolvedValue({
    difficulty: { score: 5.0 },
    traffic: { score: 8.0, ranked: { avgRank: null } },
  });
  mockAsoSnapshotFindFirst.mockResolvedValue(null);
  mockAsoSnapshotCreate.mockResolvedValue({});
  mockPublishBus.mockResolvedValue(undefined);
  mockGetLatestBusEntry.mockResolvedValue(null);
  mockEmailSend.mockResolvedValue({ id: 'email-aso-1' });
  mockGetSimilarApps.mockResolvedValue([]);
  mockAsoSearch.mockResolvedValue([]);

  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', '');
  vi.stubEnv('APPSTORE_APP_ID', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ─── getAsoSummary ────────────────────────────────────────────────────────────

describe('getAsoSummary', () => {
  it('returns null when there is no bus entry', async () => {
    mockGetLatestBusEntry.mockResolvedValue(null);

    const result = await getAsoSummary();

    expect(result).toBeNull();
    expect(mockGetLatestBusEntry).toHaveBeenCalledWith('aso_metrics');
  });

  it('returns the payload from the bus entry when one exists', async () => {
    const mockPayload = {
      keywords: [],
      topKeywords: ['outfit feedback', 'AI stylist'],
      biggestMovers: [],
      competitors: [],
      measuredAt: '2026-03-01T00:00:00.000Z',
    };
    mockGetLatestBusEntry.mockResolvedValue({ payload: mockPayload });

    const result = await getAsoSummary();

    expect(result).toEqual(mockPayload);
  });
});

// ─── getAsoKeywordHint ────────────────────────────────────────────────────────

describe('getAsoKeywordHint', () => {
  it('returns null when there is no ASO summary', async () => {
    mockGetLatestBusEntry.mockResolvedValue(null);

    const result = await getAsoKeywordHint();

    expect(result).toBeNull();
  });

  it('returns top 5 keywords joined by ", " when summary is available', async () => {
    const mockPayload = {
      keywords: [],
      topKeywords: ['outfit feedback', 'AI stylist', 'style check', 'fashion AI', 'outfit rating', 'what to wear'],
      biggestMovers: [],
      competitors: [],
      measuredAt: '2026-03-01T00:00:00.000Z',
    };
    mockGetLatestBusEntry.mockResolvedValue({ payload: mockPayload });

    const result = await getAsoKeywordHint();

    // Only top 5 are joined
    expect(result).toBe('outfit feedback, AI stylist, style check, fashion AI, outfit rating');
  });
});

// ─── runAsoIntelligence ───────────────────────────────────────────────────────

describe('runAsoIntelligence', () => {
  it('calls analyzeKeyword 18 times (9 keywords × 2 stores)', async () => {
    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    // 9 keywords × 2 stores (gplay + itunes)
    expect(mockAnalyzeKeyword).toHaveBeenCalledTimes(18);
  });

  it('creates an asoSnapshot for each successful keyword analysis', async () => {
    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    // 18 successful analyzeKeyword calls → 18 snapshots
    expect(mockAsoSnapshotCreate).toHaveBeenCalledTimes(18);
  });

  it('calls publishToIntelligenceBus with "aso_metrics" exactly once after processing all keywords', async () => {
    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockPublishBus).toHaveBeenCalledTimes(1);
    expect(mockPublishBus).toHaveBeenCalledWith(
      'aso-intelligence',
      'aso_metrics',
      expect.objectContaining({ keywords: expect.any(Array), topKeywords: expect.any(Array) }),
    );
  });

  it('does not send email when RESEND_API_KEY is not set', async () => {
    // RESEND_API_KEY already stubbed to '' in beforeEach
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends email when both RESEND_API_KEY and REPORT_RECIPIENT_EMAIL are set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const args = mockEmailSend.mock.calls[0][0] as Record<string, string>;
    expect(args.subject).toContain('18 keywords analyzed');
    expect(args.to).toBe('founder@orthis.app');
  });

  it('does not throw when analyzeKeyword fails for some keywords', async () => {
    // Make alternating keywords fail
    let callCount = 0;
    mockAnalyzeKeyword.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        throw new Error('Rate limit hit');
      }
      return {
        difficulty: { score: 5.0 },
        traffic: { score: 8.0, ranked: { avgRank: null } },
      };
    });

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();

    // Only successful keywords should produce snapshots (9 out of 18)
    expect(mockAsoSnapshotCreate).toHaveBeenCalledTimes(9);
    // publishToIntelligenceBus still called once
    expect(mockPublishBus).toHaveBeenCalledTimes(1);
  });

  it('includes rank change in snapshot when a prior snapshot exists', async () => {
    // Prior snapshot has currentRank = 10 for all keywords
    mockAsoSnapshotFindFirst.mockResolvedValue({ currentRank: 10 });
    // Current rank from analyzeKeyword = avg 7
    mockAnalyzeKeyword.mockResolvedValue({
      difficulty: { score: 5.0 },
      traffic: { score: 8.0, ranked: { avgRank: 7.0 } },
    });

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    // rankChange = round(7.0) - 10 = 7 - 10 = -3 (improved)
    const firstCreateCall = mockAsoSnapshotCreate.mock.calls[0][0] as { data: { rankChange: number } };
    expect(firstCreateCall.data.rankChange).toBe(-3);
  });

  it('passes current rank from analyzeKeyword avgRank into the snapshot', async () => {
    mockAnalyzeKeyword.mockResolvedValue({
      difficulty: { score: 3.5 },
      traffic: { score: 7.2, ranked: { avgRank: 15.7 } },
    });

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await promise;

    const firstCreateCall = mockAsoSnapshotCreate.mock.calls[0][0] as { data: { currentRank: number; difficulty: number; traffic: number } };
    expect(firstCreateCall.data.currentRank).toBe(16); // Math.round(15.7)
    expect(firstCreateCall.data.difficulty).toBe(3.5);
    expect(firstCreateCall.data.traffic).toBe(7.2);
  });

  it('does not throw when the email send fails', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    mockEmailSend.mockRejectedValue(new Error('Resend down'));

    const promise = runAsoIntelligence();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });
});
