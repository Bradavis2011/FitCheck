import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// vi.hoisted runs before any import — sets env var before subscription.controller.ts is evaluated
const { WEBHOOK_TOKEN } = vi.hoisted(() => {
  const WEBHOOK_TOKEN = 'test-webhook-secret';
  process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = WEBHOOK_TOKEN;
  return { WEBHOOK_TOKEN };
});

// vi.hoisted ensures mock functions are initialized before vi.mock factories run
const mockProcessWebhookEvent = vi.hoisted(() => vi.fn());
const mockTrackServerEvent = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockSubscriptionEventCreate = vi.hoisted(() => vi.fn());

vi.mock('../../services/subscription.service.js', () => ({
  processWebhookEvent: mockProcessWebhookEvent,
  syncSubscriptionFromClient: vi.fn(),
}));

vi.mock('../../lib/posthog.js', () => ({
  trackServerEvent: mockTrackServerEvent,
}));

vi.mock('@sentry/node', () => ({
  captureException: mockCaptureException,
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    subscriptionEvent: { create: mockSubscriptionEventCreate },
  },
}));

import { handleWebhook } from '../subscription.controller.js';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { authorization: `Bearer ${WEBHOOK_TOKEN}` },
    body: {
      api_version: '1.0',
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user-1',
        product_id: 'product.plus.monthly',
        entitlement_ids: ['plus'],
        store: 'APP_STORE',
        environment: 'PRODUCTION',
        event_timestamp_ms: Date.now(),
        expiration_at_ms: null,
      },
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

beforeEach(() => {
  mockProcessWebhookEvent.mockReset();
  mockTrackServerEvent.mockReset();
  mockCaptureException.mockReset();
  mockUserFindUnique.mockReset();
  mockSubscriptionEventCreate.mockReset();
});

describe('handleWebhook — auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq({ headers: {} });
    const { res, status, json } = makeRes();
    await handleWebhook(req, res);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('returns 401 when Authorization header has the wrong token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer wrong-token' } });
    const { res, status, json } = makeRes();
    await handleWebhook(req, res);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});

describe('handleWebhook — success path', () => {
  it('calls processWebhookEvent and returns 200 on success', async () => {
    mockProcessWebhookEvent.mockResolvedValueOnce(undefined);
    const req = makeReq();
    const { res, status, json } = makeRes();
    await handleWebhook(req, res);
    expect(mockProcessWebhookEvent).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it('tracks a PostHog event when app_user_id is present', async () => {
    mockProcessWebhookEvent.mockResolvedValueOnce(undefined);
    const req = makeReq();
    const { res } = makeRes();
    await handleWebhook(req, res);
    expect(mockTrackServerEvent).toHaveBeenCalledWith(
      'user-1',
      'subscription_event',
      expect.objectContaining({ type: 'INITIAL_PURCHASE' }),
    );
  });
});

describe('handleWebhook — error recovery', () => {
  it('persists an error event and still returns 200 when processing throws', async () => {
    mockProcessWebhookEvent.mockRejectedValueOnce(new Error('DB failure'));
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1' });
    mockSubscriptionEventCreate.mockResolvedValueOnce({});
    const req = makeReq();
    const { res, status, json } = makeRes();
    await handleWebhook(req, res);
    expect(mockSubscriptionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', eventType: 'PROCESSING_ERROR' }),
      }),
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, warning: 'Processed with errors' });
  });
});
