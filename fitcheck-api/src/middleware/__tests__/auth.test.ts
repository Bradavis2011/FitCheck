import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

const mockVerifyToken = vi.hoisted(() => vi.fn());
const mockClerkInstance = vi.hoisted(() => ({ users: { getUser: vi.fn() } }));
const mockCreateClerkClient = vi.hoisted(() => vi.fn(() => mockClerkInstance));
const mockSafeTokenEqual = vi.hoisted(() => vi.fn());
const mockGetAdminUserIds = vi.hoisted(() => vi.fn());

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpsert = vi.hoisted(() => vi.fn());
const mockUserDelete = vi.hoisted(() => vi.fn());
const mockUserStatsUpsert = vi.hoisted(() => vi.fn());

vi.mock('@clerk/express', () => ({
  verifyToken: mockVerifyToken,
  createClerkClient: mockCreateClerkClient,
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      upsert: mockUserUpsert,
      delete: mockUserDelete,
    },
    userStats: { upsert: mockUserStatsUpsert },
  },
}));

vi.mock('../../utils/crypto.js', () => ({ safeTokenEqual: mockSafeTokenEqual }));
vi.mock('../../utils/admin.js', () => ({ getAdminUserIds: mockGetAdminUserIds }));

import { authenticateToken } from '../auth.js';

function makeReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

function makeNext() {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  delete process.env.ADMIN_DASHBOARD_TOKEN;
  mockVerifyToken.mockReset();
  mockClerkInstance.users.getUser.mockReset();
  mockSafeTokenEqual.mockReset();
  mockGetAdminUserIds.mockReset();
  mockUserFindUnique.mockReset();
  mockUserUpsert.mockReset();
  mockUserDelete.mockReset();
  mockUserStatsUpsert.mockReset();
});

afterEach(() => {
  delete process.env.ADMIN_DASHBOARD_TOKEN;
});

describe('authenticateToken — no token', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const req = makeReq();
    const { res, status, json } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is an empty string', async () => {
    const req = makeReq('Bearer ');
    const { res, status, json } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    // Empty string is falsy → treated as no token
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });
});

describe('authenticateToken — admin dashboard token', () => {
  it('grants admin access when token matches ADMIN_DASHBOARD_TOKEN', async () => {
    process.env.ADMIN_DASHBOARD_TOKEN = 'super-secret';
    mockSafeTokenEqual.mockReturnValue(true);
    mockGetAdminUserIds.mockReturnValue(['admin-user-1']);

    const req = makeReq('Bearer super-secret');
    const { res } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(req.userId).toBe('admin-user-1');
    expect(next).toHaveBeenCalled();
  });

  it('falls through to Clerk when admin token matches but no adminId is configured', async () => {
    process.env.ADMIN_DASHBOARD_TOKEN = 'super-secret';
    mockSafeTokenEqual.mockReturnValue(true);
    mockGetAdminUserIds.mockReturnValue([]); // no admin IDs configured

    // After falling through, Clerk will reject the token
    mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

    const req = makeReq('Bearer super-secret');
    const { res, status } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    // Should have tried Clerk and failed
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateToken — Clerk verification', () => {
  it('authenticates a user already in the database', async () => {
    mockSafeTokenEqual.mockReturnValue(false);
    mockVerifyToken.mockResolvedValue({ sub: 'clerk-user-123' });
    mockUserFindUnique.mockResolvedValue({
      id: 'clerk-user-123',
      email: 'alice@example.com',
      tier: 'free',
    });

    const req = makeReq('Bearer valid-clerk-token');
    const { res } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(req.userId).toBe('clerk-user-123');
    expect(req.user).toMatchObject({ id: 'clerk-user-123', email: 'alice@example.com', tier: 'free' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when the Clerk token is invalid', async () => {
    mockSafeTokenEqual.mockReturnValue(false);
    mockVerifyToken.mockRejectedValue(new Error('Token expired'));

    const req = makeReq('Bearer bad-token');
    const { res, status, json } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateToken — user sync (not in DB)', () => {
  it('creates a new user from Clerk data when not found in DB', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'new-clerk-id' });

    // 1st findUnique: user not in DB by Clerk ID
    // 2nd findUnique: no stale record by email
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockClerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ id: 'email-1', emailAddress: 'newuser@example.com' }],
      primaryEmailAddressId: 'email-1',
      firstName: 'New',
      lastName: 'User',
    });

    mockUserUpsert.mockResolvedValue({
      id: 'new-clerk-id',
      email: 'newuser@example.com',
      tier: 'free',
    });
    mockUserStatsUpsert.mockResolvedValue({});

    const req = makeReq('Bearer fresh-token');
    const { res } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'new-clerk-id' },
        create: expect.objectContaining({ email: 'newuser@example.com', name: 'New User' }),
      }),
    );
    expect(mockUserStatsUpsert).toHaveBeenCalled();
    expect(req.userId).toBe('new-clerk-id');
    expect(next).toHaveBeenCalled();
  });

  it('deletes stale record and creates fresh user when email already exists under a different ID', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'new-clerk-id' });

    mockUserFindUnique
      .mockResolvedValueOnce(null)                         // by Clerk ID: not found
      .mockResolvedValueOnce({ id: 'old-clerk-id', email: 'same@example.com' }); // stale by email

    mockClerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ id: 'e1', emailAddress: 'same@example.com' }],
      primaryEmailAddressId: 'e1',
      firstName: null,
      lastName: null,
    });

    mockUserUpsert.mockResolvedValue({ id: 'new-clerk-id', email: 'same@example.com', tier: 'free' });
    mockUserStatsUpsert.mockResolvedValue({});

    const req = makeReq('Bearer token');
    const { res } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: 'old-clerk-id' } });
    expect(mockUserUpsert).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when Clerk user has no email address', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'no-email-id' });
    mockUserFindUnique.mockResolvedValueOnce(null);

    mockClerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [],
      primaryEmailAddressId: null,
      firstName: 'Ghost',
      lastName: null,
    });

    const req = makeReq('Bearer token');
    const { res, status, json } = makeRes();
    const next = makeNext();

    await authenticateToken(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'User email not found' });
    expect(next).not.toHaveBeenCalled();
  });
});
