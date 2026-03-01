import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockStylistFindUnique = vi.hoisted(() => vi.fn());
const mockStylistCreate = vi.hoisted(() => vi.fn());
const mockStylistUpdate = vi.hoisted(() => vi.fn());
const mockStylistFindMany = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    stylist: {
      findUnique: mockStylistFindUnique,
      create: mockStylistCreate,
      update: mockStylistUpdate,
      findMany: mockStylistFindMany,
    },
  },
}));

vi.mock('../../utils/admin.js', () => ({
  isAdmin: mockIsAdmin,
  getAdminUserIds: vi.fn(() => []),
}));

import {
  applyStylist,
  getMyStylistProfile,
  updateMyStylistProfile,
  getStylists,
  getStylist,
  verifyStylist,
  unverifyStylist,
} from '../stylist.controller.js';

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

const SAMPLE_STYLIST = {
  id: 'stylist-1',
  userId: 'user-1',
  bio: 'Expert in minimalist fashion with 5 years of experience.',
  specialties: ['minimalist', 'business casual'],
  instagramUrl: null,
  verified: false,
  rating: 4.5,
  reviewCount: 10,
};

beforeEach(() => {
  mockStylistFindUnique.mockReset();
  mockStylistCreate.mockReset();
  mockStylistUpdate.mockReset();
  mockStylistFindMany.mockReset();
  mockIsAdmin.mockReset();
  mockIsAdmin.mockReturnValue(false);
});

afterEach(() => vi.unstubAllEnvs());

// ─── applyStylist ─────────────────────────────────────────────────────────────

describe('applyStylist', () => {
  it('throws AppError(409) when stylist already exists for this user', async () => {
    mockStylistFindUnique.mockResolvedValue(SAMPLE_STYLIST);
    const req = makeReq({
      body: {
        bio: 'Expert in minimalist fashion with 5 years of experience.',
        specialties: ['minimalist'],
      },
    });
    const { res } = makeRes();
    await expect(applyStylist(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws Zod error when bio is fewer than 20 characters', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq({
      body: { bio: 'Too short', specialties: ['minimalist'] },
    });
    const { res } = makeRes();
    // Zod parse throws ZodError, not AppError — the controller lets it propagate
    await expect(applyStylist(req, res)).rejects.toThrow();
  });

  it('creates stylist and responds 201', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    mockStylistCreate.mockResolvedValue(SAMPLE_STYLIST);
    const req = makeReq({
      body: {
        bio: 'Expert in minimalist fashion with 5 years of experience.',
        specialties: ['minimalist'],
      },
    });
    const { res, json, status } = makeRes();
    await applyStylist(req, res);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ stylist: SAMPLE_STYLIST }));
  });
});

// ─── getMyStylistProfile ──────────────────────────────────────────────────────

describe('getMyStylistProfile', () => {
  it('throws AppError(404) when no stylist profile found', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq();
    const { res } = makeRes();
    await expect(getMyStylistProfile(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns stylist profile', async () => {
    mockStylistFindUnique.mockResolvedValue({ ...SAMPLE_STYLIST, user: { id: 'user-1', username: 'alice', name: 'Alice', profileImageUrl: null } });
    const req = makeReq();
    const { res, json } = makeRes();
    await getMyStylistProfile(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ stylist: expect.objectContaining({ id: 'stylist-1' }) }),
    );
  });
});

// ─── updateMyStylistProfile ───────────────────────────────────────────────────

describe('updateMyStylistProfile', () => {
  it('throws AppError(404) when no stylist profile found', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq({ body: { bio: 'Updated bio that is long enough to pass validation.' } });
    const { res } = makeRes();
    await expect(updateMyStylistProfile(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates and returns stylist', async () => {
    mockStylistFindUnique.mockResolvedValue(SAMPLE_STYLIST);
    const updated = { ...SAMPLE_STYLIST, bio: 'Updated bio that is long enough to pass validation.' };
    mockStylistUpdate.mockResolvedValue(updated);
    const req = makeReq({ body: { bio: 'Updated bio that is long enough to pass validation.' } });
    const { res, json } = makeRes();
    await updateMyStylistProfile(req, res);
    expect(mockStylistUpdate).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ stylist: updated }));
  });
});

// ─── getStylists ──────────────────────────────────────────────────────────────

describe('getStylists', () => {
  it('returns only verified stylists', async () => {
    const verifiedStylist = { ...SAMPLE_STYLIST, verified: true, user: { id: 'user-1', username: 'alice', name: 'Alice', profileImageUrl: null } };
    mockStylistFindMany.mockResolvedValue([verifiedStylist]);
    const req = makeReq({ query: {} });
    const { res, json } = makeRes();
    await getStylists(req, res);
    expect(mockStylistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ verified: true }) }),
    );
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ stylists: [verifiedStylist] }));
  });
});

// ─── getStylist ───────────────────────────────────────────────────────────────

describe('getStylist', () => {
  it('throws AppError(404) when stylist not found', async () => {
    mockStylistFindUnique.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-id' } });
    const { res } = makeRes();
    await expect(getStylist(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(404) when stylist is not verified', async () => {
    mockStylistFindUnique.mockResolvedValue({ ...SAMPLE_STYLIST, verified: false });
    const req = makeReq({ params: { id: 'stylist-1' } });
    const { res } = makeRes();
    await expect(getStylist(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── verifyStylist ────────────────────────────────────────────────────────────

describe('verifyStylist', () => {
  it('throws AppError(403) when user is not admin', async () => {
    mockIsAdmin.mockReturnValue(false);
    const req = makeReq({ params: { id: 'stylist-1' } });
    const { res } = makeRes();
    await expect(verifyStylist(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('sets verified=true when admin', async () => {
    mockIsAdmin.mockReturnValue(true);
    const verified = { ...SAMPLE_STYLIST, verified: true, user: { id: 'user-1', username: 'alice', name: 'Alice' } };
    mockStylistUpdate.mockResolvedValue(verified);
    const req = makeReq({ params: { id: 'stylist-1' } });
    const { res, json } = makeRes();
    await verifyStylist(req, res);
    expect(mockStylistUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verified: true }) }),
    );
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ stylist: verified }));
  });
});

// ─── unverifyStylist ──────────────────────────────────────────────────────────

describe('unverifyStylist', () => {
  it('sets verified=false when admin', async () => {
    mockIsAdmin.mockReturnValue(true);
    const unverified = { ...SAMPLE_STYLIST, verified: false, user: { id: 'user-1', username: 'alice', name: 'Alice' } };
    mockStylistUpdate.mockResolvedValue(unverified);
    const req = makeReq({ params: { id: 'stylist-1' } });
    const { res, json } = makeRes();
    await unverifyStylist(req, res);
    expect(mockStylistUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verified: false }) }),
    );
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ stylist: unverified }));
  });
});
