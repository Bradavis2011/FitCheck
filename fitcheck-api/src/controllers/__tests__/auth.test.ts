import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockSvixVerify = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserDelete = vi.hoisted(() => vi.fn());
const mockUserUpsert = vi.hoisted(() => vi.fn());
const mockUserStatsUpsert = vi.hoisted(() => vi.fn());
const mockTrackServerEvent = vi.hoisted(() => vi.fn());

vi.mock('svix', () => ({
  Webhook: class {
    verify = mockSvixVerify;
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      delete: mockUserDelete,
      upsert: mockUserUpsert,
    },
    userStats: {
      upsert: mockUserStatsUpsert,
    },
  },
}));

vi.mock('../../lib/posthog.js', () => ({
  trackServerEvent: mockTrackServerEvent,
}));

import { handleClerkWebhook } from '../auth.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    headers: {
      'svix-id': 'svix-id-1',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,abc123',
    },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeClerkEvent(type: string, data: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      id: 'clerk-user-1',
      email_addresses: [{ id: 'ea-1', email_address: 'alice@example.com' }],
      primary_email_address_id: 'ea-1',
      first_name: 'Alice',
      last_name: 'Smith',
      ...data,
    },
  };
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockSvixVerify.mockReturnValue(makeClerkEvent('user.created'));
  mockUserFindUnique.mockResolvedValue(null);
  mockUserDelete.mockResolvedValue({});
  mockUserUpsert.mockResolvedValue({ id: 'clerk-user-1', email: 'alice@example.com' });
  mockUserStatsUpsert.mockResolvedValue({});
  mockTrackServerEvent.mockReturnValue(undefined);
  vi.stubEnv('CLERK_WEBHOOK_SECRET', 'whsec_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  mockSvixVerify.mockReset();
  mockUserFindUnique.mockReset();
  mockUserDelete.mockReset();
  mockUserUpsert.mockReset();
  mockUserStatsUpsert.mockReset();
  mockTrackServerEvent.mockReset();
});

// ─── handleClerkWebhook ───────────────────────────────────────────────────────

describe('handleClerkWebhook — configuration & signature', () => {
  it('throws AppError(500) when CLERK_WEBHOOK_SECRET is not set', async () => {
    vi.stubEnv('CLERK_WEBHOOK_SECRET', '');
    const req = makeReq();
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining('webhook secret'),
    });
  });

  it('throws AppError(400) when svix-id header is missing', async () => {
    const req = makeReq({
      headers: {
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,abc123',
      },
    });
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('svix'),
    });
  });

  it('throws AppError(400) when svix-timestamp header is missing', async () => {
    const req = makeReq({
      headers: {
        'svix-id': 'svix-id-1',
        'svix-signature': 'v1,abc123',
      },
    });
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('svix'),
    });
  });

  it('throws AppError(400) when svix-signature header is missing', async () => {
    const req = makeReq({
      headers: {
        'svix-id': 'svix-id-1',
        'svix-timestamp': '1234567890',
      },
    });
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('svix'),
    });
  });

  it('throws AppError(400) when Webhook.verify throws (invalid signature)', async () => {
    mockSvixVerify.mockImplementation(() => {
      throw new Error('signature mismatch');
    });
    const req = makeReq();
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('signature'),
    });
  });

  it('throws AppError(400) when no email address in event data', async () => {
    mockSvixVerify.mockReturnValue(
      makeClerkEvent('user.created', {
        email_addresses: [],
        primary_email_address_id: 'ea-1',
      }),
    );
    const req = makeReq();
    const { res } = makeRes();
    await expect(handleClerkWebhook(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Email'),
    });
  });
});

describe('handleClerkWebhook — user.created', () => {
  it('upserts user with correct id, email, and name', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clerk-user-1' },
        create: expect.objectContaining({
          id: 'clerk-user-1',
          email: 'alice@example.com',
          name: 'Alice Smith',
        }),
        update: expect.objectContaining({
          email: 'alice@example.com',
          name: 'Alice Smith',
        }),
      }),
    );
  });

  it('upserts UserStats for the new user', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserStatsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'clerk-user-1' },
        create: { userId: 'clerk-user-1' },
        update: {},
      }),
    );
  });

  it('calls trackServerEvent with "user_registered"', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      'clerk-user-1',
      'user_registered',
      expect.objectContaining({ source: 'clerk_webhook' }),
    );
  });

  it('deletes stale user when a different user already holds the same email', async () => {
    // A different DB record exists with the same email but a different id
    mockUserFindUnique.mockResolvedValue({ id: 'old-stale-id', email: 'alice@example.com' });
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: 'old-stale-id' } });
    // New user upsert must still occur
    expect(mockUserUpsert).toHaveBeenCalled();
  });

  it('does NOT delete when the existing record has the same id (no collision)', async () => {
    // Same id means it is not a stale record — just an existing registration
    mockUserFindUnique.mockResolvedValue({ id: 'clerk-user-1', email: 'alice@example.com' });
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it('returns { success: true }', async () => {
    const req = makeReq();
    const { res, json } = makeRes();

    await handleClerkWebhook(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

describe('handleClerkWebhook — user.updated', () => {
  beforeEach(() => {
    mockSvixVerify.mockReturnValue(makeClerkEvent('user.updated'));
  });

  it('upserts user without creating UserStats', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clerk-user-1' },
        create: expect.objectContaining({
          id: 'clerk-user-1',
          email: 'alice@example.com',
        }),
        update: expect.objectContaining({
          email: 'alice@example.com',
        }),
      }),
    );
    expect(mockUserStatsUpsert).not.toHaveBeenCalled();
  });

  it('does NOT call trackServerEvent', async () => {
    const req = makeReq();
    const { res } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockTrackServerEvent).not.toHaveBeenCalled();
  });

  it('returns { success: true }', async () => {
    const req = makeReq();
    const { res, json } = makeRes();

    await handleClerkWebhook(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

describe('handleClerkWebhook — unknown event type', () => {
  it('returns { success: true } and performs no DB operations', async () => {
    mockSvixVerify.mockReturnValue(makeClerkEvent('user.deleted'));
    const req = makeReq();
    const { res, json } = makeRes();

    await handleClerkWebhook(req, res);

    expect(mockUserUpsert).not.toHaveBeenCalled();
    expect(mockUserStatsUpsert).not.toHaveBeenCalled();
    expect(mockTrackServerEvent).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});
