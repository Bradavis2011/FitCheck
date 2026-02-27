/**
 * Resend Webhook Controller
 *
 * Receives email delivery events from Resend and updates EmailEvent.status.
 * Supported events: email.delivered, email.opened, email.clicked, email.bounced
 *
 * RESEND_WEBHOOK_SECRET must be set in env — requests without valid signatures are rejected.
 */

import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../utils/prisma.js';

// Status priority — only upgrade, never downgrade
const STATUS_RANK: Record<string, number> = {
  sent: 0,
  delivered: 1,
  opened: 2,
  clicked: 3,
  bounced: 1, // bounced is terminal but ranked low so opened can't downgrade to bounced
};

const EVENT_TO_STATUS: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
};

export async function handleResendWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Reject all requests when the secret is not configured — misconfigured server
    console.error('[ResendWebhook] RESEND_WEBHOOK_SECRET is not set — rejecting all requests');
    res.status(503).json({ error: 'Webhook not configured' });
    return;
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(401).json({ error: 'Missing webhook signature headers' });
    return;
  }

  // req.body is a Buffer when express.raw() is used on this route (see server.ts)
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Parse body (may be raw Buffer or already-parsed object)
  let parsedBody: { type?: string; data?: { email_id?: string; to?: string[] } };
  if (Buffer.isBuffer(req.body)) {
    try { parsedBody = JSON.parse(req.body.toString('utf8')); } catch { parsedBody = {}; }
  } else {
    parsedBody = req.body;
  }
  const body = parsedBody;
  const eventType = body?.type;
  const newStatus = EVENT_TO_STATUS[eventType || ''];

  if (!newStatus) {
    // Unrecognised event — ack it so Resend doesn't retry
    res.json({ received: true, skipped: true });
    return;
  }

  const emailId = body?.data?.email_id;
  if (!emailId) {
    res.json({ received: true, skipped: true, reason: 'no_email_id' });
    return;
  }

  try {
    // EmailEvent doesn't store Resend's email_id directly, so we update the most recent
    // 'sent' event that matches. A production integration would store externalId on send.
    // For now we look for sent events and upgrade their status using the to address.
    const toAddress = body?.data?.to?.[0];

    if (toAddress) {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: toAddress },
        select: { id: true },
      });

      if (user) {
        // Find the most recent 'sent' or lower-rank email event for this user
        const existing = await prisma.emailEvent.findFirst({
          where: { userId: user.id },
          orderBy: { sentAt: 'desc' },
        });

        if (existing) {
          const currentRank = STATUS_RANK[existing.status] ?? 0;
          const newRank = STATUS_RANK[newStatus] ?? 0;

          // Only upgrade status (never downgrade)
          if (newRank > currentRank) {
            await prisma.emailEvent.update({
              where: { id: existing.id },
              data: { status: newStatus },
            });
            console.log(`[ResendWebhook] Updated email event ${existing.id}: ${existing.status} → ${newStatus}`);
          }

          // Track click/open conversions: did user check outfit within 48h?
          if (newStatus === 'clicked' || newStatus === 'opened') {
            const fortyEightHoursAfter = new Date(existing.sentAt.getTime() + 48 * 60 * 60 * 1000);
            const outfitCheck = await prisma.outfitCheck.findFirst({
              where: {
                userId: user.id,
                isDeleted: false,
                createdAt: { gte: existing.sentAt, lte: fortyEightHoursAfter },
              },
            });

            if (outfitCheck) {
              // Increment conversion count on the matching variant if one was used
              await prisma.emailTemplateVariant.updateMany({
                where: {
                  sequence: existing.sequence,
                  step: existing.step,
                },
                data: { conversions: { increment: 1 } },
              });
            }

            // Increment opens/clicks on variants
            if (newStatus === 'opened') {
              await prisma.emailTemplateVariant.updateMany({
                where: { sequence: existing.sequence, step: existing.step, field: 'subject' },
                data: { opens: { increment: 1 } },
              });
            } else if (newStatus === 'clicked') {
              await prisma.emailTemplateVariant.updateMany({
                where: { sequence: existing.sequence, step: existing.step, field: 'ctaText' },
                data: { clicks: { increment: 1 } },
              });
            }
          }
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[ResendWebhook] Error processing webhook:', err);
    // Still 200 so Resend doesn't retry — the error is logged
    res.json({ received: true, error: 'processing_failed' });
  }
}
