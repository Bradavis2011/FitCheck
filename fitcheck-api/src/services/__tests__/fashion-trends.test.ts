import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockFashionTrendFindFirst = vi.hoisted(() => vi.fn());
const mockFashionTrendFindUnique = vi.hoisted(() => vi.fn());
const mockFashionTrendCreate = vi.hoisted(() => vi.fn());
const mockFashionTrendUpdate = vi.hoisted(() => vi.fn());
const mockGetTrendData = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    fashionTrend: {
      findFirst: mockFashionTrendFindFirst,
      findUnique: mockFashionTrendFindUnique,
      create: mockFashionTrendCreate,
      update: mockFashionTrendUpdate,
    },
  },
}));

vi.mock('../content-calendar.service.js', () => ({
  getTrendData: mockGetTrendData,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  getLatestFashionTrendText,
  validateTrendAccuracy,
  runFashionTrendCron,
} from '../fashion-trends.service.js';

// ─── Shared Sample Data ───────────────────────────────────────────────────────

const SAMPLE_TREND_ROW = {
  id: 'trend-1',
  period: '2026-W09',
  region: 'global',
  seasonalColors: ['navy', 'butter yellow'],
  trendingStyles: ['quiet luxury', 'coastal grandmother'],
  keyPieces: ['trench coat', 'wide-leg trousers'],
  trendingPatterns: ['glen plaid', 'bouclé'],
  fadingTrends: ['logomania'],
  rawAnalysis: null,
  platformTrends: null,
  createdAt: new Date('2026-03-01T00:00:00Z'),
};

const VALID_GEMINI_JSON =
  '{"seasonalColors":["navy"],"trendingStyles":["quiet luxury"],"keyPieces":["trench coat"],"trendingPatterns":["glen plaid"],"fadingTrends":["logomania"]}';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  mockFashionTrendFindFirst.mockResolvedValue(null);
  mockFashionTrendFindUnique.mockResolvedValue(null);
  mockGetTrendData.mockResolvedValue({
    topStyles: ['casual'],
    popularOccasions: ['Work'],
    colorTrends: ['black'],
  });
  mockGenerateContent.mockResolvedValue({
    response: { text: () => VALID_GEMINI_JSON },
  });
  mockFashionTrendCreate.mockResolvedValue({ id: 'trend-1' });
  mockFashionTrendUpdate.mockResolvedValue({});
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── getLatestFashionTrendText ────────────────────────────────────────────────

describe('getLatestFashionTrendText', () => {
  it('returns null when no trend exists', async () => {
    mockFashionTrendFindFirst.mockResolvedValue(null);

    const result = await getLatestFashionTrendText();

    expect(result).toBeNull();
  });

  it('returns a formatted string with "Current Fashion Context" header when trend exists', async () => {
    mockFashionTrendFindFirst.mockResolvedValue(SAMPLE_TREND_ROW);

    const result = await getLatestFashionTrendText();

    expect(result).not.toBeNull();
    expect(result).toContain('Current Fashion Context');
    expect(result).toContain(SAMPLE_TREND_ROW.period);
  });

  it('includes validated styles as confirmed and divergent as "(emerging)" when both arrays exist in rawAnalysis', async () => {
    const trendWithValidation = {
      ...SAMPLE_TREND_ROW,
      trendingStyles: ['quiet luxury', 'maximalism'],
      rawAnalysis: {
        validatedStyles: ['quiet luxury'],
        divergentStyles: ['maximalism'],
      },
    };
    mockFashionTrendFindFirst.mockResolvedValue(trendWithValidation);

    const result = await getLatestFashionTrendText();

    expect(result).toContain('quiet luxury');
    expect(result).toContain('maximalism');
    expect(result).toContain('emerging');
  });

  it('falls back to all trendingStyles when no validation metadata exists in rawAnalysis', async () => {
    const trendNoValidation = {
      ...SAMPLE_TREND_ROW,
      trendingStyles: ['quiet luxury', 'coastal grandmother'],
      rawAnalysis: null,
    };
    mockFashionTrendFindFirst.mockResolvedValue(trendNoValidation);

    const result = await getLatestFashionTrendText();

    expect(result).toContain('quiet luxury');
    expect(result).toContain('coastal grandmother');
    // Should NOT include "(emerging)" since there's no validation split
    expect(result).not.toContain('emerging');
  });
});

// ─── validateTrendAccuracy ────────────────────────────────────────────────────

describe('validateTrendAccuracy', () => {
  it('returns early if no trend found', async () => {
    mockFashionTrendFindFirst.mockResolvedValue(null);

    await validateTrendAccuracy();

    expect(mockFashionTrendUpdate).not.toHaveBeenCalled();
  });

  it('returns early if platformTrends has no topStyles', async () => {
    const trendNoStyles = {
      ...SAMPLE_TREND_ROW,
      platformTrends: { topStyles: [] },
    };
    mockFashionTrendFindFirst.mockResolvedValue(trendNoStyles);

    await validateTrendAccuracy();

    expect(mockFashionTrendUpdate).not.toHaveBeenCalled();
  });

  it('classifies a Gemini style as "validated" when it fuzzy-matches a platform style', async () => {
    const trendWithPlatform = {
      ...SAMPLE_TREND_ROW,
      trendingStyles: ['quiet luxury'],
      platformTrends: { topStyles: ['quiet luxury'] },
      rawAnalysis: {},
    };
    mockFashionTrendFindFirst.mockResolvedValue(trendWithPlatform);

    await validateTrendAccuracy();

    expect(mockFashionTrendUpdate).toHaveBeenCalledOnce();
    const updateCall = mockFashionTrendUpdate.mock.calls[0][0];
    expect(updateCall.data.rawAnalysis.validatedStyles).toContain('quiet luxury');
    expect(updateCall.data.rawAnalysis.divergentStyles).toHaveLength(0);
  });

  it('calls fashionTrend.update with validatedStyles and divergentStyles arrays', async () => {
    const trendMixed = {
      ...SAMPLE_TREND_ROW,
      // "casual" matches platform "casual chic" via word inclusion
      // "maximalism" does not match anything in platform data
      trendingStyles: ['casual', 'maximalism'],
      platformTrends: { topStyles: ['casual chic', 'workwear'] },
      rawAnalysis: {},
    };
    mockFashionTrendFindFirst.mockResolvedValue(trendMixed);

    await validateTrendAccuracy();

    expect(mockFashionTrendUpdate).toHaveBeenCalledOnce();
    const updateCall = mockFashionTrendUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 'trend-1' });
    expect(updateCall.data.rawAnalysis).toHaveProperty('validatedStyles');
    expect(updateCall.data.rawAnalysis).toHaveProperty('divergentStyles');
    expect(Array.isArray(updateCall.data.rawAnalysis.validatedStyles)).toBe(true);
    expect(Array.isArray(updateCall.data.rawAnalysis.divergentStyles)).toBe(true);
  });
});

// ─── runFashionTrendCron ──────────────────────────────────────────────────────

describe('runFashionTrendCron', () => {
  it('skips creating a new trend when one already exists for this period', async () => {
    mockFashionTrendFindUnique.mockResolvedValue({ id: 'existing-trend' });

    await runFashionTrendCron();

    expect(mockFashionTrendCreate).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('calls Gemini once to generate trend data', async () => {
    await runFashionTrendCron();

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('calls fashionTrend.create with the parsed trend fields when Gemini returns valid JSON', async () => {
    await runFashionTrendCron();

    expect(mockFashionTrendCreate).toHaveBeenCalledOnce();
    const createCall = mockFashionTrendCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      region: 'global',
      seasonalColors: ['navy'],
      trendingStyles: ['quiet luxury'],
      keyPieces: ['trench coat'],
      trendingPatterns: ['glen plaid'],
      fadingTrends: ['logomania'],
    });
    expect(typeof createCall.data.period).toBe('string');
  });

  it('does not throw when Gemini fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini unavailable'));

    await expect(runFashionTrendCron()).resolves.toBeUndefined();
    expect(mockFashionTrendCreate).not.toHaveBeenCalled();
  });

  it('does not throw when fashionTrend.findUnique fails', async () => {
    mockFashionTrendFindUnique.mockRejectedValue(new Error('DB error'));

    await expect(runFashionTrendCron()).resolves.toBeUndefined();
    expect(mockFashionTrendCreate).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('calls publishToIntelligenceBus with trend_signal type after successful create', async () => {
    await runFashionTrendCron();

    // publishToIntelligenceBus is called via .catch() — give the microtask queue a tick to flush
    await new Promise(resolve => setImmediate(resolve));

    expect(mockPublishBus).toHaveBeenCalledWith(
      'fashion-trends',
      'trend_signal',
      expect.objectContaining({
        trendingStyles: ['quiet luxury'],
        seasonalColors: ['navy'],
        keyPieces: ['trench coat'],
        fadingTrends: ['logomania'],
      }),
    );
  });
});
