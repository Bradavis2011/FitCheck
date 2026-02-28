import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockWardrobeItemFindFirst = vi.hoisted(() => vi.fn());
const mockWardrobeItemFindMany = vi.hoisted(() => vi.fn());
const mockWardrobeItemCreate = vi.hoisted(() => vi.fn());
const mockWardrobeItemUpdate = vi.hoisted(() => vi.fn());
const mockWardrobeItemOutfitUpsert = vi.hoisted(() => vi.fn());
const mockWardrobeItemOutfitCount = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    wardrobeItem: {
      findFirst: mockWardrobeItemFindFirst,
      findMany: mockWardrobeItemFindMany,
      create: mockWardrobeItemCreate,
      update: mockWardrobeItemUpdate,
    },
    wardrobeItemOutfit: {
      upsert: mockWardrobeItemOutfitUpsert,
      count: mockWardrobeItemOutfitCount,
    },
  },
}));

import {
  normalizeName,
  resolveCategory,
  extractColorAndBase,
  syncGarmentsToWardrobe,
} from '../wardrobe-sync.service.js';

beforeEach(() => {
  mockWardrobeItemFindFirst.mockReset();
  mockWardrobeItemFindMany.mockReset();
  mockWardrobeItemCreate.mockReset();
  mockWardrobeItemUpdate.mockReset();
  mockWardrobeItemOutfitUpsert.mockReset();
  mockWardrobeItemOutfitCount.mockReset();
});

// ─── normalizeName ─────────────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('lowercases and trims input', () => {
    expect(normalizeName('  Black Jeans  ')).toBe('black jeans');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('blue   denim   jacket')).toBe('blue denim jacket');
  });

  it('replaces grey with gray', () => {
    expect(normalizeName('Grey Boots')).toBe('gray boots');
  });

  it('handles already-lowercase clean input unchanged', () => {
    expect(normalizeName('white sneaker')).toBe('white sneaker');
  });
});

// ─── resolveCategory ──────────────────────────────────────────────────────────

describe('resolveCategory', () => {
  it('matches an exact keyword', () => {
    expect(resolveCategory('sneaker')).toBe('shoes');
  });

  it('matches via substring (plural / with color prefix)', () => {
    expect(resolveCategory('white sneakers')).toBe('shoes');
    expect(resolveCategory('black boots')).toBe('shoes');
  });

  it('maps jeans/trouser to bottoms', () => {
    expect(resolveCategory('blue jeans')).toBe('bottoms');
    expect(resolveCategory('trousers')).toBe('bottoms');
  });

  it('maps blazer/jacket to outerwear', () => {
    expect(resolveCategory('navy blazer')).toBe('outerwear');
  });

  it('maps shirt/top to tops', () => {
    expect(resolveCategory('striped shirt')).toBe('tops');
    expect(resolveCategory('crop top')).toBe('tops');
  });

  it('maps bag/hat/scarf to accessories', () => {
    expect(resolveCategory('leather bag')).toBe('accessories');
    expect(resolveCategory('wool scarf')).toBe('accessories');
  });

  it('returns null for uncategorizable items', () => {
    expect(resolveCategory('random widget')).toBeNull();
    expect(resolveCategory('')).toBeNull();
  });
});

// ─── extractColorAndBase ──────────────────────────────────────────────────────

describe('extractColorAndBase', () => {
  it('strips a single leading color word', () => {
    expect(extractColorAndBase('blue jeans')).toEqual({ color: 'blue', baseName: 'jeans' });
  });

  it('strips multiple leading color words', () => {
    expect(extractColorAndBase('navy blue blazer')).toEqual({ color: 'navy blue', baseName: 'blazer' });
  });

  it('returns null color when no leading color words', () => {
    expect(extractColorAndBase('striped shirt')).toEqual({ color: null, baseName: 'striped shirt' });
  });

  it('uses normalized input as baseName when all words are colors', () => {
    const { baseName, color } = extractColorAndBase('black');
    expect(color).toBe('black');
    expect(baseName).toBe('black'); // fallback to original
  });

  it('does not strip color words in the middle of the name', () => {
    // 'striped' is not a color, so 'black' after it is treated as base
    const { color, baseName } = extractColorAndBase('striped black pants');
    expect(color).toBeNull();
    expect(baseName).toBe('striped black pants');
  });
});

// ─── syncGarmentsToWardrobe ───────────────────────────────────────────────────

describe('syncGarmentsToWardrobe', () => {
  it('does nothing when garments array is empty', async () => {
    await syncGarmentsToWardrobe('user-1', 'outfit-1', [], []);
    expect(mockWardrobeItemFindFirst).not.toHaveBeenCalled();
  });

  it('skips garments that cannot be categorized', async () => {
    await syncGarmentsToWardrobe('user-1', 'outfit-1', ['undefined widget'], []);
    expect(mockWardrobeItemCreate).not.toHaveBeenCalled();
  });

  it('creates a new wardrobe item when no existing match is found', async () => {
    mockWardrobeItemFindFirst.mockResolvedValue(null);    // no exact match
    mockWardrobeItemFindMany.mockResolvedValue([]);       // no fuzzy match
    mockWardrobeItemCreate.mockResolvedValue({ id: 'new-item-1' });
    mockWardrobeItemOutfitUpsert.mockResolvedValue({});
    mockWardrobeItemOutfitCount.mockResolvedValue(1);
    mockWardrobeItemUpdate.mockResolvedValue({});

    await syncGarmentsToWardrobe('user-1', 'outfit-1', ['Blue Jeans'], []);

    expect(mockWardrobeItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          category: 'bottoms',
          source: 'ai-detected',
          normalizedName: 'blue jeans',
        }),
      }),
    );
    expect(mockWardrobeItemOutfitUpsert).toHaveBeenCalled();
    expect(mockWardrobeItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timesWorn: 1, lastWorn: expect.any(Date) } }),
    );
  });

  it('reuses an existing item found by exact normalizedName match', async () => {
    mockWardrobeItemFindFirst.mockResolvedValue({ id: 'existing-item-1' });
    mockWardrobeItemOutfitUpsert.mockResolvedValue({});
    mockWardrobeItemOutfitCount.mockResolvedValue(3);
    mockWardrobeItemUpdate.mockResolvedValue({});

    await syncGarmentsToWardrobe('user-1', 'outfit-1', ['Navy Blazer'], []);

    expect(mockWardrobeItemCreate).not.toHaveBeenCalled();
    expect(mockWardrobeItemOutfitUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wardrobeItemId_outfitCheckId: { wardrobeItemId: 'existing-item-1', outfitCheckId: 'outfit-1' } },
      }),
    );
    expect(mockWardrobeItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timesWorn: 3, lastWorn: expect.any(Date) } }),
    );
  });

  it('uses fuzzy match when exact match is absent but same baseName exists in category', async () => {
    // Exact match: none; fuzzy: item with same baseName 'blazer' in category 'outerwear'
    mockWardrobeItemFindFirst.mockResolvedValue(null);
    mockWardrobeItemFindMany.mockResolvedValue([
      { id: 'fuzzy-item-1', normalizedName: 'black blazer' }, // baseName 'blazer' matches
    ]);
    mockWardrobeItemOutfitUpsert.mockResolvedValue({});
    mockWardrobeItemOutfitCount.mockResolvedValue(2);
    mockWardrobeItemUpdate.mockResolvedValue({});

    await syncGarmentsToWardrobe('user-1', 'outfit-1', ['Gray Blazer'], []);

    expect(mockWardrobeItemCreate).not.toHaveBeenCalled();
    expect(mockWardrobeItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fuzzy-item-1' } }),
    );
  });
});
