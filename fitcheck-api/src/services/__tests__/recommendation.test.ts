import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { getRecommendations } from '../recommendation.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_DNA = (
  aiScore: number,
  colorHarmony: string,
  colors: string[],
  archetypes: string[],
) => ({
  dominantColors: colors,
  styleArchetypes: archetypes,
  colorHarmony,
  formalityLevel: 3,
  colorScore: 7,
  proportionScore: 6,
  fitScore: 8,
  coherenceScore: 5, // low — will be weakest
  garments: ['jeans', 'blazer'],
  outfitCheck: { aiScore, occasions: ['Work'], weather: 'clear' },
});

const FIVE_RECORDS = [
  SAMPLE_DNA(8, 'complementary', ['navy', 'white'], ['classic', 'minimalist']),
  SAMPLE_DNA(7, 'complementary', ['navy', 'beige'], ['classic']),
  SAMPLE_DNA(9, 'complementary', ['navy', 'white'], ['classic']),
  SAMPLE_DNA(6, 'analogous', ['green', 'olive'], ['streetwear']),
  SAMPLE_DNA(8, 'complementary', ['navy', 'white'], ['classic']),
];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStyleDNAFindMany.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─── getRecommendations — generic fallback ────────────────────────────────────

describe('getRecommendations — fewer than 3 StyleDNA records', () => {
  it('returns generic recommendations (2 items) when user has fewer than 3 StyleDNA records', async () => {
    mockStyleDNAFindMany.mockResolvedValue([SAMPLE_DNA(7, 'complementary', ['navy'], ['classic'])]);

    const result = await getRecommendations('user-1', {});

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('first generic recommendation has title "Start with Neutrals"', async () => {
    mockStyleDNAFindMany.mockResolvedValue([]);

    const result = await getRecommendations('user-1', {});

    expect(result[0].title).toBe('Start with Neutrals');
  });
});

// ─── getRecommendations — personalized recommendations ────────────────────────

describe('getRecommendations — 5 StyleDNA records (enough data)', () => {
  it('returns an array with up to 3 personalized recommendations', async () => {
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', {});

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('"Your Signature Look" is included when bestColorCombo.count >= 2 (complementary used 4 times)', async () => {
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', {});

    const signatureLook = result.find(r => r.title === 'Your Signature Look');
    expect(signatureLook).toBeDefined();
  });

  it('"[Archetype] Essential" is included when topArchetypes.length > 0 ("classic" is top archetype)', async () => {
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', {});

    const archetypeRec = result.find(r => r.title.toLowerCase().includes('essential'));
    expect(archetypeRec).toBeDefined();
    // "classic" appears 4 times → should be primary archetype
    expect(archetypeRec!.title.toLowerCase()).toContain('classic');
  });

  it('personalized recommendations have confidence, reasoning (array), and suggestedColors fields', async () => {
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', {});

    for (const rec of result) {
      expect(typeof rec.confidence).toBe('number');
      expect(Array.isArray(rec.reasoning)).toBe(true);
      expect(Array.isArray(rec.suggestedColors)).toBe(true);
    }
  });
});

// ─── getRecommendations — context-aware (occasion/weather) ───────────────────

describe('getRecommendations — context-aware recommendations', () => {
  it('"Proven for [context]" recommendation included when occasion matches and >= 2 records match', async () => {
    // All 5 FIVE_RECORDS have occasions: ['Work'], so 'Work' matches all
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', { occasion: 'Work' });

    const contextRec = result.find(r => r.title.startsWith('Proven for'));
    expect(contextRec).toBeDefined();
    expect(contextRec!.title).toContain('Work');
  });

  it('does not include "Proven for..." when no records match the occasion', async () => {
    mockStyleDNAFindMany.mockResolvedValue(FIVE_RECORDS);

    const result = await getRecommendations('user-1', { occasion: 'BlackTieGala' });

    const contextRec = result.find(r => r.title.startsWith('Proven for'));
    expect(contextRec).toBeUndefined();
  });
});
