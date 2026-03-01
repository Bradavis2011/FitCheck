import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockChallengeFindMany = vi.hoisted(() => vi.fn());
const mockChallengeFindUnique = vi.hoisted(() => vi.fn());
const mockChallengeFindFirst = vi.hoisted(() => vi.fn());
const mockChallengeCreate = vi.hoisted(() => vi.fn());
const mockChallengeUpdate = vi.hoisted(() => vi.fn());
const mockChallengeUpdateMany = vi.hoisted(() => vi.fn());

const mockSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockSubmissionFindFirst = vi.hoisted(() => vi.fn());
const mockSubmissionCreate = vi.hoisted(() => vi.fn());
const mockSubmissionCount = vi.hoisted(() => vi.fn());
const mockSubmissionFindUnique = vi.hoisted(() => vi.fn());
const mockSubmissionUpdate = vi.hoisted(() => vi.fn());

const mockVoteFindFirst = vi.hoisted(() => vi.fn());
const mockVoteCreate = vi.hoisted(() => vi.fn());

const mockOutfitCheckFindFirst = vi.hoisted(() => vi.fn());

const mockTransaction = vi.hoisted(() => vi.fn());

const mockIsAdmin = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    challenge: {
      findMany: mockChallengeFindMany,
      findUnique: mockChallengeFindUnique,
      findFirst: mockChallengeFindFirst,
      create: mockChallengeCreate,
      update: mockChallengeUpdate,
      updateMany: mockChallengeUpdateMany,
    },
    challengeSubmission: {
      findMany: mockSubmissionFindMany,
      findFirst: mockSubmissionFindFirst,
      create: mockSubmissionCreate,
      count: mockSubmissionCount,
      findUnique: mockSubmissionFindUnique,
      update: mockSubmissionUpdate,
    },
    challengeVote: {
      findFirst: mockVoteFindFirst,
      create: mockVoteCreate,
    },
    outfitCheck: {
      findFirst: mockOutfitCheckFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('../../utils/admin.js', () => ({
  isAdmin: mockIsAdmin,
}));

import {
  listChallenges,
  getChallenge,
  getLeaderboard,
  submitEntry,
  voteForSubmission,
  createChallenge,
  endChallenge,
} from '../challenge.controller.js';

// ─── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_CHALLENGE = {
  id: 'challenge-1',
  title: 'Summer Style',
  description: 'Show your best summer look',
  theme: 'summer',
  prize: 'Featured on feed',
  status: 'active',
  startsAt: new Date('2026-03-01'),
  endsAt: new Date('2026-03-08'),
  _count: { submissions: 5 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeAuthReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1', tier: 'free', email: 'user@example.com' },
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
  mockChallengeFindMany.mockReset();
  mockChallengeFindUnique.mockReset();
  mockChallengeFindFirst.mockReset();
  mockChallengeCreate.mockReset();
  mockChallengeUpdate.mockReset();
  mockChallengeUpdateMany.mockReset();

  mockSubmissionFindMany.mockReset();
  mockSubmissionFindFirst.mockReset();
  mockSubmissionCreate.mockReset();
  mockSubmissionCount.mockReset();
  mockSubmissionFindUnique.mockReset();
  mockSubmissionUpdate.mockReset();

  mockOutfitCheckFindFirst.mockReset();

  mockVoteFindFirst.mockReset();
  mockVoteCreate.mockReset();
  mockTransaction.mockReset();
  mockIsAdmin.mockReset();

  // Default: update calls resolve so the auto-transition loop in listChallenges doesn't crash
  mockChallengeUpdate.mockResolvedValue({});
  mockChallengeUpdateMany.mockResolvedValue({ count: 0 });

  // Default $transaction: resolve array of promises
  mockTransaction.mockImplementation(async (queries: any[]) => {
    for (const q of queries) await q;
    return [];
  });
});

// ─── listChallenges ────────────────────────────────────────────────────────────

describe('listChallenges', () => {
  it('throws AppError(400) for invalid status param', async () => {
    const req = makeReq({ query: { status: 'invalid' } });
    const { res } = makeRes();
    await expect(listChallenges(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns challenges with submissionCount field', async () => {
    mockChallengeFindMany.mockResolvedValue([SAMPLE_CHALLENGE]);

    const req = makeReq({ query: { status: 'active' } });
    const { res, json } = makeRes();

    await listChallenges(req, res);

    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('challenges');
    expect(result.challenges[0]).toHaveProperty('submissionCount', 5);
  });
});

// ─── getChallenge ──────────────────────────────────────────────────────────────

describe('getChallenge', () => {
  it('throws AppError(404) when not found', async () => {
    mockChallengeFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent' } });
    const { res } = makeRes();
    await expect(getChallenge(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns challenge with submissionCount', async () => {
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE);
    const req = makeReq({ params: { id: 'challenge-1' } });
    const { res, json } = makeRes();

    await getChallenge(req, res);

    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('challenge');
    expect(result.challenge).toHaveProperty('submissionCount', 5);
    expect(result.challenge.id).toBe('challenge-1');
  });
});

// ─── getLeaderboard ────────────────────────────────────────────────────────────

describe('getLeaderboard', () => {
  it('throws AppError(404) when challenge not found', async () => {
    mockChallengeFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent' }, query: {} });
    const { res } = makeRes();
    await expect(getLeaderboard(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns { submissions, total, limit, offset }', async () => {
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE);
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'sub-1', votes: 10, user: {}, outfitCheck: {} },
    ]);
    mockSubmissionCount.mockResolvedValue(1);

    const req = makeReq({ params: { id: 'challenge-1' }, query: { limit: '10', offset: '0' } });
    const { res, json } = makeRes();

    await getLeaderboard(req, res);

    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('submissions');
    expect(result).toHaveProperty('total', 1);
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
  });
});

// ─── submitEntry ───────────────────────────────────────────────────────────────

describe('submitEntry', () => {
  const VALID_OUTFIT_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('throws AppError(404) when challenge not found', async () => {
    mockChallengeFindUnique.mockResolvedValue(null);
    const req = makeAuthReq({
      params: { id: 'nonexistent' },
      body: { outfitCheckId: VALID_OUTFIT_UUID },
    });
    const { res } = makeRes();
    await expect(submitEntry(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(400) when challenge is not active (status="upcoming")', async () => {
    mockChallengeFindUnique.mockResolvedValue({ ...SAMPLE_CHALLENGE, status: 'upcoming' });
    const req = makeAuthReq({
      params: { id: 'challenge-1' },
      body: { outfitCheckId: VALID_OUTFIT_UUID },
    });
    const { res } = makeRes();
    await expect(submitEntry(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(404) when outfit not found or not owned by user', async () => {
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE);
    mockOutfitCheckFindFirst.mockResolvedValue(null); // outfit not found/not owned

    const req = makeAuthReq({
      params: { id: 'challenge-1' },
      body: { outfitCheckId: VALID_OUTFIT_UUID },
    });
    const { res } = makeRes();
    await expect(submitEntry(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when duplicate submission exists', async () => {
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE);
    mockOutfitCheckFindFirst.mockResolvedValue({
      id: VALID_OUTFIT_UUID,
      userId: 'user-1',
      isDeleted: false,
    });
    mockSubmissionFindFirst.mockResolvedValue({
      id: 'existing-sub',
      challengeId: 'challenge-1',
      userId: 'user-1',
    });

    const req = makeAuthReq({
      params: { id: 'challenge-1' },
      body: { outfitCheckId: VALID_OUTFIT_UUID },
    });
    const { res } = makeRes();
    await expect(submitEntry(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates submission and responds 201', async () => {
    const createdSubmission = {
      id: 'sub-new',
      challengeId: 'challenge-1',
      outfitCheckId: VALID_OUTFIT_UUID,
      userId: 'user-1',
      user: { id: 'user-1', username: 'alice', name: 'Alice', profileImageUrl: null },
      outfitCheck: { id: VALID_OUTFIT_UUID, thumbnailUrl: null, thumbnailData: null, aiScore: 8 },
    };

    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE);
    mockOutfitCheckFindFirst.mockResolvedValue({
      id: VALID_OUTFIT_UUID,
      userId: 'user-1',
      isDeleted: false,
    });
    mockSubmissionFindFirst.mockResolvedValue(null); // no duplicate
    mockSubmissionCreate.mockResolvedValue(createdSubmission);

    const req = makeAuthReq({
      params: { id: 'challenge-1' },
      body: { outfitCheckId: VALID_OUTFIT_UUID },
    });
    const { res, status, json } = makeRes();

    await submitEntry(req, res);

    expect(mockSubmissionCreate).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ submission: createdSubmission });
  });
});

// ─── voteForSubmission ─────────────────────────────────────────────────────────

describe('voteForSubmission', () => {
  it('throws AppError(404) when submission not found', async () => {
    mockSubmissionFindFirst.mockResolvedValue(null);
    const req = makeAuthReq({ params: { id: 'challenge-1', subId: 'sub-999' } });
    const { res } = makeRes();
    await expect(voteForSubmission(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(400) when voting on own submission', async () => {
    mockSubmissionFindFirst.mockResolvedValue({
      id: 'sub-1',
      challengeId: 'challenge-1',
      userId: 'user-1', // same as req.user.id
    });
    const req = makeAuthReq({
      user: { id: 'user-1', tier: 'free', email: 'user@example.com' },
      params: { id: 'challenge-1', subId: 'sub-1' },
    });
    const { res } = makeRes();
    await expect(voteForSubmission(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(409) when duplicate vote', async () => {
    mockSubmissionFindFirst.mockResolvedValue({
      id: 'sub-1',
      challengeId: 'challenge-1',
      userId: 'user-2', // different user — not own submission
    });
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE); // active
    mockVoteFindFirst.mockResolvedValue({ id: 'vote-existing' }); // duplicate

    const req = makeAuthReq({
      user: { id: 'user-1', tier: 'free', email: 'user@example.com' },
      params: { id: 'challenge-1', subId: 'sub-1' },
    });
    const { res } = makeRes();
    await expect(voteForSubmission(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('calls $transaction to create vote + increment counter', async () => {
    mockSubmissionFindFirst.mockResolvedValue({
      id: 'sub-1',
      challengeId: 'challenge-1',
      userId: 'user-2',
    });
    mockChallengeFindUnique.mockResolvedValue(SAMPLE_CHALLENGE); // active
    mockVoteFindFirst.mockResolvedValue(null); // no existing vote
    mockVoteCreate.mockResolvedValue({ id: 'vote-new', submissionId: 'sub-1', userId: 'user-1' });
    mockSubmissionUpdate.mockResolvedValue({ id: 'sub-1', votes: 6 });
    mockSubmissionFindUnique.mockResolvedValue({ id: 'sub-1', votes: 6 });
    mockTransaction.mockResolvedValue([]);

    const req = makeAuthReq({
      user: { id: 'user-1', tier: 'free', email: 'user@example.com' },
      params: { id: 'challenge-1', subId: 'sub-1' },
    });
    const { res, json } = makeRes();

    await voteForSubmission(req, res);

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledWith({ votes: 6 });
  });
});

// ─── createChallenge ───────────────────────────────────────────────────────────

describe('createChallenge', () => {
  it('throws AppError(403) when user is not admin', async () => {
    mockIsAdmin.mockReturnValue(false);

    const req = makeAuthReq({
      user: { id: 'user-1', tier: 'free', email: 'user@example.com' },
      body: {
        title: 'New Challenge',
        description: 'A brand new challenge for everyone',
        theme: 'casual',
        startsAt: '2026-04-01T00:00:00Z',
        endsAt: '2026-04-08T00:00:00Z',
      },
    });
    const { res } = makeRes();
    await expect(createChallenge(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates challenge and responds 201 when admin', async () => {
    mockIsAdmin.mockReturnValue(true);
    const createdChallenge = {
      id: 'challenge-new',
      title: 'New Challenge',
      description: 'A brand new challenge for everyone',
      theme: 'casual',
      prize: null,
      status: 'upcoming',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-04-08T00:00:00Z'),
    };
    mockChallengeCreate.mockResolvedValue(createdChallenge);

    const req = makeAuthReq({
      user: { id: 'admin-1', tier: 'pro', email: 'admin@example.com' },
      body: {
        title: 'New Challenge',
        description: 'A brand new challenge for everyone',
        theme: 'casual',
        startsAt: '2026-04-01T00:00:00Z',
        endsAt: '2026-04-08T00:00:00Z',
      },
    });
    const { res, status, json } = makeRes();

    await createChallenge(req, res);

    expect(mockChallengeCreate).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ challenge: createdChallenge });
  });
});

// ─── endChallenge ──────────────────────────────────────────────────────────────

describe('endChallenge', () => {
  it('throws AppError(404) when challenge not found', async () => {
    mockIsAdmin.mockReturnValue(true);
    mockChallengeFindUnique.mockResolvedValue(null);

    const req = makeAuthReq({
      user: { id: 'admin-1', tier: 'pro', email: 'admin@example.com' },
      params: { id: 'nonexistent' },
    });
    const { res } = makeRes();
    await expect(endChallenge(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(400) when challenge is already ended', async () => {
    mockIsAdmin.mockReturnValue(true);
    mockChallengeFindUnique.mockResolvedValue({ ...SAMPLE_CHALLENGE, status: 'ended' });

    const req = makeAuthReq({
      user: { id: 'admin-1', tier: 'pro', email: 'admin@example.com' },
      params: { id: 'challenge-1' },
    });
    const { res } = makeRes();
    await expect(endChallenge(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });
});
