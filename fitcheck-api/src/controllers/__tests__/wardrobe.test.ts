import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockWardrobeFindMany = vi.hoisted(() => vi.fn());
const mockWardrobeFindFirst = vi.hoisted(() => vi.fn());
const mockWardrobeCreate = vi.hoisted(() => vi.fn());
const mockWardrobeUpdate = vi.hoisted(() => vi.fn());
const mockWardrobeDelete = vi.hoisted(() => vi.fn());
const mockWardrobeCount = vi.hoisted(() => vi.fn());
const mockWardrobeGroupBy = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockWardrobeItemOutfitFindMany = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    wardrobeItem: {
      findMany: mockWardrobeFindMany,
      findFirst: mockWardrobeFindFirst,
      create: mockWardrobeCreate,
      update: mockWardrobeUpdate,
      delete: mockWardrobeDelete,
      count: mockWardrobeCount,
      groupBy: mockWardrobeGroupBy,
    },
    wardrobeItemOutfit: { findMany: mockWardrobeItemOutfitFindMany },
    outfitCheck: { count: mockOutfitCount },
  },
}));

import {
  listWardrobeItems,
  getWardrobeProgress,
  getWardrobeItemOutfits,
  getWardrobeItem,
  createWardrobeItem,
  updateWardrobeItem,
  deleteWardrobeItem,
  logWear,
} from '../wardrobe.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1' },
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

const SAMPLE_ITEM = {
  id: 'item-1',
  userId: 'user-1',
  name: 'Blue Blazer',
  category: 'tops',
  color: 'blue',
  timesWorn: 2,
  lastWorn: null,
  imageUrl: null,
  source: 'manual',
  _count: { outfitLinks: 0 },
};

beforeEach(() => {
  mockWardrobeFindMany.mockReset();
  mockWardrobeFindFirst.mockReset();
  mockWardrobeCreate.mockReset();
  mockWardrobeUpdate.mockReset();
  mockWardrobeDelete.mockReset();
  mockWardrobeCount.mockReset();
  mockWardrobeGroupBy.mockReset();
  mockOutfitCount.mockReset();
  mockWardrobeItemOutfitFindMany.mockReset();

  mockWardrobeFindMany.mockResolvedValue([SAMPLE_ITEM]);
  mockWardrobeFindFirst.mockResolvedValue(SAMPLE_ITEM);
  mockWardrobeCreate.mockResolvedValue(SAMPLE_ITEM);
  mockWardrobeUpdate.mockResolvedValue(SAMPLE_ITEM);
  mockWardrobeDelete.mockResolvedValue(SAMPLE_ITEM);
  mockWardrobeCount.mockResolvedValue(3);
  mockWardrobeGroupBy.mockResolvedValue([{ category: 'tops', _count: { id: 2 } }]);
  mockOutfitCount.mockResolvedValue(5);
  mockWardrobeItemOutfitFindMany.mockResolvedValue([]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listWardrobeItems', () => {
  it('returns all items for the current user', async () => {
    const req = makeReq();
    const { res, json } = makeRes();

    await listWardrobeItems(req, res);

    expect(mockWardrobeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
    expect(json).toHaveBeenCalledWith({ items: [SAMPLE_ITEM] });
  });

  it('filters by category when a valid category is provided', async () => {
    const req = makeReq({ query: { category: 'tops' } });
    const { res } = makeRes();

    await listWardrobeItems(req, res);

    const where = mockWardrobeFindMany.mock.calls[0][0].where;
    expect(where.category).toBe('tops');
  });

  it('ignores an invalid category query param', async () => {
    const req = makeReq({ query: { category: 'invalid' } });
    const { res } = makeRes();

    await listWardrobeItems(req, res);

    const where = mockWardrobeFindMany.mock.calls[0][0].where;
    expect(where.category).toBeUndefined();
  });

  it('filters by source=ai-detected when provided', async () => {
    const req = makeReq({ query: { source: 'ai-detected' } });
    const { res } = makeRes();

    await listWardrobeItems(req, res);

    const where = mockWardrobeFindMany.mock.calls[0][0].where;
    expect(where.source).toBe('ai-detected');
  });

  it('ignores an invalid source query param', async () => {
    const req = makeReq({ query: { source: 'unknown' } });
    const { res } = makeRes();

    await listWardrobeItems(req, res);

    const where = mockWardrobeFindMany.mock.calls[0][0].where;
    expect(where.source).toBeUndefined();
  });
});

describe('getWardrobeProgress', () => {
  it('returns progress data with isUnlocked=false when below threshold', async () => {
    mockOutfitCount.mockResolvedValue(5); // below 10

    const { res, json } = makeRes();
    await getWardrobeProgress(makeReq(), res);

    const result = json.mock.calls[0][0];
    expect(result.isUnlocked).toBe(false);
    expect(result.progress).toBe(5);
    expect(result.unlockThreshold).toBe(10);
  });

  it('returns isUnlocked=true when at the threshold', async () => {
    mockOutfitCount.mockResolvedValue(10);

    const { res, json } = makeRes();
    await getWardrobeProgress(makeReq(), res);

    expect(json.mock.calls[0][0].isUnlocked).toBe(true);
  });

  it('caps progress at the unlock threshold (not above 10)', async () => {
    mockOutfitCount.mockResolvedValue(25);

    const { res, json } = makeRes();
    await getWardrobeProgress(makeReq(), res);

    expect(json.mock.calls[0][0].progress).toBe(10);
  });

  it('includes wardrobeItemCount in the response', async () => {
    mockWardrobeCount.mockResolvedValue(7);

    const { res, json } = makeRes();
    await getWardrobeProgress(makeReq(), res);

    expect(json.mock.calls[0][0].wardrobeItemCount).toBe(7);
  });

  it('includes category breakdown map from groupBy', async () => {
    mockWardrobeGroupBy.mockResolvedValue([
      { category: 'tops', _count: { id: 4 } },
      { category: 'shoes', _count: { id: 2 } },
    ]);

    const { res, json } = makeRes();
    await getWardrobeProgress(makeReq(), res);

    expect(json.mock.calls[0][0].categoryCounts).toEqual({ tops: 4, shoes: 2 });
  });
});

describe('getWardrobeItem', () => {
  it('returns the wardrobe item when it exists', async () => {
    const req = makeReq({ params: { id: 'item-1' } });
    const { res, json } = makeRes();

    await getWardrobeItem(req, res);

    expect(json).toHaveBeenCalledWith({ item: SAMPLE_ITEM });
  });

  it('throws AppError(404) when the item does not exist', async () => {
    mockWardrobeFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'missing' } });
    const { res } = makeRes();

    await expect(getWardrobeItem(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('enforces ownership — only returns item if userId matches', async () => {
    const req = makeReq({ user: { id: 'other-user', email: 'other@test.com', tier: 'free' }, params: { id: 'item-1' } });
    const { res } = makeRes();

    await getWardrobeItem(req, res);

    const where = mockWardrobeFindFirst.mock.calls[0][0].where;
    expect(where.userId).toBe('other-user');
  });
});

describe('getWardrobeItemOutfits', () => {
  it('throws AppError(404) when the wardrobe item does not exist', async () => {
    mockWardrobeFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'missing' } });
    const { res } = makeRes();

    await expect(getWardrobeItemOutfits(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns outfits linked to the wardrobe item', async () => {
    const fakeOutfit = { id: 'oc-1', aiScore: 8, occasions: ['Work'] };
    mockWardrobeItemOutfitFindMany.mockResolvedValue([
      { wardrobeItemId: 'item-1', outfitCheck: fakeOutfit },
    ]);
    const req = makeReq({ params: { id: 'item-1' } });
    const { res, json } = makeRes();

    await getWardrobeItemOutfits(req, res);

    expect(json).toHaveBeenCalledWith({ outfits: [fakeOutfit] });
  });
});

describe('createWardrobeItem', () => {
  it('creates a wardrobe item and responds with 201', async () => {
    mockWardrobeCreate.mockResolvedValue({ ...SAMPLE_ITEM, id: 'item-new' });
    const req = makeReq({ body: { name: 'Black Jeans', category: 'bottoms' } });
    const statusMock = vi.fn().mockReturnValue({ json: vi.fn() });
    const res = { status: statusMock } as unknown as Response;

    await createWardrobeItem(req, res);

    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('persists the correct data', async () => {
    const req = makeReq({ body: { name: 'Red Sneakers', category: 'shoes', color: 'red' } });
    const statusMock = vi.fn().mockReturnValue({ json: vi.fn() });
    const res = { status: statusMock } as unknown as Response;

    await createWardrobeItem(req, res);

    expect(mockWardrobeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Red Sneakers',
          category: 'shoes',
          color: 'red',
        }),
      }),
    );
  });

  it('throws a ZodError on invalid category', async () => {
    const req = makeReq({ body: { name: 'Item', category: 'invalid' } });
    const { res } = makeRes();

    await expect(createWardrobeItem(req, res)).rejects.toThrow();
    expect(mockWardrobeCreate).not.toHaveBeenCalled();
  });

  it('throws a ZodError when name is missing', async () => {
    const req = makeReq({ body: { category: 'tops' } });
    const { res } = makeRes();

    await expect(createWardrobeItem(req, res)).rejects.toThrow();
  });
});

describe('updateWardrobeItem', () => {
  it('throws AppError(404) when item does not exist', async () => {
    mockWardrobeFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'missing' }, body: { name: 'New Name' } });
    const { res } = makeRes();

    await expect(updateWardrobeItem(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates and returns the item', async () => {
    const updated = { ...SAMPLE_ITEM, name: 'Updated Name' };
    mockWardrobeUpdate.mockResolvedValue(updated);
    const req = makeReq({ params: { id: 'item-1' }, body: { name: 'Updated Name' } });
    const { res, json } = makeRes();

    await updateWardrobeItem(req, res);

    expect(json).toHaveBeenCalledWith({ item: updated });
  });

  it('only updates fields that are provided', async () => {
    const req = makeReq({ params: { id: 'item-1' }, body: { color: 'green' } });
    const { res } = makeRes();

    await updateWardrobeItem(req, res);

    const data = mockWardrobeUpdate.mock.calls[0][0].data;
    expect(data.color).toBe('green');
    expect(data.name).toBeUndefined();
  });
});

describe('deleteWardrobeItem', () => {
  it('throws AppError(404) when item does not exist', async () => {
    mockWardrobeFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'missing' } });
    const { res } = makeRes();

    await expect(deleteWardrobeItem(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes the item and returns success', async () => {
    const req = makeReq({ params: { id: 'item-1' } });
    const { res, json } = makeRes();

    await deleteWardrobeItem(req, res);

    expect(mockWardrobeDelete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

describe('logWear', () => {
  it('throws AppError(404) when item does not exist', async () => {
    mockWardrobeFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'missing' } });
    const { res } = makeRes();

    await expect(logWear(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('increments timesWorn and sets lastWorn', async () => {
    const req = makeReq({ params: { id: 'item-1' } });
    const { res } = makeRes();

    await logWear(req, res);

    expect(mockWardrobeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          timesWorn: { increment: 1 },
          lastWorn: expect.any(Date),
        }),
      }),
    );
  });

  it('returns the updated item', async () => {
    const worn = { ...SAMPLE_ITEM, timesWorn: 3 };
    mockWardrobeUpdate.mockResolvedValue(worn);
    const req = makeReq({ params: { id: 'item-1' } });
    const { res, json } = makeRes();

    await logWear(req, res);

    expect(json).toHaveBeenCalledWith({ item: worn });
  });
});
