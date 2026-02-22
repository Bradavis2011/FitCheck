import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { processWebhookEvent, syncSubscriptionFromClient } from '../services/subscription.service.js';
import { getTierLimits } from '../constants/tiers.js';
import { trackServerEvent } from '../lib/posthog.js';
import { prisma } from '../utils/prisma.js';

const REVENUECAT_WEBHOOK_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;

/**
 * POST /api/webhooks/revenuecat
 * Called by RevenueCat when subscription events occur.
 * NOT behind auth middleware -- uses its own authorization header.
 */
export async function handleWebhook(req: Request, res: Response) {
  // Verify authorization header
  const authHeader = req.headers['authorization'];
  if (!REVENUECAT_WEBHOOK_AUTH || authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH}`) {
    console.warn('[Webhook] Unauthorized webhook attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await processWebhookEvent(req.body);
    // Track subscription events in PostHog
    const evt = req.body?.event || req.body;
    const eventType = evt?.type || 'unknown';
    const appUserId = evt?.app_user_id;
    if (appUserId) {
      trackServerEvent(appUserId, 'subscription_event', {
        type: eventType,
        tier: Array.isArray(evt?.entitlement_ids) ? evt.entitlement_ids[0] : null,
        productId: evt?.product_id || null,
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    Sentry.captureException(error, { extra: { webhookPayload: req.body } });
    // Attempt to persist the failed event so it can be reprocessed
    try {
      const evt = req.body?.event || req.body;
      const appUserId = evt?.app_user_id || null;
      if (appUserId) {
        const user = await prisma.user.findUnique({ where: { revenuecatId: appUserId }, select: { id: true } });
        if (user) {
          await prisma.subscriptionEvent.create({
            data: {
              userId: user.id,
              eventType: 'PROCESSING_ERROR',
              entitlementIds: [],
              rawPayload: req.body,
            },
          });
        }
      }
    } catch (persistError) {
      console.error('[Webhook] Failed to persist error event:', persistError);
    }
    // Return 200 to prevent RevenueCat from retrying — event is logged for manual reprocessing
    res.status(200).json({ success: true, warning: 'Processed with errors' });
  }
}

/**
 * POST /api/subscription/sync
 * Called by the app on launch to sync RevenueCat state to backend.
 * Behind auth middleware.
 */
export async function syncSubscription(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { entitlementIds, productId, expiresAt } = req.body;

  if (!Array.isArray(entitlementIds)) {
    throw new AppError(400, 'entitlementIds must be an array');
  }

  const result = await syncSubscriptionFromClient(
    userId,
    entitlementIds,
    productId || null,
    expiresAt || null
  );

  res.json(result);
}

/**
 * GET /api/subscription/status
 * Returns current subscription status and tier limits.
 */
export async function getSubscriptionStatus(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const limits = getTierLimits(user.tier);

  res.json({
    tier: user.tier,
    limits: {
      dailyChecks: limits.dailyChecks === Infinity ? -1 : limits.dailyChecks,
      followUpsPerCheck: limits.followUpsPerCheck,
      historyDays: limits.historyDays === Infinity ? -1 : limits.historyDays,
      hasAds: limits.hasAds,
      hasPriorityProcessing: limits.hasPriorityProcessing,
    },
  });
}
