import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockSvixVerify = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockEmailEventFindFirst = vi.hoisted(() => vi.fn());
const mockEmailEventUpdate = vi.hoisted(() => vi.fn());
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockVariantUpdateMany = vi.hoisted(() => vi.fn());

vi.mock('svix', () => ({
  Webhook: class {
    verify = mockSvixVerify;
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
    emailEvent: {
      findFirst: mockEmailEventFindFirst,
      update: mockEmailEventUpdate,
    },
    outfitCheck: {
      findFirst: mockOutfitFindFirst,
    },
    emailTemplateVariant: {
      updateMany: mockVariantUpdateMany,
    },
  },
}));

import { handleResendWebhook } from '../resend-webhook.controller.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXISTING_EVENT = {
  id: 'ev-1',
  userId: 'user-1',
  status: 'sent',
  sequence: 'welcome',
  step: 0,
  sentAt: new Date('2026-01-01T10:00:00Z'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWebhookReq(overrides = {}) {
  return {
    headers: {
      'svix-id': 'sid-1',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,abc',
    },
    body: Buffer.from(
      JSON.stringify({ type: 'email.delivered', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
    ),
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const statusJson = vi.fn();
  const status = vi.fn().mockReturnValue({ json: statusJson });
  return {
    res: { json, status } as unknown as Response,
    json,
    status,
    statusJson,
  };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockSvixVerify.mockReturnValue({});
  mockUserFindUnique.mockResolvedValue({ id: 'user-1' });
  mockEmailEventFindFirst.mockResolvedValue({ ...EXISTING_EVENT });
  mockEmailEventUpdate.mockResolvedValue({});
  mockOutfitFindFirst.mockResolvedValue(null);
  mockVariantUpdateMany.mockResolvedValue({ count: 1 });
  vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  mockSvixVerify.mockReset();
  mockUserFindUnique.mockReset();
  mockEmailEventFindFirst.mockReset();
  mockEmailEventUpdate.mockReset();
  mockOutfitFindFirst.mockReset();
  mockVariantUpdateMany.mockReset();
});

// ─── handleResendWebhook — configuration & signature ─────────────────────────

describe('handleResendWebhook — configuration & signature', () => {
  it('returns 503 when RESEND_WEBHOOK_SECRET is not set', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    const req = makeWebhookReq();
    const { res, status, statusJson } = makeRes();

    await handleResendWebhook(req, res);

    expect(status).toHaveBeenCalledWith(503);
    expect(statusJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 401 when svix-id header is missing', async () => {
    const req = makeWebhookReq({
      headers: {
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,abc',
      },
    });
    const { res, status, statusJson } = makeRes();

    await handleResendWebhook(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(statusJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 401 when signature verification fails (verify throws)', async () => {
    mockSvixVerify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const req = makeWebhookReq();
    const { res, status, statusJson } = makeRes();

    await handleResendWebhook(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(statusJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});

// ─── handleResendWebhook — unknown / malformed events ─────────────────────────

describe('handleResendWebhook — unknown and malformed events', () => {
  it('acks unknown event types with { received: true, skipped: true }', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.spam_complaint', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(json).toHaveBeenCalledWith({ received: true, skipped: true });
    expect(mockEmailEventUpdate).not.toHaveBeenCalled();
  });

  it('acks when no email_id in body data', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.delivered', data: { to: ['alice@example.com'] } }),
      ),
    });
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(json).toHaveBeenCalledWith({ received: true, skipped: true, reason: 'no_email_id' });
    expect(mockEmailEventUpdate).not.toHaveBeenCalled();
  });
});

// ─── handleResendWebhook — status upgrade logic ───────────────────────────────

describe('handleResendWebhook — status upgrade logic', () => {
  it('updates email event status from "sent" to "delivered"', async () => {
    // Default setup: existing event status='sent', incoming event='email.delivered'
    const req = makeWebhookReq();
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockEmailEventUpdate).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: { status: 'delivered' },
    });
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('does NOT downgrade status (opened → delivered should not update)', async () => {
    // Existing event is already 'opened' (rank 2); incoming is 'delivered' (rank 1)
    mockEmailEventFindFirst.mockResolvedValue({ ...EXISTING_EVENT, status: 'opened' });
    const req = makeWebhookReq(); // sends email.delivered
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockEmailEventUpdate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('updates status to "opened" for email.opened events', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.opened', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockEmailEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'opened' } }),
    );
    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('updates status to "clicked" for email.clicked events', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.clicked', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockEmailEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'clicked' } }),
    );
    expect(json).toHaveBeenCalledWith({ received: true });
  });
});

// ─── handleResendWebhook — variant opens / clicks / conversions ───────────────

describe('handleResendWebhook — variant engagement tracking', () => {
  it('increments opens on variant for email.opened', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.opened', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockVariantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sequence: 'welcome',
          step: 0,
          field: 'subject',
        }),
        data: { opens: { increment: 1 } },
      }),
    );
  });

  it('increments clicks on variant for email.clicked', async () => {
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.clicked', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res } = makeRes();

    await handleResendWebhook(req, res);

    expect(mockVariantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sequence: 'welcome',
          step: 0,
          field: 'ctaText',
        }),
        data: { clicks: { increment: 1 } },
      }),
    );
  });

  it('increments conversions when outfit check found within 48h of opened event', async () => {
    mockOutfitFindFirst.mockResolvedValue({ id: 'outfit-1' });
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.opened', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res } = makeRes();

    await handleResendWebhook(req, res);

    // Should call updateMany for conversions
    expect(mockVariantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sequence: 'welcome', step: 0 },
        data: { conversions: { increment: 1 } },
      }),
    );
  });

  it('does NOT increment conversions when no outfit check within 48h', async () => {
    // mockOutfitFindFirst already returns null in beforeEach
    const req = makeWebhookReq({
      body: Buffer.from(
        JSON.stringify({ type: 'email.opened', data: { email_id: 'email-1', to: ['alice@example.com'] } }),
      ),
    });
    const { res } = makeRes();

    await handleResendWebhook(req, res);

    // updateMany should only be called for opens (subject field), not conversions
    const conversionCall = mockVariantUpdateMany.mock.calls.find(
      (call) => call[0]?.data?.conversions !== undefined,
    );
    expect(conversionCall).toBeUndefined();
  });
});

// ─── handleResendWebhook — error handling ────────────────────────────────────

describe('handleResendWebhook — error handling', () => {
  it('returns { received: true } on success', async () => {
    const req = makeWebhookReq();
    const { res, json } = makeRes();

    await handleResendWebhook(req, res);

    expect(json).toHaveBeenCalledWith({ received: true });
  });

  it('returns { received: true, error: "processing_failed" } when DB throws (still 200)', async () => {
    mockEmailEventFindFirst.mockRejectedValue(new Error('DB connection lost'));
    const req = makeWebhookReq();
    const { res, json, status } = makeRes();

    await handleResendWebhook(req, res);

    // Must NOT call res.status() — still 200
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ received: true, error: 'processing_failed' });
  });
});
