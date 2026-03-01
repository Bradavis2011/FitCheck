import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockWaitlistFindUnique = vi.hoisted(() => vi.fn());
const mockWaitlistCount = vi.hoisted(() => vi.fn());
const mockWaitlistCreate = vi.hoisted(() => vi.fn());
const mockWaitlistUpdate = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    waitlistEntry: {
      findUnique: mockWaitlistFindUnique,
      count: mockWaitlistCount,
      create: mockWaitlistCreate,
      update: mockWaitlistUpdate,
    },
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

// ─── Controller Import (after all mocks) ──────────────────────────────────────

import { joinWaitlist, getWaitlistStatus } from '../waitlist.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, query: {}, params: {}, ...overrides } as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockWaitlistFindUnique.mockReset();
  mockWaitlistCount.mockReset();
  mockWaitlistCreate.mockReset();
  mockWaitlistUpdate.mockReset();
  mockEmailSend.mockReset();

  mockWaitlistFindUnique.mockResolvedValue(null);
  mockWaitlistCount.mockResolvedValue(9);
  mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'abc123def456', id: 'wl-1' });
  mockWaitlistUpdate.mockResolvedValue({});
  mockEmailSend.mockResolvedValue({ id: 'email-1' });

  vi.stubEnv('RESEND_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── joinWaitlist ─────────────────────────────────────────────────────────────

describe('joinWaitlist', () => {
  it('returns 400 with error message for invalid email', async () => {
    const req = makeReq({ body: { email: 'not-an-email' } });
    const { res, status, json } = makeRes();

    await joinWaitlist(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns 400 for missing email', async () => {
    const req = makeReq({ body: {} });
    const { res, status, json } = makeRes();

    await joinWaitlist(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns existing position and referralCode without creating when email already on waitlist', async () => {
    mockWaitlistFindUnique.mockResolvedValueOnce({
      position: 3,
      referralCode: 'existing123456',
    });

    const req = makeReq({ body: { email: 'already@example.com' } });
    const { res, json } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistCreate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        position: 3,
        referralCode: 'existing123456',
        referralLink: expect.stringContaining('existing123456'),
      }),
    );
  });

  it('creates entry with normalized (lowercase) email', async () => {
    const req = makeReq({ body: { email: 'User@EXAMPLE.COM' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'user@example.com' }),
      }),
    );
  });

  it('assigns position as count + 1', async () => {
    mockWaitlistCount.mockResolvedValue(9);

    const req = makeReq({ body: { email: 'new@example.com' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 10 }),
      }),
    );
  });

  it('generates referral link using APP_URL env var', async () => {
    vi.stubEnv('APP_URL', 'https://custom.app');
    mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'mycode1234567', id: 'wl-2' });

    const req = makeReq({ body: { email: 'user@example.com' } });
    const { res, json } = makeRes();

    await joinWaitlist(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        referralLink: 'https://custom.app?ref=mycode1234567',
      }),
    );
  });

  it('defaults referral link base to https://orthis.app when APP_URL is not set', async () => {
    mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'defaultcode1234', id: 'wl-3' });

    const req = makeReq({ body: { email: 'user@example.com' } });
    const { res, json } = makeRes();

    await joinWaitlist(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        referralLink: expect.stringContaining('https://orthis.app'),
      }),
    );
  });

  it('returns 201 with position, referralCode, and referralLink', async () => {
    mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'abc123def456', id: 'wl-1' });

    const req = makeReq({ body: { email: 'new@example.com' } });
    const { res, status, json } = makeRes();

    await joinWaitlist(req, res);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        position: 10,
        referralCode: 'abc123def456',
        referralLink: expect.stringContaining('abc123def456'),
      }),
    );
  });

  it('bumps referrer position by -5 when a valid referral code is provided', async () => {
    // First findUnique: check existing email (null = not on list)
    // Second findUnique: look up referrer by referral code
    mockWaitlistFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'referrer-1', referralCode: 'validcode1234' });

    const req = makeReq({ body: { email: 'new@example.com', referralCode: 'validcode1234' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistUpdate).toHaveBeenCalledWith({
      where: { referralCode: 'validcode1234' },
      data: { position: { decrement: 5 } },
    });
  });

  it('records referredBy when a valid referral code is provided', async () => {
    mockWaitlistFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'referrer-1', referralCode: 'validcode1234' });

    const req = makeReq({ body: { email: 'new@example.com', referralCode: 'validcode1234' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredBy: 'validcode1234' }),
      }),
    );
  });

  it('ignores an invalid referral code — no update and referredBy is null', async () => {
    mockWaitlistFindUnique
      .mockResolvedValueOnce(null)  // email not on list
      .mockResolvedValueOnce(null); // referrer not found

    const req = makeReq({ body: { email: 'new@example.com', referralCode: 'BADCODE' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockWaitlistUpdate).not.toHaveBeenCalled();
    expect(mockWaitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredBy: null }),
      }),
    );
  });

  it('does NOT send email when RESEND_API_KEY is not set', async () => {
    // RESEND_API_KEY is '' by default (set in beforeEach).
    // This test must run before any test that sets RESEND_API_KEY, because the
    // _resend singleton in the controller module is created lazily on first call
    // and is never reset between tests. When the key is blank, getResend() returns
    // null and no email is dispatched.
    mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'abc123def456', id: 'wl-1' });

    const req = makeReq({ body: { email: 'user@example.com' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends welcome email when RESEND_API_KEY is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    mockWaitlistCreate.mockResolvedValue({ position: 10, referralCode: 'abc123def456', id: 'wl-1' });
    mockEmailSend.mockResolvedValue({ id: 'email-1' });

    const req = makeReq({ body: { email: 'user@example.com' } });
    const { res } = makeRes();

    await joinWaitlist(req, res);

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('waitlist'),
      }),
    );
  });
});

// ─── getWaitlistStatus ────────────────────────────────────────────────────────

describe('getWaitlistStatus', () => {
  it('returns 400 when email query param is missing', async () => {
    const req = makeReq({ query: {} });
    const { res, status, json } = makeRes();

    await getWaitlistStatus(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns 404 when email is not on waitlist', async () => {
    mockWaitlistFindUnique.mockResolvedValue(null);

    const req = makeReq({ query: { email: 'unknown@example.com' } });
    const { res, status, json } = makeRes();

    await getWaitlistStatus(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not found' }),
    );
  });

  it('returns position, referralCode, and referralLink for an existing entry', async () => {
    mockWaitlistFindUnique.mockResolvedValue({
      position: 7,
      referralCode: 'mycode1234567',
    });

    const req = makeReq({ query: { email: 'found@example.com' } });
    const { res, json } = makeRes();

    await getWaitlistStatus(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        position: 7,
        referralCode: 'mycode1234567',
        referralLink: expect.stringContaining('mycode1234567'),
      }),
    );
  });

  it('normalizes email to lowercase before querying', async () => {
    mockWaitlistFindUnique.mockResolvedValue({
      position: 1,
      referralCode: 'code1',
    });

    const req = makeReq({ query: { email: 'UPPER@EXAMPLE.COM' } });
    const { res } = makeRes();

    await getWaitlistStatus(req, res);

    expect(mockWaitlistFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'upper@example.com' } }),
    );
  });
});
