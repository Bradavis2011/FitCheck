import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted ensures these are initialized before vi.mock factories run
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockSubscriptionEventCreate = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    subscriptionEvent: {
      create: mockSubscriptionEventCreate,
    },
  },
}));

import { processWebhookEvent } from '../subscription.service.js';

function makePayload(eventType: string, overrides: Record<string, unknown> = {}) {
  return {
    api_version: '1.0',
    event: {
      type: eventType,
      app_user_id: 'user-1',
      original_app_user_id: 'user-1',
      product_id: 'product.plus.monthly',
      entitlement_ids: ['plus'],
      expiration_at_ms: null as number | null,
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      event_timestamp_ms: Date.now(),
      ...overrides,
    },
  };
}

const EXISTING_USER = { id: 'user-1', tier: 'plus' };

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();
  mockSubscriptionEventCreate.mockReset();
  mockUserUpdate.mockResolvedValue({});
  mockSubscriptionEventCreate.mockResolvedValue({});
});

describe('processWebhookEvent — unknown user', () => {
  it('returns without creating any records when user is not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    await processWebhookEvent(makePayload('INITIAL_PURCHASE'));
    expect(mockSubscriptionEventCreate).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('processWebhookEvent — INITIAL_PURCHASE', () => {
  it('creates a subscription event and upgrades the user tier', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    await processWebhookEvent(makePayload('INITIAL_PURCHASE'));

    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();
    expect(mockSubscriptionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', eventType: 'INITIAL_PURCHASE' }),
      }),
    );

    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data.tier).toBe('plus');
  });
});

describe('processWebhookEvent — CANCELLATION', () => {
  it('creates a subscription event and updates only expiration date (tier is preserved)', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    const expiresMs = Date.now() + 1000 * 60 * 60 * 24 * 30;
    await processWebhookEvent(makePayload('CANCELLATION', { expiration_at_ms: expiresMs }));

    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();

    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    // CANCELLATION does NOT change the tier — user keeps access until expiry
    expect(updateCall.data.tier).toBeUndefined();
    expect(updateCall.data.subscriptionExpiresAt).toBeInstanceOf(Date);
  });
});

describe('processWebhookEvent — EXPIRATION', () => {
  it('creates a subscription event and downgrades the user to free', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    await processWebhookEvent(makePayload('EXPIRATION'));

    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();

    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data.tier).toBe('free');
    expect(updateCall.data.subscriptionExpiresAt).toBeNull();
    expect(updateCall.data.subscriptionProductId).toBeNull();
  });
});

describe('processWebhookEvent — BILLING_ISSUE', () => {
  it('creates a subscription event but does not update the user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    await processWebhookEvent(makePayload('BILLING_ISSUE'));

    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('processWebhookEvent — unknown event type', () => {
  it('creates a subscription event but does not update the user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    await processWebhookEvent(makePayload('SOME_FUTURE_EVENT'));

    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('processWebhookEvent — RENEWAL', () => {
  it('creates a subscription event and updates the user tier', async () => {
    mockUserFindUnique.mockResolvedValueOnce(EXISTING_USER);
    await processWebhookEvent(makePayload('RENEWAL'));
    expect(mockSubscriptionEventCreate).toHaveBeenCalledOnce();
    expect(mockUserUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data.tier).toBe('plus');
  });
});
