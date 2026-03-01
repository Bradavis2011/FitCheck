import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockUserUpdate = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: { update: mockUserUpdate },
  },
}));

import { getCurrentVersions, acceptLegalTerms } from '../legal.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

beforeEach(() => {
  mockUserUpdate.mockReset();
  mockUserUpdate.mockResolvedValue({});
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getCurrentVersions', () => {
  it('returns default versions when env vars are not set', async () => {
    vi.stubEnv('PRIVACY_VERSION', '');
    vi.stubEnv('TOS_VERSION', '');

    const { res, json } = makeRes();
    await getCurrentVersions(makeReq(), res);

    expect(json).toHaveBeenCalledWith({ privacyVersion: '1.0', tosVersion: '1.0' });
    vi.unstubAllEnvs();
  });

  it('returns env var values when set', async () => {
    vi.stubEnv('PRIVACY_VERSION', '2.1');
    vi.stubEnv('TOS_VERSION', '3.0');

    const { res, json } = makeRes();
    await getCurrentVersions(makeReq(), res);

    expect(json).toHaveBeenCalledWith({ privacyVersion: '2.1', tosVersion: '3.0' });
    vi.unstubAllEnvs();
  });
});

describe('acceptLegalTerms', () => {
  it('updates the user with both version fields and a tosAcceptedAt date', async () => {
    const req = makeReq({
      userId: 'user-99',
      body: { privacyVersion: '2.0', tosVersion: '1.5' },
    });
    const { res } = makeRes();

    await acceptLegalTerms(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-99' },
        data: expect.objectContaining({
          privacyPolicyVersion: '2.0',
          tosVersion: '1.5',
          tosAcceptedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns { success: true } on success', async () => {
    const req = makeReq({ body: { privacyVersion: '1.0', tosVersion: '1.0' } });
    const { res, json } = makeRes();

    await acceptLegalTerms(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it('accepts partial body — only tosVersion provided', async () => {
    const req = makeReq({ body: { tosVersion: '2.0' } });
    const { res } = makeRes();

    await acceptLegalTerms(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tosVersion: '2.0' }),
      }),
    );
  });
});
