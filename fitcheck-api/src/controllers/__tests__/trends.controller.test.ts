import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockGetWeekNumber = vi.hoisted(() => vi.fn().mockReturnValue(10));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
  },
}));

vi.mock('../../utils/date.js', () => ({
  getWeekNumber: mockGetWeekNumber,
}));

import {
  getTrendingColors,
  getTrendingArchetypes,
  getTrendSummary,
} from '../trends.controller.js';

// ─── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_DNA = {
  id: 'dna-1',
  userId: 'user-1',
  dominantColors: ['navy', 'white'],
  styleArchetypes: ['classic', 'minimalist'],
  garments: ['blazer', 'jeans'],
  colorHarmony: 'complementary',
  createdAt: new Date('2026-03-01T10:00:00Z'),
  outfitCheck: { aiScore: 8.5, createdAt: new Date('2026-03-01T10:00:00Z') },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1', tier: 'pro', email: 'pro@example.com' },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

// ─── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStyleDNAFindMany.mockReset();
  mockGetWeekNumber.mockReset();
  mockGetWeekNumber.mockReturnValue(10);

  // Default: one sample record
  mockStyleDNAFindMany.mockResolvedValue([SAMPLE_DNA]);
});

// ─── getTrendingColors ─────────────────────────────────────────────────────────

describe('getTrendingColors', () => {
  it('throws AppError(403) when user tier is "free"', async () => {
    const req = makeReq({ user: { id: 'user-1', tier: 'free', email: 'free@example.com' } });
    const { res } = makeRes();
    await expect(getTrendingColors(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(403) when user tier is "plus"', async () => {
    const req = makeReq({ user: { id: 'user-1', tier: 'plus', email: 'plus@example.com' } });
    const { res } = makeRes();
    await expect(getTrendingColors(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns response with "period", "data", and "meta" fields when tier is "pro"', async () => {
    const req = makeReq({ query: { period: 'week' } });
    const { res, json } = makeRes();

    await getTrendingColors(req, res);

    expect(json).toHaveBeenCalledOnce();
    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('generated');
    expect(result.meta).toHaveProperty('totalRecords');
  });

  it('throws AppError(400) on invalid "period" query param', async () => {
    const req = makeReq({ query: { period: 'invalid-value' } });
    const { res } = makeRes();
    await expect(getTrendingColors(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('groups colors by week period when period="week" (uses getWeekNumber)', async () => {
    mockGetWeekNumber.mockReturnValue(10);
    const req = makeReq({ query: { period: 'week' } });
    const { res, json } = makeRes();

    await getTrendingColors(req, res);

    expect(mockGetWeekNumber).toHaveBeenCalled();
    const result = json.mock.calls[0][0];
    expect(result.period).toBe('week');
    // Period key should contain 'W' for week format
    if (result.data.length > 0) {
      expect(result.data[0].period).toMatch(/\d{4}-W\d{2}/);
    }
  });

  it('groups colors by month period when period="month"', async () => {
    const req = makeReq({ query: { period: 'month' } });
    const { res, json } = makeRes();

    await getTrendingColors(req, res);

    const result = json.mock.calls[0][0];
    expect(result.period).toBe('month');
    // getWeekNumber should NOT be called for month grouping
    expect(mockGetWeekNumber).not.toHaveBeenCalled();
    // Period key should match YYYY-MM format
    if (result.data.length > 0) {
      expect(result.data[0].period).toMatch(/\d{4}-\d{2}/);
    }
  });
});

// ─── getTrendingArchetypes ─────────────────────────────────────────────────────

describe('getTrendingArchetypes', () => {
  it('throws AppError(403) when user tier is "free"', async () => {
    const req = makeReq({ user: { id: 'user-1', tier: 'free', email: 'free@example.com' } });
    const { res } = makeRes();
    await expect(getTrendingArchetypes(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns response with "data" array where each entry has topArchetypes with archetype, count, trend fields', async () => {
    mockStyleDNAFindMany.mockResolvedValue([
      SAMPLE_DNA,
      {
        ...SAMPLE_DNA,
        id: 'dna-2',
        createdAt: new Date('2026-02-22T10:00:00Z'),
        styleArchetypes: ['classic', 'bohemian'],
      },
    ]);

    const req = makeReq({ query: { period: 'week' } });
    const { res, json } = makeRes();

    await getTrendingArchetypes(req, res);

    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);

    if (result.data.length > 0) {
      const firstPeriod = result.data[0];
      expect(firstPeriod).toHaveProperty('topArchetypes');
      expect(Array.isArray(firstPeriod.topArchetypes)).toBe(true);

      if (firstPeriod.topArchetypes.length > 0) {
        const archEntry = firstPeriod.topArchetypes[0];
        expect(archEntry).toHaveProperty('archetype');
        expect(archEntry).toHaveProperty('count');
        expect(archEntry).toHaveProperty('trend');
      }
    }
  });

  it('returns empty data array when no StyleDNA records exist', async () => {
    mockStyleDNAFindMany.mockResolvedValue([]);

    const req = makeReq({ query: { period: 'week' } });
    const { res, json } = makeRes();

    await getTrendingArchetypes(req, res);

    const result = json.mock.calls[0][0];
    expect(result.data).toEqual([]);
    expect(result.meta.totalRecords).toBe(0);
  });
});

// ─── getTrendSummary ──────────────────────────────────────────────────────────

describe('getTrendSummary', () => {
  it('throws AppError(403) when user tier is "free"', async () => {
    const req = makeReq({ user: { id: 'user-1', tier: 'free', email: 'free@example.com' } });
    const { res } = makeRes();
    await expect(getTrendSummary(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns summary with topColors, topArchetypes, topGarments, colorHarmonies, totalOutfits, meta fields', async () => {
    const req = makeReq();
    const { res, json } = makeRes();

    await getTrendSummary(req, res);

    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('topColors');
    expect(result).toHaveProperty('topArchetypes');
    expect(result).toHaveProperty('topGarments');
    expect(result).toHaveProperty('colorHarmonies');
    expect(result).toHaveProperty('totalOutfits');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('generated');
    expect(result.meta).toHaveProperty('periodStart');
    expect(result.meta).toHaveProperty('periodEnd');
  });

  it('totalOutfits equals the number of StyleDNA records returned', async () => {
    const records = [SAMPLE_DNA, { ...SAMPLE_DNA, id: 'dna-2' }, { ...SAMPLE_DNA, id: 'dna-3' }];
    mockStyleDNAFindMany.mockResolvedValue(records);

    const req = makeReq();
    const { res, json } = makeRes();

    await getTrendSummary(req, res);

    const result = json.mock.calls[0][0];
    expect(result.totalOutfits).toBe(3);
  });
});
