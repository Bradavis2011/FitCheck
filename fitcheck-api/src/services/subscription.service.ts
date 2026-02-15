import { prisma } from '../utils/prisma.js';
import { entitlementToTier } from '../constants/tiers.js';

interface RevenueCatWebhookEvent {
  type: string;
  app_user_id: string;
  original_app_user_id: string;
  product_id: string;
  entitlement_ids: string[];
  expiration_at_ms: number | null;
  store: string;
  environment: string;
  event_timestamp_ms: number;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatWebhookEvent;
}

export async function processWebhookEvent(payload: RevenueCatWebhookPayload): Promise<void> {
  const event = payload.event;
  const userId = event.app_user_id;

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.warn(`[Subscription] Webhook for unknown user: ${userId}`);
    return; // Don't throw -- return 200 to RevenueCat so it doesn't retry
  }

  // Log the event for auditing
  await prisma.subscriptionEvent.create({
    data: {
      userId,
      eventType: event.type,
      productId: event.product_id,
      entitlementIds: event.entitlement_ids || [],
      store: event.store,
      environment: event.environment,
      rawPayload: payload as any,
    },
  });

  // Determine new tier from entitlements
  const newTier = entitlementToTier(event.entitlement_ids || []);
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  // Handle event types
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIPTION_EXTENDED':
      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: newTier,
          subscriptionExpiresAt: expiresAt,
          subscriptionProductId: event.product_id,
          subscriptionStore: event.store,
          revenuecatId: userId,
        },
      });
      console.log(`[Subscription] User ${userId} upgraded to ${newTier}`);
      break;

    case 'CANCELLATION':
      // User cancelled but may still have access until expiration
      // Keep current tier but update expiration
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionExpiresAt: expiresAt,
        },
      });
      console.log(`[Subscription] User ${userId} cancelled (expires at ${expiresAt})`);
      break;

    case 'EXPIRATION':
      // Access should be revoked
      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: 'free',
          subscriptionExpiresAt: null,
          subscriptionProductId: null,
        },
      });
      console.log(`[Subscription] User ${userId} subscription expired, reverted to free`);
      break;

    case 'BILLING_ISSUE':
      // Log but don't immediately downgrade -- RevenueCat handles grace periods
      console.warn(`[Subscription] Billing issue for user ${userId}`);
      break;

    default:
      console.log(`[Subscription] Unhandled event type: ${event.type}`);
  }
}

/**
 * Client-initiated sync: the app calls this on launch to ensure
 * the backend tier matches RevenueCat state.
 */
export async function syncSubscriptionFromClient(
  userId: string,
  entitlementIds: string[],
  productId: string | null,
  expiresAt: number | null
): Promise<{ tier: string; expiresAt: Date | null }> {
  const newTier = entitlementToTier(entitlementIds);
  const expiresDate = expiresAt ? new Date(expiresAt) : null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      tier: newTier,
      subscriptionExpiresAt: expiresDate,
      subscriptionProductId: productId,
      revenuecatId: userId,
    },
    select: { tier: true, subscriptionExpiresAt: true },
  });

  console.log(`[Subscription] Synced user ${userId} to tier ${newTier}`);

  return {
    tier: updated.tier,
    expiresAt: updated.subscriptionExpiresAt,
  };
}
