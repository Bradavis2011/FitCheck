import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockUserDelete = vi.hoisted(() => vi.fn());
const mockUserStatsFindUnique = vi.hoisted(() => vi.fn());
const mockOutfitCount = vi.hoisted(() => vi.fn());
const mockOutfitUpdateMany = vi.hoisted(() => vi.fn());
const mockStyleDNAFindFirst = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockReportDeleteMany = vi.hoisted(() => vi.fn());
const mockInitiateDataDeletion = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      update: mockUserUpdate,
      delete: mockUserDelete,
    },
    userStats: {
      findUnique: mockUserStatsFindUnique,
    },
    outfitCheck: {
      count: mockOutfitCount,
      updateMany: mockOutfitUpdateMany,
    },
    styleDNA: {
      findFirst: mockStyleDNAFindFirst,
      findMany: mockStyleDNAFindMany,
    },
    report: {
      deleteMany: mockReportDeleteMany,
    },
  },
}));

vi.mock('../../utils/admin.js', () => ({
  isAdmin: mockIsAdmin,
  getAdminUserIds: vi.fn(() => []),
}));

vi.mock('../../services/data-deletion.service.js', () => ({
  initiateDataDeletion: mockInitiateDataDeletion,
}));

// Stub gamification service to prevent it from executing
vi.mock('../../services/gamification.service.js', () => ({
  getLeaderboard: vi.fn(),
  getUserRank: vi.fn(),
  getDailyGoalsProgress: vi.fn(),
  awardPoints: vi.fn(),
  BADGE_METADATA: {},
}));

import {
  getProfile,
  updateProfile,
  getUserStats,
  clearHistory,
  deleteAccount,
  getStyleProfile,
} from '../user.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    userId: 'user-1',
    user: { id: 'user-1', email: 'alice@test.com', tier: 'free' },
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

const SAMPLE_USER = {
  id: 'user-1',
  email: 'alice@test.com',
  name: 'Alice',
  username: 'alice',
  bio: null,
  isPublic: true,
  profileImageUrl: null,
  stylePreferences: {},
  bodyType: null,
  colorSeason: null,
  privacySettings: {},
  tier: 'free',
  subscriptionExpiresAt: null,
  dailyChecksUsed: 2,
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockUserFindFirst.mockReset();
  mockUserUpdate.mockReset();
  mockUserDelete.mockReset();
  mockUserStatsFindUnique.mockReset();
  mockOutfitCount.mockReset();
  mockOutfitUpdateMany.mockReset();
  mockStyleDNAFindFirst.mockReset();
  mockStyleDNAFindMany.mockReset();
  mockReportDeleteMany.mockReset();
  mockInitiateDataDeletion.mockReset();
  mockIsAdmin.mockReset();

  mockUserFindUnique.mockResolvedValue(SAMPLE_USER);
  mockUserFindFirst.mockResolvedValue(null); // no duplicate username
  mockUserUpdate.mockResolvedValue(SAMPLE_USER);
  mockUserDelete.mockResolvedValue(SAMPLE_USER);
  mockUserStatsFindUnique.mockResolvedValue({ userId: 'user-1', currentStreak: 3 });
  mockOutfitCount.mockResolvedValue(10);
  mockOutfitUpdateMany.mockResolvedValue({ count: 5 });
  mockStyleDNAFindFirst.mockResolvedValue(null); // no style DNA
  mockStyleDNAFindMany.mockResolvedValue([]);
  mockReportDeleteMany.mockResolvedValue({ count: 0 });
  mockInitiateDataDeletion.mockResolvedValue(undefined);
  mockIsAdmin.mockReturnValue(false);
});

// ─── getProfile ───────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('returns user data with topArchetype null when no StyleDNA', async () => {
    mockStyleDNAFindFirst.mockResolvedValue(null);
    const req = makeReq();
    const { res, json } = makeRes();

    await getProfile(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', topArchetype: null }),
    );
  });

  it('returns topArchetype from most recent StyleDNA', async () => {
    mockStyleDNAFindFirst.mockResolvedValue({ styleArchetypes: ['Minimalist', 'Boho'] });
    const req = makeReq();
    const { res, json } = makeRes();

    await getProfile(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ topArchetype: 'Minimalist' }),
    );
  });

  it('throws AppError(404) when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();

    await expect(getProfile(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('returns updated user on valid body', async () => {
    const req = makeReq({ body: { name: 'Alice Updated' } });
    const { res, json } = makeRes();

    await updateProfile(req, res);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
  });

  it('calls prisma.user.update with parsed data', async () => {
    const req = makeReq({ body: { name: 'Bob', isPublic: false } });
    const { res } = makeRes();

    await updateProfile(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ name: 'Bob', isPublic: false }),
      }),
    );
  });

  it('throws AppError(400) when username is too short (< 3 chars)', async () => {
    const req = makeReq({ body: { username: 'ab' } });
    const { res } = makeRes();

    await expect(updateProfile(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('3 characters'),
    });
  });

  it('throws AppError(400) when username contains invalid characters', async () => {
    const req = makeReq({ body: { username: 'bad user!' } });
    const { res } = makeRes();

    await expect(updateProfile(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('letters, numbers, and underscores'),
    });
  });

  it('throws AppError(400) when bio exceeds 150 characters', async () => {
    const req = makeReq({ body: { bio: 'x'.repeat(151) } });
    const { res } = makeRes();

    await expect(updateProfile(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('150 characters'),
    });
  });

  it('throws AppError(400) when username is already taken', async () => {
    mockUserFindFirst.mockResolvedValue({ id: 'user-2', username: 'takenname' });
    const req = makeReq({ body: { username: 'takenname' } });
    const { res } = makeRes();

    await expect(updateProfile(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('already taken'),
    });
  });

  it('does not check username uniqueness when username is not in body', async () => {
    const req = makeReq({ body: { name: 'No Username Change' } });
    const { res } = makeRes();

    await updateProfile(req, res);

    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });
});

// ─── getUserStats ─────────────────────────────────────────────────────────────

describe('getUserStats', () => {
  it('returns totalOutfits and totalFavorites from outfit counts', async () => {
    // First call: all non-deleted outfits (10), second call: favorites (3)
    mockOutfitCount
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    const req = makeReq();
    const { res, json } = makeRes();

    await getUserStats(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ totalOutfits: 10, totalFavorites: 3 }),
    );
  });

  it('resets dailyChecksUsed to 0 when reset date is yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockUserFindUnique.mockResolvedValue({
      ...SAMPLE_USER,
      dailyChecksUsed: 3,
      dailyChecksResetAt: yesterday,
    });
    mockOutfitCount.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    const req = makeReq();
    const { res, json } = makeRes();

    await getUserStats(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ dailyChecksUsed: 0 }),
      }),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ dailyChecksUsed: 0 }),
    );
  });

  it('returns unlimited stats (999) for admin users', async () => {
    mockIsAdmin.mockReturnValue(true);
    mockOutfitCount.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    const req = makeReq();
    const { res, json } = makeRes();

    await getUserStats(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyChecksUsed: 0,
        dailyChecksLimit: 999,
        dailyChecksRemaining: 999,
      }),
    );
  });

  it('returns correct dailyChecksRemaining = limit - used', async () => {
    // free tier limit = 3; user has used 2 → remaining = 1
    mockUserFindUnique.mockResolvedValue({
      ...SAMPLE_USER,
      tier: 'free',
      dailyChecksUsed: 2,
      dailyChecksResetAt: new Date(), // today — no reset
    });
    mockOutfitCount.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    const req = makeReq();
    const { res, json } = makeRes();

    await getUserStats(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyChecksUsed: 2,
        dailyChecksLimit: 3,
        dailyChecksRemaining: 1,
      }),
    );
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('soft-deletes all user outfit checks (isDeleted: true)', async () => {
    mockOutfitUpdateMany.mockResolvedValue({ count: 7 });
    const req = makeReq();
    const { res } = makeRes();

    await clearHistory(req, res);

    expect(mockOutfitUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isDeleted: false },
      data: { isDeleted: true },
    });
  });

  it('returns { success: true, deletedCount: N }', async () => {
    mockOutfitUpdateMany.mockResolvedValue({ count: 5 });
    const req = makeReq();
    const { res, json } = makeRes();

    await clearHistory(req, res);

    expect(json).toHaveBeenCalledWith({ success: true, deletedCount: 5 });
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  it('throws AppError(404) when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();

    await expect(deleteAccount(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('deletes reports filed by the user first', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await deleteAccount(req, res);

    expect(mockReportDeleteMany).toHaveBeenCalledWith({
      where: { reporterId: 'user-1' },
    });
    // report deletion should happen before user deletion
    const reportOrder = mockReportDeleteMany.mock.invocationCallOrder[0];
    const userDeleteOrder = mockUserDelete.mock.invocationCallOrder[0];
    expect(reportOrder).toBeLessThan(userDeleteOrder);
  });

  it('deletes the user record', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await deleteAccount(req, res);

    expect(mockUserDelete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('calls initiateDataDeletion with userId and email (non-blocking)', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await deleteAccount(req, res);

    // initiateDataDeletion is called via dynamic import — give it one tick to resolve
    await new Promise(resolve => setImmediate(resolve));

    expect(mockInitiateDataDeletion).toHaveBeenCalledWith('user-1', 'alice@test.com');
  });

  it('returns { success: true, message: ... }', async () => {
    const req = makeReq();
    const { res, json } = makeRes();

    await deleteAccount(req, res);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: 'Account permanently deleted',
    });
  });

  it('does not throw if initiateDataDeletion rejects (non-fatal fire-and-forget)', async () => {
    mockInitiateDataDeletion.mockRejectedValue(new Error('GDPR pipeline down'));

    const req = makeReq();
    const { res } = makeRes();

    // deleteAccount itself should resolve successfully — the rejection is caught internally
    await expect(deleteAccount(req, res)).resolves.not.toThrow();
  });
});

// ─── getStyleProfile ──────────────────────────────────────────────────────────

describe('getStyleProfile', () => {
  it('throws AppError(403) for free users', async () => {
    const req = makeReq({ user: { id: 'user-1', email: 'alice@test.com', tier: 'free' } });
    const { res } = makeRes();

    await expect(getStyleProfile(req, res)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Pro subscription'),
    });
  });

  it('throws AppError(403) for plus users', async () => {
    const req = makeReq({ user: { id: 'user-1', email: 'alice@test.com', tier: 'plus' } });
    const { res } = makeRes();

    await expect(getStyleProfile(req, res)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Pro subscription'),
    });
  });

  it('returns empty profile message when no StyleDNA records', async () => {
    mockStyleDNAFindMany.mockResolvedValue([]);
    const req = makeReq({ user: { id: 'user-1', email: 'alice@test.com', tier: 'pro' } });
    const { res, json } = makeRes();

    await getStyleProfile(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('No style data yet'),
        topColors: [],
        dominantArchetypes: [],
        averageScores: null,
        totalOutfits: 0,
      }),
    );
  });
});
