import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockExpertReviewCount = vi.hoisted(() => vi.fn());
const mockExpertReviewFindFirst = vi.hoisted(() => vi.fn());
const mockExpertReviewCreate = vi.hoisted(() => vi.fn());
const mockExpertReviewFindMany = vi.hoisted(() => vi.fn());
const mockExpertReviewFindUnique = vi.hoisted(() => vi.fn());
const mockExpertReviewUpdate = vi.hoisted(() => vi.fn());
const mockOutfitFindUnique = vi.hoisted(() => vi.fn());
const mockStylistFindFirst = vi.hoisted(() => vi.fn());
const mockStylistFindUnique = vi.hoisted(() => vi.fn());
const mockStylistUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

const mockGetTierLimits = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    expertReview: {
      count: mockExpertReviewCount,
      findFirst: mockExpertReviewFindFirst,
      create: mockExpertReviewCreate,
      findMany: mockExpertReviewFindMany,
      findUnique: mockExpertReviewFindUnique,
      update: mockExpertReviewUpdate,
    },
    outfitCheck: { findUnique: mockOutfitFindUnique },
    stylist: {
      findFirst: mockStylistFindFirst,
      findUnique: mockStylistFindUnique,
      update: mockStylistUpdate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('../../constants/tiers.js', () => ({
  getTierLimits: mockGetTierLimits,
}));

vi.mock('../notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

import {
  requestReview,
  getMyReviews,
  getStylistQueue,
  submitReview,
  getOutfitReview,
  cancelReview,
} from '../expert-review.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1', tier: 'pro', email: 'test@test.com' },
    userId: 'user-1',
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

const VALID_OUTFIT_ID = '00000000-0000-0000-0000-000000000001';
const VALID_STYLIST_ID = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  mockExpertReviewCount.mockReset();
  mockExpertReviewFindFirst.mockReset();
  mockExpertReviewCreate.mockReset();
  mockExpertReviewFindMany.mockReset();
  mockExpertReviewFindUnique.mockReset();
  mockExpertReviewUpdate.mockReset();
  mockOutfitFindUnique.mockReset();
  mockStylistFindFirst.mockReset();
  mockStylistFindUnique.mockReset();
  mockStylistUpdate.mockReset();
  mockTransaction.mockReset();
  mockGetTierLimits.mockReset();
  mockCreateNotification.mockReset();

  // Defaults
  mockGetTierLimits.mockReturnValue({ expertReviewsPerMonth: 3 });
  mockExpertReviewCount.mockResolvedValue(0);
  mockOutfitFindUnique.mockResolvedValue({ id: VALID_OUTFIT_ID, userId: 'user-1', isDeleted: false });
  mockExpertReviewFindFirst.mockResolvedValue(null);
  mockStylistFindFirst.mockResolvedValue({ id: VALID_STYLIST_ID, verified: true, reviewCount: 5, rating: 4.5 });
  mockExpertReviewCreate.mockResolvedValue({
    id: 'review-1',
    stylist: {
      userId: 'stylist-user-1',
      user: { id: 'stylist-user-1', username: 'stylist', name: 'Stylist', profileImageUrl: null },
    },
  });
  mockCreateNotification.mockResolvedValue({});
});

afterEach(() => vi.unstubAllEnvs());

// ─── requestReview ────────────────────────────────────────────────────────────

describe('requestReview', () => {
  it('throws AppError(403) when expertReviewsPerMonth === 0 (free tier)', async () => {
    mockGetTierLimits.mockReturnValue({ expertReviewsPerMonth: 0 });
    const req = makeReq({
      user: { id: 'user-1', tier: 'free', email: 'test@test.com' },
      body: { outfitCheckId: VALID_OUTFIT_ID },
    });
    const { res } = makeRes();
    await expect(requestReview(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(429) when monthly limit reached', async () => {
    mockExpertReviewCount.mockResolvedValue(3); // already used all 3
    const req = makeReq({ body: { outfitCheckId: VALID_OUTFIT_ID } });
    const { res } = makeRes();
    await expect(requestReview(req, res)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws AppError(404) when outfit not found', async () => {
    mockOutfitFindUnique.mockResolvedValue(null);
    const req = makeReq({ body: { outfitCheckId: VALID_OUTFIT_ID } });
    const { res } = makeRes();
    await expect(requestReview(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when review already in progress for this outfit', async () => {
    mockExpertReviewFindFirst.mockResolvedValue({ id: 'review-existing', status: 'pending' });
    const req = makeReq({ body: { outfitCheckId: VALID_OUTFIT_ID } });
    const { res } = makeRes();
    await expect(requestReview(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws AppError(503) when no verified stylists available (auto-assign)', async () => {
    mockStylistFindFirst.mockResolvedValue(null);
    const req = makeReq({ body: { outfitCheckId: VALID_OUTFIT_ID } });
    const { res } = makeRes();
    await expect(requestReview(req, res)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('creates review, notifies stylist, and responds 201', async () => {
    const req = makeReq({ body: { outfitCheckId: VALID_OUTFIT_ID } });
    const { res, json, status } = makeRes();
    await requestReview(req, res);
    expect(mockExpertReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outfitCheckId: VALID_OUTFIT_ID,
          userId: 'user-1',
          stylistId: VALID_STYLIST_ID,
          status: 'pending',
        }),
      }),
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ review: expect.objectContaining({ id: 'review-1' }) }),
    );
  });
});

// ─── getStylistQueue ──────────────────────────────────────────────────────────

describe('getStylistQueue', () => {
  it('throws AppError(403) when user is not a verified stylist', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();
    await expect(getStylistQueue(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns queue when user is a verified stylist', async () => {
    mockStylistFindUnique.mockResolvedValue({ id: VALID_STYLIST_ID, verified: true });
    mockExpertReviewFindMany.mockResolvedValue([]);
    const req = makeReq();
    const { res, json } = makeRes();
    await getStylistQueue(req, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ reviews: [] }));
  });
});

// ─── submitReview ─────────────────────────────────────────────────────────────

describe('submitReview', () => {
  const validBody = {
    score: 8,
    feedback: 'This outfit is well put together with great attention to detail and colour coordination.',
  };

  it('throws AppError(403) when not a verified stylist', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'review-1' }, body: validBody });
    const { res } = makeRes();
    await expect(submitReview(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(404) when review not found', async () => {
    mockStylistFindUnique.mockResolvedValue({ id: VALID_STYLIST_ID, verified: true, reviewCount: 5, rating: 4.5 });
    mockExpertReviewFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'review-1' }, body: validBody });
    const { res } = makeRes();
    await expect(submitReview(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when review already completed', async () => {
    mockStylistFindUnique.mockResolvedValue({ id: VALID_STYLIST_ID, verified: true, reviewCount: 5, rating: 4.5 });
    mockExpertReviewFindUnique.mockResolvedValue({
      id: 'review-1',
      stylistId: VALID_STYLIST_ID,
      status: 'completed',
    });
    const req = makeReq({ params: { id: 'review-1' }, body: validBody });
    const { res } = makeRes();
    await expect(submitReview(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('calls $transaction to update review and stylist rating', async () => {
    const stylist = { id: VALID_STYLIST_ID, verified: true, reviewCount: 5, rating: 4.5 };
    mockStylistFindUnique.mockResolvedValue(stylist);
    mockExpertReviewFindUnique.mockResolvedValue({
      id: 'review-1',
      stylistId: VALID_STYLIST_ID,
      status: 'pending',
    });
    const updatedReview = { id: 'review-1', status: 'completed', score: 8, feedback: validBody.feedback };
    mockTransaction.mockImplementation(async (queries: any[]) => Promise.all(queries));
    mockExpertReviewUpdate.mockResolvedValue(updatedReview);
    mockStylistUpdate.mockResolvedValue({});

    const req = makeReq({ params: { id: 'review-1' }, body: validBody });
    const { res, json } = makeRes();
    await submitReview(req, res);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ review: expect.objectContaining({ id: 'review-1', status: 'completed' }) }),
    );
  });
});

// ─── getOutfitReview ──────────────────────────────────────────────────────────

describe('getOutfitReview', () => {
  it('throws AppError(404) when outfit not owned by user', async () => {
    mockOutfitFindUnique.mockResolvedValue({ userId: 'other-user' });
    const req = makeReq({ params: { outfitId: VALID_OUTFIT_ID } });
    const { res } = makeRes();
    await expect(getOutfitReview(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── cancelReview ─────────────────────────────────────────────────────────────

describe('cancelReview', () => {
  it('throws AppError(404) when review not found', async () => {
    mockExpertReviewFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'review-1' } });
    const { res } = makeRes();
    await expect(cancelReview(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when review is not pending', async () => {
    mockExpertReviewFindUnique.mockResolvedValue({ id: 'review-1', userId: 'user-1', status: 'in_progress' });
    const req = makeReq({ params: { id: 'review-1' } });
    const { res } = makeRes();
    await expect(cancelReview(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('updates status to cancelled', async () => {
    mockExpertReviewFindUnique.mockResolvedValue({ id: 'review-1', userId: 'user-1', status: 'pending' });
    mockExpertReviewUpdate.mockResolvedValue({ id: 'review-1', status: 'cancelled' });
    const req = makeReq({ params: { id: 'review-1' } });
    const { res, json } = makeRes();
    await cancelReview(req, res);
    expect(mockExpertReviewUpdate).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { status: 'cancelled' },
    });
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
