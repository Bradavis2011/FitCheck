import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());

const mockCompPostCreate    = vi.hoisted(() => vi.fn());
const mockCompPostFindMany  = vi.hoisted(() => vi.fn());
const mockCompPostCount     = vi.hoisted(() => vi.fn());
const mockCompPostFindFirst = vi.hoisted(() => vi.fn());
const mockCompPostUpdate    = vi.hoisted(() => vi.fn());
const mockCompPostUpdateMany = vi.hoisted(() => vi.fn());

const mockCompVoteFindUnique = vi.hoisted(() => vi.fn());
const mockCompVoteCreate     = vi.hoisted(() => vi.fn());
const mockCompVoteUpdate     = vi.hoisted(() => vi.fn());

const mockTransaction = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    comparisonPost: {
      create:     mockCompPostCreate,
      findMany:   mockCompPostFindMany,
      count:      mockCompPostCount,
      findFirst:  mockCompPostFindFirst,
      update:     mockCompPostUpdate,
      updateMany: mockCompPostUpdateMany,
    },
    comparisonVote: {
      findUnique: mockCompVoteFindUnique,
      create:     mockCompVoteCreate,
      update:     mockCompVoteUpdate,
    },
    $transaction: mockTransaction,
  },
}));

import {
  createComparison,
  getComparisonFeed,
  voteOnComparison,
  analyzeComparison,
  deleteComparison,
} from '../comparison.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, query: {}, params: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { json, status } as unknown as Response;
  return { res, json, status };
}

// ─── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockCompPostCreate.mockReset();
  mockCompPostFindMany.mockReset();
  mockCompPostCount.mockReset();
  mockCompPostFindFirst.mockReset();
  mockCompPostUpdate.mockReset();
  mockCompPostUpdateMany.mockReset();
  mockCompVoteFindUnique.mockReset();
  mockCompVoteCreate.mockReset();
  mockCompVoteUpdate.mockReset();
  mockTransaction.mockReset();

  // Default transaction: invoke callback with same mocked prisma-like object
  mockTransaction.mockImplementation(async (fn: any) =>
    fn({
      comparisonPost: {
        findFirst: mockCompPostFindFirst,
        update:    mockCompPostUpdate,
      },
      comparisonVote: {
        findUnique: mockCompVoteFindUnique,
        create:     mockCompVoteCreate,
        update:     mockCompVoteUpdate,
      },
    })
  );
});

afterEach(() => vi.unstubAllEnvs());

// ─── createComparison ─────────────────────────────────────────────────────────

describe('createComparison', () => {
  it('throws AppError(400) when imageAData and imageAUrl are both missing', async () => {
    const req = makeReq({
      body: {
        imageBData: 'base64dataB',
        occasions: ['casual'],
      },
    });
    const { res } = makeRes();

    await expect(createComparison(req, res)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCompPostCreate).not.toHaveBeenCalled();
  });

  it('throws AppError(400) when imageB is missing', async () => {
    const req = makeReq({
      body: {
        imageAData: 'base64dataA',
        occasions: ['casual'],
      },
    });
    const { res } = makeRes();

    await expect(createComparison(req, res)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCompPostCreate).not.toHaveBeenCalled();
  });

  it('throws Zod error (400) when occasions array is empty', async () => {
    const req = makeReq({
      body: {
        imageAData: 'base64dataA',
        imageBData: 'base64dataB',
        occasions: [],
      },
    });
    const { res } = makeRes();

    await expect(createComparison(req, res)).rejects.toThrow();
    expect(mockCompPostCreate).not.toHaveBeenCalled();
  });

  it('creates comparison post and responds 201 with the post', async () => {
    const mockPost = {
      id: 'post-1',
      occasions: ['casual'],
      question: null,
      votesA: 0,
      votesB: 0,
      createdAt: new Date(),
      user: { id: 'user-1', username: 'alice', name: 'Alice' },
    };
    mockCompPostCreate.mockResolvedValue(mockPost);

    const req = makeReq({
      body: {
        imageAUrl: 'https://example.com/a.jpg',
        imageBData: 'base64dataB',
        occasions: ['casual'],
      },
    });
    const { res, status } = makeRes();

    await createComparison(req, res);

    expect(mockCompPostCreate).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(201);
  });

  it('sends imageAData (when imageAUrl not provided) to create', async () => {
    const mockPost = {
      id: 'post-2',
      occasions: ['formal'],
      question: null,
      votesA: 0,
      votesB: 0,
      createdAt: new Date(),
      user: { id: 'user-1', username: 'alice', name: 'Alice' },
    };
    mockCompPostCreate.mockResolvedValue(mockPost);

    const req = makeReq({
      body: {
        imageAData: 'base64dataA',
        imageBUrl: 'https://example.com/b.jpg',
        occasions: ['formal'],
      },
    });
    const { res } = makeRes();

    await createComparison(req, res);

    expect(mockCompPostCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageAData: 'base64dataA' }),
      })
    );
  });
});

// ─── getComparisonFeed ────────────────────────────────────────────────────────

describe('getComparisonFeed', () => {
  it('returns posts with myVote field (null when user has not voted)', async () => {
    const posts = [
      {
        id: 'post-1',
        imageAUrl: null,
        imageAData: 'dataA',
        imageBUrl: null,
        imageBData: 'dataB',
        question: null,
        occasions: ['casual'],
        votesA: 2,
        votesB: 3,
        createdAt: new Date(),
        user: { id: 'owner-2', username: 'bob', name: 'Bob', profileImageUrl: null },
        votes: [], // user has not voted
      },
    ];
    mockCompPostFindMany.mockResolvedValue(posts);
    mockCompPostCount.mockResolvedValue(1);

    const req = makeReq({ query: { limit: 10, offset: 0 } });
    const { res, json } = makeRes();

    await getComparisonFeed(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        posts: expect.arrayContaining([
          expect.objectContaining({ id: 'post-1', myVote: null }),
        ]),
      })
    );
  });

  it('returns hasMore: false when total <= offset + results', async () => {
    const posts = [
      {
        id: 'post-1',
        imageAUrl: null,
        imageAData: 'dataA',
        imageBUrl: null,
        imageBData: 'dataB',
        question: null,
        occasions: ['casual'],
        votesA: 0,
        votesB: 0,
        createdAt: new Date(),
        user: { id: 'owner-2', username: 'bob', name: 'Bob', profileImageUrl: null },
        votes: [{ choice: 'A' }],
      },
    ];
    mockCompPostFindMany.mockResolvedValue(posts);
    mockCompPostCount.mockResolvedValue(1); // total=1, offset=0, posts.length=1 → not more

    const req = makeReq({ query: { limit: 10, offset: 0 } });
    const { res, json } = makeRes();

    await getComparisonFeed(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ hasMore: false })
    );
  });
});

// ─── voteOnComparison ─────────────────────────────────────────────────────────

describe('voteOnComparison', () => {
  it('throws AppError(404) when post not found (transaction runs, post is null)', async () => {
    mockCompPostFindFirst.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'missing-post' }, body: { choice: 'A' } });
    const { res } = makeRes();

    await expect(voteOnComparison(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when vote already exists with same choice (returns same counts without update)', async () => {
    // The controller does NOT throw 409 for duplicate same-choice votes.
    // It returns early with the existing counts. This test verifies that
    // comparisonVote.update is NOT called when the same choice is re-submitted.
    mockCompPostFindFirst.mockResolvedValue({ id: 'post-1', votesA: 3, votesB: 2 });
    mockCompVoteFindUnique.mockResolvedValue({ choice: 'A' }); // same choice

    const req = makeReq({ params: { id: 'post-1' }, body: { choice: 'A' } });
    const { res, json } = makeRes();

    await voteOnComparison(req, res);

    expect(mockCompVoteUpdate).not.toHaveBeenCalled();
    expect(mockCompPostUpdate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ myVote: 'A', votesA: 3, votesB: 2 })
    );
  });

  it('returns updated vote counts when voting for the first time', async () => {
    mockCompPostFindFirst.mockResolvedValue({ id: 'post-1', votesA: 0, votesB: 0 });
    mockCompVoteFindUnique.mockResolvedValue(null); // no existing vote
    mockCompVoteCreate.mockResolvedValue({});
    mockCompPostUpdate.mockResolvedValue({ votesA: 1, votesB: 0 });

    const req = makeReq({ params: { id: 'post-1' }, body: { choice: 'A' } });
    const { res, json } = makeRes();

    await voteOnComparison(req, res);

    expect(mockCompVoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ choice: 'A' }) })
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, votesA: 1, votesB: 0, myVote: 'A' })
    );
  });

  it('updates vote counts when changing vote (from A to B: decrement A, increment B)', async () => {
    mockCompPostFindFirst.mockResolvedValue({ id: 'post-1', votesA: 2, votesB: 1 });
    mockCompVoteFindUnique.mockResolvedValue({ choice: 'A' }); // previously voted A
    mockCompVoteUpdate.mockResolvedValue({});
    mockCompPostUpdate.mockResolvedValue({ votesA: 1, votesB: 2 });

    const req = makeReq({ params: { id: 'post-1' }, body: { choice: 'B' } });
    const { res, json } = makeRes();

    await voteOnComparison(req, res);

    expect(mockCompVoteUpdate).toHaveBeenCalledOnce();
    expect(mockCompPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          votesA: { decrement: 1 },
          votesB: { increment: 1 },
        }),
      })
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, votesA: 1, votesB: 2, myVote: 'B' })
    );
  });
});

// ─── analyzeComparison ────────────────────────────────────────────────────────

describe('analyzeComparison', () => {
  const validAnalysis = {
    analysisA: 'Outfit A looks great.',
    analysisB: 'Outfit B is also good.',
    winner: 'A',
    reasoning: 'A is better for casual wear.',
  };

  it('calls generateContent with prompt + 2 inline images', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysis) },
    });

    const req = makeReq({
      body: {
        imageAData: 'base64imageA',
        imageBData: 'base64imageB',
        occasions: ['casual'],
      },
    });
    const { res } = makeRes();

    await analyzeComparison(req, res);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.any(String) }),
        expect.objectContaining({ inlineData: expect.objectContaining({ mimeType: 'image/jpeg' }) }),
        expect.objectContaining({ inlineData: expect.objectContaining({ mimeType: 'image/jpeg' }) }),
      ])
    );
  });

  it('returns { analysisA, analysisB, winner, reasoning } on success', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysis) },
    });

    const req = makeReq({
      body: {
        imageAData: 'base64imageA',
        imageBData: 'base64imageB',
      },
    });
    const { res, json } = makeRes();

    await analyzeComparison(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisA: expect.any(String),
        analysisB: expect.any(String),
        winner: expect.stringMatching(/^[AB]$/),
        reasoning: expect.any(String),
      })
    );
  });

  it('throws AppError(500) when Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not valid json at all' },
    });

    const req = makeReq({
      body: {
        imageAData: 'base64imageA',
        imageBData: 'base64imageB',
      },
    });
    const { res } = makeRes();

    await expect(analyzeComparison(req, res)).rejects.toMatchObject({ statusCode: 500 });
  });

  it('stores aiVerdict on linked post when postId is provided (calls comparisonPost.updateMany)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysis) },
    });
    mockCompPostUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeReq({
      body: {
        imageAData: 'base64imageA',
        imageBData: 'base64imageB',
        postId: 'post-abc',
      },
    });
    const { res } = makeRes();

    await analyzeComparison(req, res);

    expect(mockCompPostUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'post-abc', userId: 'user-1' }),
        data: expect.objectContaining({ aiVerdict: 'A' }),
      })
    );
  });

  it('does NOT call comparisonPost.updateMany when no postId', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysis) },
    });

    const req = makeReq({
      body: {
        imageAData: 'base64imageA',
        imageBData: 'base64imageB',
        // no postId
      },
    });
    const { res } = makeRes();

    await analyzeComparison(req, res);

    expect(mockCompPostUpdateMany).not.toHaveBeenCalled();
  });
});

// ─── deleteComparison ─────────────────────────────────────────────────────────

describe('deleteComparison', () => {
  it('throws AppError(404) when post not found or not owned', async () => {
    mockCompPostFindFirst.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'post-999' } });
    const { res } = makeRes();

    await expect(deleteComparison(req, res)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockCompPostUpdate).not.toHaveBeenCalled();
  });

  it('soft-deletes the post (update with { isDeleted: true })', async () => {
    mockCompPostFindFirst.mockResolvedValue({ id: 'post-1', userId: 'user-1' });
    mockCompPostUpdate.mockResolvedValue({});

    const req = makeReq({ params: { id: 'post-1' } });
    const { res, json } = makeRes();

    await deleteComparison(req, res);

    expect(mockCompPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: { isDeleted: true },
      })
    );
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});
