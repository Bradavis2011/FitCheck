import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPromptSectionFindMany = vi.hoisted(() => vi.fn());
const mockPromptSectionFindFirst = vi.hoisted(() => vi.fn());
const mockPromptSectionCreate = vi.hoisted(() => vi.fn());
const mockOutfitCheckFindMany = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    promptSection: {
      findMany: mockPromptSectionFindMany,
      findFirst: mockPromptSectionFindFirst,
      create: mockPromptSectionCreate,
    },
    outfitCheck: { findMany: mockOutfitCheckFindMany },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  readFromIntelligenceBus: vi.fn().mockResolvedValue([]),
}));

import {
  assemblePrompt,
  getSection,
  createSectionVersion,
  SECTION_KEYS,
} from '../prompt-assembly.service.js';

beforeEach(() => {
  mockPromptSectionFindMany.mockReset();
  mockPromptSectionFindFirst.mockReset();
  mockPromptSectionCreate.mockReset();
  mockOutfitCheckFindMany.mockReset();
  // getCategoryBiasCorrections queries outfitChecks — return empty so no corrections appended
  mockOutfitCheckFindMany.mockResolvedValue([]);
});

// ─── assemblePrompt ───────────────────────────────────────────────────────────

describe('assemblePrompt', () => {
  it('returns hardcoded fallback when no DB sections exist', async () => {
    mockPromptSectionFindMany.mockResolvedValue([]);

    const result = await assemblePrompt();

    expect(result.fromDB).toBe(false);
    expect(result.versionFingerprint).toBe('hardcoded');
    expect(result.text).toBe('');
    expect(result.sectionVersions).toEqual({});
  });

  it('assembles sections from DB in orderIndex order', async () => {
    mockPromptSectionFindMany.mockResolvedValue([
      { sectionKey: 'voice_persona', version: 2, content: 'A persona text', orderIndex: 1, isActive: true },
      { sectionKey: 'color_theory', version: 1, content: 'B color text', orderIndex: 2, isActive: true },
    ]);

    const result = await assemblePrompt();

    expect(result.fromDB).toBe(true);
    expect(result.text).toBe('A persona text\n\nB color text');
  });

  it('deduplicates sections — keeps highest-version per key', async () => {
    // DB returns v1 and v2 for same key (findMany with orderBy version desc)
    // The code iterates and keeps the FIRST occurrence per key (which is highest version due to DB sort)
    mockPromptSectionFindMany.mockResolvedValue([
      { sectionKey: 'voice_persona', version: 3, content: 'v3 text', orderIndex: 1, isActive: true },
      { sectionKey: 'voice_persona', version: 2, content: 'v2 text', orderIndex: 1, isActive: true },
      { sectionKey: 'color_theory', version: 1, content: 'color text', orderIndex: 2, isActive: true },
    ]);

    const result = await assemblePrompt();

    expect(result.text).toBe('v3 text\n\ncolor text'); // v3 kept, v2 discarded
    expect(result.sectionVersions['voice_persona']).toBe(3);
  });

  it('builds a version fingerprint as key:version pairs joined by |', async () => {
    mockPromptSectionFindMany.mockResolvedValue([
      { sectionKey: 'voice_persona', version: 2, content: 'A', orderIndex: 1, isActive: true },
      { sectionKey: 'color_theory', version: 5, content: 'B', orderIndex: 2, isActive: true },
    ]);

    const result = await assemblePrompt();

    expect(result.versionFingerprint).toContain('voice_persona:2');
    expect(result.versionFingerprint).toContain('color_theory:5');
  });

  it('returns error fallback when prisma throws', async () => {
    mockPromptSectionFindMany.mockRejectedValue(new Error('DB unavailable'));

    const result = await assemblePrompt();

    expect(result.fromDB).toBe(false);
    expect(result.versionFingerprint).toBe('fallback');
  });
});

// ─── getSection ───────────────────────────────────────────────────────────────

describe('getSection', () => {
  it('returns null when section does not exist', async () => {
    mockPromptSectionFindFirst.mockResolvedValue(null);
    expect(await getSection('voice_persona')).toBeNull();
  });

  it('returns section data with failedAttempts defaulting to []', async () => {
    mockPromptSectionFindFirst.mockResolvedValue({
      id: 'sec-1',
      version: 3,
      content: 'You are a fashion expert...',
      failedAttempts: null,
    });

    const result = await getSection('voice_persona');

    expect(result).toEqual({
      id: 'sec-1',
      version: 3,
      content: 'You are a fashion expert...',
      failedAttempts: [],
    });
  });

  it('returns existing failedAttempts array when present', async () => {
    const attempts = [{ changelog: 'tweak 1', failReason: 'rating dropped', attemptedAt: '2026-01-01T00:00:00Z' }];
    mockPromptSectionFindFirst.mockResolvedValue({
      id: 'sec-2',
      version: 4,
      content: 'Some content',
      failedAttempts: attempts,
    });

    const result = await getSection('voice_persona');
    expect(result?.failedAttempts).toEqual(attempts);
  });
});

// ─── createSectionVersion ─────────────────────────────────────────────────────

describe('createSectionVersion', () => {
  it('creates version 1 when no prior versions exist', async () => {
    mockPromptSectionFindFirst.mockResolvedValue(null); // no existing version
    mockPromptSectionCreate.mockResolvedValue({ id: 'new-1', version: 1 });

    const result = await createSectionVersion('voice_persona', 'New content', 'manual', 'Initial', 0);

    expect(mockPromptSectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1, isActive: false }),
      }),
    );
    expect(result).toEqual({ id: 'new-1', version: 1 });
  });

  it('increments version from the latest existing version', async () => {
    mockPromptSectionFindFirst.mockResolvedValue({ version: 4, orderIndex: 3 });
    mockPromptSectionCreate.mockResolvedValue({ id: 'new-5', version: 5 });

    const result = await createSectionVersion('voice_persona', 'Content v5', 'surgeon-mutation', 'Tuned tone', 4);

    expect(mockPromptSectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 5, parentVersion: 4, source: 'surgeon-mutation' }),
      }),
    );
    expect(result.version).toBe(5);
  });
});

// ─── SECTION_KEYS constant ────────────────────────────────────────────────────

describe('SECTION_KEYS', () => {
  it('contains 13 section keys', () => {
    expect(SECTION_KEYS).toHaveLength(13);
  });

  it('starts with voice_persona and ends with analysis_scoring', () => {
    expect(SECTION_KEYS[0]).toBe('voice_persona');
    expect(SECTION_KEYS[SECTION_KEYS.length - 1]).toBe('analysis_scoring');
  });
});
