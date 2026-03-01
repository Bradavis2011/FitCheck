import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockRegister = vi.hoisted(() => vi.fn());
const mockUnregister = vi.hoisted(() => vi.fn());

vi.mock('../../services/push.service.js', () => ({
  pushService: {
    registerPushToken: mockRegister,
    unregisterPushToken: mockUnregister,
  },
}));

import { registerPushToken, unregisterPushToken } from '../push.controller.js';

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

beforeEach(() => {
  mockRegister.mockReset();
  mockUnregister.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

// ─── registerPushToken ────────────────────────────────────────────────────────

describe('registerPushToken', () => {
  it('throws AppError(400) on invalid request — missing token', async () => {
    const req = makeReq({ body: { platform: 'ios' } }); // token missing
    const { res } = makeRes();
    await expect(registerPushToken(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(400) on invalid request — invalid platform', async () => {
    const req = makeReq({ body: { token: 'ExponentPushToken[abc123]', platform: 'windows' } });
    const { res } = makeRes();
    await expect(registerPushToken(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('calls pushService.registerPushToken with userId, token, platform', async () => {
    mockRegister.mockResolvedValue(undefined);
    const req = makeReq({ body: { token: 'ExponentPushToken[abc123]', platform: 'ios' } });
    const { res } = makeRes();
    await registerPushToken(req, res);
    expect(mockRegister).toHaveBeenCalledWith('user-1', 'ExponentPushToken[abc123]', 'ios');
  });

  it('returns { success: true, message: ... } on success', async () => {
    mockRegister.mockResolvedValue(undefined);
    const req = makeReq({ body: { token: 'ExponentPushToken[abc123]', platform: 'android' } });
    const { res, json } = makeRes();
    await registerPushToken(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.any(String) }),
    );
  });
});

// ─── unregisterPushToken ──────────────────────────────────────────────────────

describe('unregisterPushToken', () => {
  it('throws AppError(400) when token is missing from body', async () => {
    const req = makeReq({ body: {} });
    const { res } = makeRes();
    await expect(unregisterPushToken(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('calls pushService.unregisterPushToken with token', async () => {
    mockUnregister.mockResolvedValue(undefined);
    const req = makeReq({ body: { token: 'ExponentPushToken[abc123]' } });
    const { res } = makeRes();
    await unregisterPushToken(req, res);
    expect(mockUnregister).toHaveBeenCalledWith('ExponentPushToken[abc123]');
  });

  it('returns { success: true, message: ... } on success', async () => {
    mockUnregister.mockResolvedValue(undefined);
    const req = makeReq({ body: { token: 'ExponentPushToken[abc123]' } });
    const { res, json } = makeRes();
    await unregisterPushToken(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.any(String) }),
    );
  });
});
