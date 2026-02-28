import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAggregate = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: {
      aggregate: mockAggregate,
      findFirst: mockFindFirst,
    },
  },
}));

import { getOutfitMemory } from '../outfit-memory.service.js';

beforeEach(() => {
  mockAggregate.mockReset();
  mockFindFirst.mockReset();
});

describe('getOutfitMemory', () => {
  it('returns null immediately when occasions array is empty', async () => {
    const result = await getOutfitMemory('user-1', []);
    expect(result).toBeNull();
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('returns null when no outfit meets the threshold', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } }); // threshold = 7.5
    mockFindFirst.mockResolvedValue(null);
    const result = await getOutfitMemory('user-1', ['casual']);
    expect(result).toBeNull();
  });

  it('uses 7.0 default threshold when user has no score history', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: null } });
    mockFindFirst.mockResolvedValue(null);

    await getOutfitMemory('user-1', ['work']);

    // findFirst should be called with gte: 7.0
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aiScore: { gte: 7.0 } }),
      }),
    );
  });

  it('clamps threshold to minimum 6.0 when average is very low', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 5.0 } }); // 5.0 + 0.5 = 5.5 → clamped to 6.0
    mockFindFirst.mockResolvedValue(null);

    await getOutfitMemory('user-1', ['casual']);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aiScore: { gte: 6.0 } }),
      }),
    );
  });

  it('clamps threshold to maximum 8.5 when average is very high', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 9.0 } }); // 9.0 + 0.5 = 9.5 → clamped to 8.5
    mockFindFirst.mockResolvedValue(null);

    await getOutfitMemory('user-1', ['casual']);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aiScore: { gte: 8.5 } }),
      }),
    );
  });

  it('returns a well-formed OutfitMemory when a match is found', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } });
    mockFindFirst.mockResolvedValue({
      id: 'outfit-42',
      aiScore: 8.5,
      occasions: ['casual', 'date'],
      thumbnailUrl: 'https://example.com/img.jpg',
      thumbnailData: null,
      aiFeedback: { editorialSummary: 'Great look!' },
      createdAt: new Date('2025-01-15T12:00:00Z'),
    });

    const result = await getOutfitMemory('user-1', ['casual', 'work']);

    expect(result).toEqual({
      id: 'outfit-42',
      aiScore: 8.5,
      occasion: 'casual', // first occasion that matches
      thumbnailUrl: 'https://example.com/img.jpg',
      thumbnailData: null,
      summary: 'Great look!',
      createdAt: '2025-01-15T12:00:00.000Z',
    });
  });

  it('prefers editorialSummary over legacy summary field', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } });
    mockFindFirst.mockResolvedValue({
      id: 'outfit-1',
      aiScore: 8.0,
      occasions: ['casual'],
      thumbnailUrl: null,
      thumbnailData: null,
      aiFeedback: { editorialSummary: 'Editorial text', summary: 'Legacy text' },
      createdAt: new Date('2025-02-01T00:00:00Z'),
    });

    const result = await getOutfitMemory('user-1', ['casual']);
    expect(result?.summary).toBe('Editorial text');
  });

  it('falls back to legacy summary when editorialSummary is absent', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } });
    mockFindFirst.mockResolvedValue({
      id: 'outfit-2',
      aiScore: 7.5,
      occasions: ['work'],
      thumbnailUrl: null,
      thumbnailData: null,
      aiFeedback: { summary: 'Legacy summary only' },
      createdAt: new Date('2025-02-01T00:00:00Z'),
    });

    const result = await getOutfitMemory('user-1', ['work']);
    expect(result?.summary).toBe('Legacy summary only');
  });

  it('returns null summary when aiFeedback has neither field', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } });
    mockFindFirst.mockResolvedValue({
      id: 'outfit-3',
      aiScore: 7.5,
      occasions: ['casual'],
      thumbnailUrl: null,
      thumbnailData: null,
      aiFeedback: {},
      createdAt: new Date('2025-02-01T00:00:00Z'),
    });

    const result = await getOutfitMemory('user-1', ['casual']);
    expect(result?.summary).toBeNull();
  });

  it('picks the first matching occasion from the provided list', async () => {
    mockAggregate.mockResolvedValue({ _avg: { aiScore: 7.0 } });
    mockFindFirst.mockResolvedValue({
      id: 'outfit-4',
      aiScore: 8.0,
      occasions: ['date', 'casual'],
      thumbnailUrl: null,
      thumbnailData: null,
      aiFeedback: {},
      createdAt: new Date('2025-02-01T00:00:00Z'),
    });

    // 'work' is not in the outfit, 'casual' is
    const result = await getOutfitMemory('user-1', ['work', 'casual']);
    expect(result?.occasion).toBe('casual');
  });
});
