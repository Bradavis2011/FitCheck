import { createHmac } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';
import { AppError } from '../middleware/errorHandler.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

/**
 * Generates an HMAC-SHA256 token for an email click-through link.
 * Prevents enumeration/CSRF on the unauthenticated follow-up endpoint.
 * If FOLLOW_UP_HMAC_SECRET is not set, returns an empty string (token omitted from URL).
 */
export function generateFollowUpToken(id: string, response: string): string {
  const secret = process.env.FOLLOW_UP_HMAC_SECRET;
  if (!secret) return '';
  return createHmac('sha256', secret).update(`${id}:${response}`).digest('hex');
}

export const EVENT_OCCASIONS = ['Date Night', 'Interview', 'Event'];

// Max 3 relationship notifications (event_followup + style_narrative + milestone) per user per day
export async function canSendRelationshipNotification(userId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const count = await prisma.notification.count({
    where: {
      userId,
      type: { in: ['event_followup', 'style_narrative', 'milestone'] },
      createdAt: { gte: todayStart },
    },
  });

  return count < 3;
}

// Calculate 9am UTC the morning after the eventDate (or tomorrow if no eventDate)
function calculateFollowUpAt(eventDate?: Date | null): Date {
  const base = eventDate ? new Date(eventDate) : new Date();
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

export async function scheduleFollowUp(
  outfitCheckId: string,
  userId: string,
  occasions: string[],
  eventDate?: Date | null,
): Promise<void> {
  try {
    const matchingOccasion = occasions.find((o) => EVENT_OCCASIONS.includes(o));
    if (!matchingOccasion) return;

    let followUpAt = calculateFollowUpAt(eventDate);

    // If scheduled time is in the past (e.g., eventDate was today and it's already past 9am tomorrow),
    // push to the next 9am UTC
    if (followUpAt <= new Date()) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(9, 0, 0, 0);
      followUpAt = tomorrow;
    }

    await prisma.eventFollowUp.create({
      data: {
        outfitCheckId,
        userId,
        occasion: matchingOccasion,
        eventDate: eventDate || null,
        followUpAt,
      },
    });

    console.log(`[EventFollowUp] Scheduled follow-up for outfit ${outfitCheckId} at ${followUpAt.toISOString()}`);
  } catch (err) {
    console.error('[EventFollowUp] Failed to schedule follow-up:', err);
  }
}

export async function runEventFollowUp(): Promise<void> {
  const now = new Date();

  // Expire stale follow-ups (no response after 7 days)
  await prisma.eventFollowUp.updateMany({
    where: {
      status: { in: ['pending', 'push_sent', 'email_sent'] },
      followUpAt: { lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    data: { status: 'expired' },
  });

  const pending = await prisma.eventFollowUp.findMany({
    where: {
      status: 'pending',
      followUpAt: { lte: now },
    },
    include: {
      outfitCheck: {
        select: { thumbnailUrl: true, occasions: true },
      },
    },
    take: 100,
  });

  let sent = 0;
  for (const followUp of pending) {
    try {
      if (!(await canSendRelationshipNotification(followUp.userId))) continue;

      await createNotification({
        userId: followUp.userId,
        type: 'event_followup',
        title: `How did your ${followUp.occasion} go?`,
        body: 'How did the outfit land?',
        linkType: 'outfit',
        linkId: followUp.outfitCheckId,
      });

      await prisma.eventFollowUp.update({
        where: { id: followUp.id },
        data: { status: 'push_sent', pushSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      console.error(`[EventFollowUp] Failed to send follow-up ${followUp.id}:`, err);
    }
  }

  console.log(`[EventFollowUp] Sent ${sent} follow-up pushes`);
}

export async function runFollowUpEmailFallback(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) {
    console.log('[EventFollowUp] RESEND_API_KEY not set — skipping email fallback');
    return;
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const noResponse = await prisma.eventFollowUp.findMany({
    where: {
      status: 'push_sent',
      pushSentAt: { lte: twentyFourHoursAgo },
      response: null,
    },
    include: {
      user: { select: { email: true, name: true } },
    },
    take: 100,
  });

  const from = process.env.REPORT_FROM_EMAIL || 'hello@orthis.app';
  const baseUrl = process.env.API_BASE_URL || 'https://fitcheck-production-0f92.up.railway.app';
  let sent = 0;

  for (const followUp of noResponse) {
    try {
      const html = buildFollowUpEmail(
        followUp.user.name || 'there',
        followUp.occasion,
        followUp.id,
        baseUrl,
      );

      await resend.emails.send({
        from,
        to: followUp.user.email,
        subject: `How did your ${followUp.occasion} go?`,
        html,
      });

      await prisma.eventFollowUp.update({
        where: { id: followUp.id },
        data: { status: 'email_sent', emailSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      console.error(`[EventFollowUp] Email fallback failed for ${followUp.id}:`, err);
    }
  }

  console.log(`[EventFollowUp] Sent ${sent} follow-up emails`);
}

export async function recordFollowUpResponse(
  followUpId: string,
  userId: string,
  response: string,
): Promise<void> {
  const valid = ['crushed_it', 'felt_good', 'meh', 'not_great'];
  if (!valid.includes(response)) {
    throw new Error('Invalid response value');
  }

  const result = await prisma.eventFollowUp.updateMany({
    where: { id: followUpId, userId },
    data: {
      response,
      respondedAt: new Date(),
      status: 'completed',
    },
  });

  if (result.count === 0) {
    throw new AppError(404, 'Follow-up not found or unauthorized');
  }
}

/**
 * B2: Measure event follow-up response rates per occasion.
 * Publishes metrics to Intelligence Bus for ops-learning weekly critique.
 */
export async function measureFollowUpMetrics(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const followUps = await prisma.eventFollowUp.findMany({
    where: { followUpAt: { gte: thirtyDaysAgo } },
    select: { occasion: true, status: true, response: true },
  });

  if (followUps.length === 0) return;

  const byOccasion = new Map<string, { sent: number; responded: number; expired: number; positive: number }>();
  for (const fu of followUps) {
    if (!byOccasion.has(fu.occasion)) {
      byOccasion.set(fu.occasion, { sent: 0, responded: 0, expired: 0, positive: 0 });
    }
    const m = byOccasion.get(fu.occasion)!;
    m.sent++;
    if (fu.status === 'completed' && fu.response) {
      m.responded++;
      if (fu.response === 'crushed_it' || fu.response === 'felt_good') m.positive++;
    }
    if (fu.status === 'expired') m.expired++;
  }

  const metrics = [...byOccasion.entries()].map(([occasion, m]) => ({
    occasion,
    sent: m.sent,
    responseRate: m.sent > 0 ? m.responded / m.sent : 0,
    positiveRate: m.responded > 0 ? m.positive / m.responded : 0,
    silenceRate: m.sent > 0 ? m.expired / m.sent : 0,
  }));

  const worstOccasion = metrics
    .filter(m => m.sent >= 5)
    .sort((a, b) => a.responseRate - b.responseRate)[0] || null;

  await publishToIntelligenceBus('ops-learning', 'followup_metrics', {
    measuredAt: new Date().toISOString(),
    metrics,
    worstOccasion: worstOccasion?.occasion || null,
    worstResponseRate: worstOccasion?.responseRate || null,
  });

  console.log(`[EventFollowUp] Metrics published: ${followUps.length} follow-ups, ${metrics.length} occasions`);
}

function buildFollowUpEmail(
  name: string,
  occasion: string,
  followUpId: string,
  baseUrl: string,
): string {
  const responses = [
    { key: 'crushed_it', emoji: '🔥', label: 'Crushed it' },
    { key: 'felt_good', emoji: '😊', label: 'Felt good' },
    { key: 'meh', emoji: '😐', label: 'Meh' },
    { key: 'not_great', emoji: '😬', label: 'Not great' },
  ];

  const buttons = responses
    .map((r) => {
      const token = generateFollowUpToken(followUpId, r.key);
      const tokenParam = token ? `?token=${token}` : '';
      return `<a href="${baseUrl}/api/follow-up/${followUpId}/respond/${r.key}${tokenParam}" ` +
        `style="display:inline-block;margin:6px;padding:10px 20px;background:#FBF7F4;` +
        `border:2px solid #E85D4C;border-radius:0;text-decoration:none;` +
        `color:#E85D4C;font-weight:600;font-size:14px;">${r.emoji} ${r.label}</a>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#FBF7F4;padding:40px;margin:0;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#E85D4C;padding:20px 32px;">
      <span style="font-size:18px;font-weight:500;color:#fff;font-family:'DM Sans',Arial,sans-serif;">Or <em style="font-family:Georgia,serif;">This?</em></span>
    </div>
    <div style="padding:32px;text-align:center;">
      <h2 style="color:#1A1A1A;margin:0 0 12px;font-size:20px;font-weight:600;">How did your ${occasion} go?</h2>
      <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        ${name ? `${name}, how` : 'How'} did the outfit land?
      </p>
      <div style="margin:24px 0;">${buttons}</div>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
        Or This? · <a href="https://orthis.app" style="color:#E85D4C;text-decoration:none;">Open App</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Pre-Event Reminder (evening before event) ────────────────────────────────
// Runs every 30 minutes (same cadence as runEventFollowUp).
// Finds EventFollowUp records where the eventDate is TOMORROW and a
// pre-event push hasn't been sent yet — notifies user to prep their outfit.
// Field: we check eventDate !== null and reuse the EventFollowUp record's eventDate.

export async function runPreEventReminder(): Promise<void> {
  try {
    const now = new Date();

    // Tonight = between 6pm and 11pm UTC
    const currentHour = now.getUTCHours();
    if (currentHour < 18 || currentHour >= 23) return; // Only run in the 6-11pm window

    const tomorrowStart = new Date(now);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    tomorrowStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);

    // Find event follow-ups with eventDate = tomorrow, pre-reminder not sent
    const upcoming = await prisma.eventFollowUp.findMany({
      where: {
        eventDate: { gte: tomorrowStart, lt: tomorrowEnd },
        status: 'pending',
        // Use metadata JSON to track whether pre-event push was already sent
        // We store a flag in the pushSentAt + custom status after pre-event send
        pushSentAt: null, // haven't sent the morning-after push yet either
      },
      include: {
        outfitCheck: { select: { aiScore: true } },
      },
      take: 200,
    });

    let sent = 0;

    for (const followUp of upcoming) {
      try {
        if (!(await canSendRelationshipNotification(followUp.userId))) continue;

        const score = (followUp.outfitCheck as any)?.aiScore;
        const scoreText = score ? ` (scored ${score.toFixed(1)}/10)` : '';

        await createNotification({
          userId: followUp.userId,
          type: 'event_followup',
          title: `Your ${followUp.occasion} is tomorrow`,
          body: `Your outfit${scoreText} is locked in. Sleep easy — you're ready.`,
          linkType: 'outfit',
          linkId: followUp.outfitCheckId,
        });

        await prisma.eventFollowUp.update({
          where: { id: followUp.id },
          data: { pushSentAt: new Date() },
        });

        sent++;
      } catch (err) {
        // Per-user errors are non-fatal
      }
    }

    if (sent > 0) {
      console.log(`[PreEventReminder] Sent ${sent} pre-event reminders`);
    }
  } catch (err) {
    console.error('[PreEventReminder] runPreEventReminder failed:', err);
  }
}
