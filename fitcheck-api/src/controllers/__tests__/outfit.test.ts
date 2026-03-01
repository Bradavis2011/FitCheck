import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockUserStatsFindUnique = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    userStats: { findUnique: mockUserStatsFindUnique, upsert: vi.fn() },
    outfitCheck: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../utils/admin.js', () => ({
  isAdmin: mockIsAdmin,
  getAdminUserIds: vi.fn(() => []),
}));

// Stub all service dependencies to prevent them from executing
vi.mock('../../services/ai-feedback.service.js', () => ({
  analyzeOutfit: vi.fn(),
  handleFollowUpQuestion: vi.fn(),
}));
vi.mock('../../services/s3.service.js', () => ({ uploadBuffer: vi.fn() }));
vi.mock('../../services/gamification.service.js', () => ({
  awardPoints: vi.fn(),
  awardFeedbackPoints: vi.fn(),
  updateStreak: vi.fn(),
  awardOutfitPoints: vi.fn(),
}));
vi.mock('../../services/event-followup.service.js', () => ({
  scheduleFollowUp: vi.fn(),
  EVENT_OCCASIONS: ['Date Night', 'Interview', 'Event'],
  recordFollowUpResponse: vi.fn(),
}));
vi.mock('../../services/milestone-message.service.js', () => ({ checkMilestones: vi.fn() }));
vi.mock('../../services/recursive-improvement.service.js', () => ({
  recordPromptRating: vi.fn(),
  getActivePrompt: vi.fn(),
}));
vi.mock('../../services/outfit-memory.service.js', () => ({ getOutfitMemory: vi.fn() }));
vi.mock('../../services/recommendation.service.js', () => ({ getRecommendations: vi.fn() }));
vi.mock('../../lib/posthog.js', () => ({ trackServerEvent: vi.fn() }));

import { submitOutfitCheck } from '../outfit.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAA=';

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    userId: 'user-1',
    body: {
      imageBase64: VALID_JPEG_BASE64,
      occasions: ['casual'],
    },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

/** A free-tier user who has NOT hit the daily limit yet (used=0, reset=today) */
function makeFreeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    tier: 'free',
    dailyChecksUsed: 0,
    dailyChecksResetAt: new Date(), // today — no reset needed
    bonusDailyChecks: 0,
    privacySettings: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();
  mockUserStatsFindUnique.mockReset();
  mockIsAdmin.mockReturnValue(false);
});

// ─── submitOutfitCheck — guard: user not found ────────────────────────────────

describe('submitOutfitCheck — user not found', () => {
  it('throws AppError(404) when user does not exist in DB', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();
    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

// ─── submitOutfitCheck — image validation ────────────────────────────────────

describe('submitOutfitCheck — image MIME validation', () => {
  it('throws AppError(400) for disallowed image types (gif)', async () => {
    mockUserFindUnique.mockResolvedValue(makeFreeUser());
    const req = makeReq({
      body: {
        imageBase64: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        occasions: ['casual'],
      },
    });
    const { res } = makeRes();
    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Invalid image type'),
    });
  });

  it('allows jpeg, png, and webp MIME types (no error thrown for jpeg)', async () => {
    // A valid JPEG that passes MIME check — but will fail later (analyzeOutfit not fully mocked)
    // We just verify it doesn't throw a 400 MIME error — any other error is from downstream mocks
    mockUserFindUnique.mockResolvedValue(makeFreeUser());
    mockUserStatsFindUnique.mockResolvedValue(null);
    const req = makeReq({
      body: { imageBase64: VALID_JPEG_BASE64, occasions: ['casual'] },
    });
    const { res } = makeRes();

    // Should NOT throw a MIME-related AppError — may throw for other reasons downstream
    try {
      await submitOutfitCheck(req, res);
    } catch (err: any) {
      expect(err?.message).not.toContain('Invalid image type');
    }
  });
});

describe('submitOutfitCheck — image size validation', () => {
  it('throws AppError(400) when image exceeds 5MB', async () => {
    mockUserFindUnique.mockResolvedValue(makeFreeUser());
    // 7,000,000 base64 chars × 0.75 ≈ 5,250,000 bytes > 5,242,880 (5MB)
    const hugeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(7_000_000);
    const req = makeReq({ body: { imageBase64: hugeBase64, occasions: ['casual'] } });
    const { res } = makeRes();

    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Image exceeds 5MB limit',
    });
  });
});

// ─── submitOutfitCheck — daily limit ─────────────────────────────────────────

describe('submitOutfitCheck — daily limit (free tier)', () => {
  it('throws AppError(429) when free user is at the 3-check daily limit', async () => {
    mockUserFindUnique.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 3 }));
    mockUserStatsFindUnique.mockResolvedValue(null); // no give-to-get bonus
    const req = makeReq();
    const { res } = makeRes();

    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining('Daily limit reached'),
    });
  });

  it('throws AppError(429) when limit is exceeded even with 0 bonus checks', async () => {
    mockUserFindUnique.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 3, bonusDailyChecks: 0 }));
    mockUserStatsFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();

    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws AppError(429) when referral bonus is counted but limit is still hit (used=4, bonus=1)', async () => {
    // limit = 3 (free) + 1 (referral) = 4; used = 4 → 4 >= 4 → 429
    mockUserFindUnique.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 4, bonusDailyChecks: 1 }));
    mockUserStatsFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();

    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws AppError(429) even when give-to-get bonus fills to limit (used=4, feedback=3)', async () => {
    // limit = 3 + 1 (3 feedbacks / 3) = 4; used = 4 → 4 >= 4 → 429
    mockUserFindUnique.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 4 }));
    mockUserStatsFindUnique.mockResolvedValue({
      dailyFeedbackCount: 3,
      dailyGoalsResetAt: new Date(), // today — bonus applies
    });
    const req = makeReq();
    const { res } = makeRes();

    await expect(submitOutfitCheck(req, res)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('does not throw 429 for a pro user (unlimited tier)', async () => {
    // Pro users have Infinity daily limit — limit check is skipped
    mockUserFindUnique.mockResolvedValue({
      ...makeFreeUser({ tier: 'pro', dailyChecksUsed: 999 }),
    });
    // Should not throw 429 — may fail later due to unstubbed dependencies
    const req = makeReq();
    const { res } = makeRes();
    try {
      await submitOutfitCheck(req, res);
    } catch (err: any) {
      expect(err?.statusCode).not.toBe(429);
    }
  });
});

// ─── submitOutfitCheck — daily reset ─────────────────────────────────────────

describe('submitOutfitCheck — daily reset', () => {
  it('resets dailyChecksUsed to 0 when the reset date is yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockUserFindUnique.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 3, dailyChecksResetAt: yesterday }));
    // After reset, return user with dailyChecksUsed = 0
    mockUserUpdate.mockResolvedValue(makeFreeUser({ dailyChecksUsed: 0, dailyChecksResetAt: new Date() }));
    mockUserStatsFindUnique.mockResolvedValue(null);

    const req = makeReq();
    const { res } = makeRes();
    // Should not throw 429 — after reset, used = 0 < 3
    try {
      await submitOutfitCheck(req, res);
    } catch (err: any) {
      expect(err?.statusCode).not.toBe(429);
    }

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ dailyChecksUsed: 0 }),
      }),
    );
  });
});
