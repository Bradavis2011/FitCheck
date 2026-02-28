import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockOutfitUpdate = vi.hoisted(() => vi.fn());
const mockFeedbackUpsert = vi.hoisted(() => vi.fn());
const mockFeedbackAggregate = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserStatsUpsert = vi.hoisted(() => vi.fn());
const mockBlockedUserFindFirst = vi.hoisted(() => vi.fn());
const mockBlockedUserFindUnique = vi.hoisted(() => vi.fn());
const mockBlockedUserCreate = vi.hoisted(() => vi.fn());
const mockBlockedUserFindMany = vi.hoisted(() => vi.fn());
const mockInnerCircleFindUnique = vi.hoisted(() => vi.fn());
const mockFollowFindUnique = vi.hoisted(() => vi.fn());
const mockFollowCreate = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());
const mockAwardFeedbackPoints = vi.hoisted(() => vi.fn());
const mockUpdateStreak = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: { findFirst: mockOutfitFindFirst, update: mockOutfitUpdate },
    communityFeedback: { upsert: mockFeedbackUpsert, aggregate: mockFeedbackAggregate },
    user: { findUnique: mockUserFindUnique, findFirst: mockUserFindFirst },
    userStats: { upsert: mockUserStatsUpsert },
    blockedUser: {
      findFirst: mockBlockedUserFindFirst,
      findUnique: mockBlockedUserFindUnique,
      findMany: mockBlockedUserFindMany,
      create: mockBlockedUserCreate,
    },
    innerCircleMember: { findUnique: mockInnerCircleFindUnique },
    follow: { findUnique: mockFollowFindUnique, create: mockFollowCreate },
  },
}));

vi.mock('../notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

vi.mock('../../services/gamification.service.js', () => ({
  awardFeedbackPoints: mockAwardFeedbackPoints,
  updateStreak: mockUpdateStreak,
}));

vi.mock('../../lib/posthog.js', () => ({ trackServerEvent: vi.fn() }));

import {
  submitCommunityFeedback,
  blockUser,
  followUser,
} from '../social.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, params: {}, query: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

beforeEach(() => {
  mockOutfitFindFirst.mockReset();
  mockOutfitUpdate.mockReset();
  mockFeedbackUpsert.mockReset();
  mockFeedbackAggregate.mockReset();
  mockUserFindUnique.mockReset();
  mockUserFindFirst.mockReset();
  mockUserStatsUpsert.mockReset();
  mockBlockedUserFindFirst.mockReset();
  mockBlockedUserFindUnique.mockReset();
  mockBlockedUserFindMany.mockReset();
  mockBlockedUserCreate.mockReset();
  mockInnerCircleFindUnique.mockReset();
  mockFollowFindUnique.mockReset();
  mockFollowCreate.mockReset();
  mockCreateNotification.mockReset();
  mockAwardFeedbackPoints.mockReset();
  mockUpdateStreak.mockReset();
});

// ─── submitCommunityFeedback ──────────────────────────────────────────────────

describe('submitCommunityFeedback — input validation', () => {
  it('throws AppError(400) when comment contains profanity', async () => {
    const req = makeReq({ body: { outfitId: 'outfit-1', score: 7, comment: 'this is shit' } });
    const { res } = makeRes();
    await expect(submitCommunityFeedback(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('prohibited content'),
    });
    expect(mockOutfitFindFirst).not.toHaveBeenCalled();
  });

  it('throws AppError(404) when outfit does not exist or is not public', async () => {
    mockOutfitFindFirst.mockResolvedValue(null);
    const req = makeReq({ body: { outfitId: 'missing', score: 8, comment: 'nice' } });
    const { res } = makeRes();
    await expect(submitCommunityFeedback(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Outfit not found or not public',
    });
  });
});

describe('submitCommunityFeedback — business rules', () => {
  it('throws AppError(400) when user tries to rate their own outfit', async () => {
    mockOutfitFindFirst.mockResolvedValue({
      id: 'outfit-1',
      userId: 'user-1', // same as req.userId
      visibility: 'all',
      user: { id: 'user-1' },
    });
    const req = makeReq({ body: { outfitId: 'outfit-1', score: 9, comment: 'I look great' } });
    const { res } = makeRes();
    await expect(submitCommunityFeedback(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot give feedback on your own outfit',
    });
  });

  it('throws AppError(403) when outfit owner has blocked the feedback author', async () => {
    mockOutfitFindFirst.mockResolvedValue({
      id: 'outfit-1',
      userId: 'owner-2',
      visibility: 'all',
      user: { id: 'owner-2' },
    });
    mockBlockedUserFindFirst.mockResolvedValue({ id: 'block-1' });

    const req = makeReq({ userId: 'user-1', body: { outfitId: 'outfit-1', score: 7, comment: '' } });
    const { res } = makeRes();
    await expect(submitCommunityFeedback(req, res)).rejects.toMatchObject({
      statusCode: 403,
      message: 'You are blocked from interacting with this user',
    });
  });

  it('throws AppError(403) when inner_circle outfit and user is not a member', async () => {
    mockOutfitFindFirst.mockResolvedValue({
      id: 'outfit-ic',
      userId: 'owner-2',
      visibility: 'inner_circle',
      user: { id: 'owner-2' },
    });
    mockInnerCircleFindUnique.mockResolvedValue(null);

    const req = makeReq({ userId: 'user-1', body: { outfitId: 'outfit-ic', score: 8, comment: '' } });
    const { res } = makeRes();
    await expect(submitCommunityFeedback(req, res)).rejects.toMatchObject({
      statusCode: 403,
      message: 'This outfit is only visible to inner circle members',
    });
  });

  it('submits feedback and returns feedback + gamification data on success', async () => {
    mockOutfitFindFirst.mockResolvedValue({
      id: 'outfit-1',
      userId: 'owner-2',
      visibility: 'all',
      user: { id: 'owner-2' },
    });
    mockBlockedUserFindFirst.mockResolvedValue(null);
    mockFeedbackUpsert.mockResolvedValue({ id: 'fb-1', score: 8, comment: 'looks great' });
    mockFeedbackAggregate.mockResolvedValue({ _avg: { score: 8.0 }, _count: { score: 3 } });
    mockOutfitUpdate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ username: 'alice', name: 'Alice' });
    mockCreateNotification.mockResolvedValue({});
    mockAwardFeedbackPoints.mockResolvedValue({
      pointsAwarded: 10,
      totalPoints: 150,
      level: 3,
      leveledUp: false,
      newBadges: [],
    });
    mockUpdateStreak.mockResolvedValue({});
    mockUserStatsUpsert.mockResolvedValue({});

    const req = makeReq({
      userId: 'user-1',
      body: { outfitId: 'outfit-1', score: 8, comment: 'looks great' },
    });
    const { res, json } = makeRes();

    await submitCommunityFeedback(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({ id: 'fb-1' }),
        gamification: expect.objectContaining({ pointsAwarded: 10, level: 3 }),
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-2', type: 'feedback' }),
    );
  });
});

// ─── blockUser ────────────────────────────────────────────────────────────────

describe('blockUser', () => {
  it('throws AppError(404) when target user does not exist', async () => {
    mockUserFindFirst.mockResolvedValue(null);
    const req = makeReq({ userId: 'user-1', params: { username: 'ghost' } });
    const { res } = makeRes();
    await expect(blockUser(req, res)).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
  });

  it('throws AppError(400) when trying to block yourself', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-1', username: 'me' });
    const req = makeReq({ userId: 'user-1', params: { username: 'me' } });
    const { res } = makeRes();
    await expect(blockUser(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot block yourself',
    });
  });

  it('throws AppError(400) when user is already blocked', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-2', username: 'other' });
    mockBlockedUserFindUnique.mockResolvedValue({ id: 'block-existing' });

    const req = makeReq({ userId: 'user-1', params: { username: 'other' } });
    const { res } = makeRes();
    await expect(blockUser(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'User is already blocked',
    });
  });

  it('creates a block and returns success', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-2', username: 'other' });
    mockBlockedUserFindUnique.mockResolvedValue(null);
    mockBlockedUserCreate.mockResolvedValue({});

    const req = makeReq({ userId: 'user-1', params: { username: 'other' } });
    const { res, json } = makeRes();

    await blockUser(req, res);

    expect(mockBlockedUserCreate).toHaveBeenCalledWith({
      data: { userId: 'user-1', blockedId: 'user-2' },
    });
    expect(json).toHaveBeenCalledWith({ success: true, blocked: 'other' });
  });
});

// ─── followUser ───────────────────────────────────────────────────────────────

describe('followUser', () => {
  it('throws AppError(400) when following yourself', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-1', username: 'me' });
    const req = makeReq({ userId: 'user-1', params: { username: 'me' } });
    const { res } = makeRes();
    await expect(followUser(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot follow yourself',
    });
  });

  it('throws AppError(400) when already following the user', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-2', username: 'alice' });
    mockFollowFindUnique.mockResolvedValue({ id: 'follow-existing' });

    const req = makeReq({ userId: 'user-1', params: { username: 'alice' } });
    const { res } = makeRes();
    await expect(followUser(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Already following this user',
    });
  });

  it('creates a follow and sends a notification on success', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-2', username: 'alice' });
    mockFollowFindUnique.mockResolvedValue(null);
    mockFollowCreate.mockResolvedValue({});
    mockUserFindUnique.mockResolvedValue({ username: 'me', name: 'Me' });
    mockCreateNotification.mockResolvedValue({});

    const req = makeReq({ userId: 'user-1', params: { username: 'alice' } });
    const { res, json } = makeRes();

    await followUser(req, res);

    expect(mockFollowCreate).toHaveBeenCalledWith({
      data: { followerId: 'user-1', followingId: 'user-2' },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', type: 'follow' }),
    );
    expect(json).toHaveBeenCalledWith({ success: true, following: 'alice' });
  });
});
