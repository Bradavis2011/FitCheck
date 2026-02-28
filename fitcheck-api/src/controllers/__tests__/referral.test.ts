import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
// vi.hoisted ensures these are initialized before vi.mock factories run
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

import { claimReferral } from '../referral.controller.js';

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    userId: 'user-1',
    body: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();
});

describe('claimReferral', () => {
  // Note: referralCode presence/type validation is enforced by validateRequest middleware
  // (ClaimReferralSchema). These controller tests cover only post-validation logic.

  it('throws AppError(404) when the current user does not exist', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const req = makeReq({ body: { referralCode: 'ABC123' } });
    const { res } = makeRes();
    await expect(claimReferral(req, res)).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
  });

  it('returns { ok: true, alreadyClaimed: true } when referral was already claimed', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', referredById: 'referrer-99' });
    const req = makeReq({ body: { referralCode: 'ALREADY' } });
    const { res, json } = makeRes();
    await claimReferral(req, res);
    expect(json).toHaveBeenCalledWith({ ok: true, alreadyClaimed: true });
  });

  it('throws AppError(404) when the referral code does not exist', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce({ id: 'user-1', referredById: null }) // current user
      .mockResolvedValueOnce(null); // referrer lookup
    const req = makeReq({ body: { referralCode: 'BADCODE' } });
    const { res } = makeRes();
    await expect(claimReferral(req, res)).rejects.toMatchObject({ statusCode: 404, message: 'Invalid referral code' });
  });

  it('throws AppError(400) on self-referral', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce({ id: 'user-1', referredById: null }) // current user
      .mockResolvedValueOnce({ id: 'user-1' }); // referrer is same user
    const req = makeReq({ body: { referralCode: 'SELF' } });
    const { res } = makeRes();
    await expect(claimReferral(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot use your own referral code',
    });
  });

  it('updates referredById and returns { ok: true } on success', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce({ id: 'user-1', referredById: null }) // current user
      .mockResolvedValueOnce({ id: 'referrer-42' }); // valid referrer
    mockUserUpdate.mockResolvedValueOnce({});
    const req = makeReq({ body: { referralCode: 'GOOD123' } });
    const { res, json } = makeRes();
    await claimReferral(req, res);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { referredById: 'referrer-42' },
      }),
    );
    expect(json).toHaveBeenCalledWith({ ok: true });
  });
});
