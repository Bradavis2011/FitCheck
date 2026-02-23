import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';
import { AppError } from '../middleware/errorHandler.js';

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
        body: 'Tap to let us know how it went!',
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
        subject: `How did your ${followUp.occasion} go? 👗`,
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
    .map(
      (r) =>
        `<a href="${baseUrl}/api/follow-up/${followUpId}/respond/${r.key}" ` +
        `style="display:inline-block;margin:8px;padding:12px 24px;background:#FBF7F4;` +
        `border:2px solid #E85D4C;border-radius:50px;text-decoration:none;` +
        `color:#E85D4C;font-weight:600;font-size:15px;">${r.emoji} ${r.label}</a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;margin:0;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">👗</div>
    <h2 style="color:#E85D4C;margin-top:0;font-size:22px;">How did your ${occasion} go?</h2>
    <p style="color:#2D2D2D;font-size:15px;line-height:1.6;">
      Hey ${name}! We noticed you had a <strong>${occasion}</strong>. How did the outfit land?
    </p>
    <div style="margin:24px 0;">${buttons}</div>
    <p style="color:#6B7280;font-size:12px;margin-top:24px;">
      Or This? · <a href="https://orthis.app" style="color:#E85D4C;">Open App</a>
    </p>
  </div>
</body>
</html>`;
}
