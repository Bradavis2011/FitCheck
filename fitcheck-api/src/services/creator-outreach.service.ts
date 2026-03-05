/**
 * Creator Outreach — Autonomous email sending to email-track prospects
 *
 * Cron: Daily 1pm UTC (outreach) + 2pm UTC (follow-up)
 * Sends personalized emails to creators where we found their business email.
 * Auto-generates follow-ups at day 3 and day 7.
 * Declines non-responders after day 10.
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const DAILY_EMAIL_LIMIT = 30;
const FROM_EMAIL = process.env.CREATOR_FROM_EMAIL || 'brandon@orthis.app';
const FROM_NAME = 'Brandon from Or This?';
const APP_STORE_URL = 'https://apps.apple.com/app/id6759472490';
// ─── Gemini Helper ────────────────────────────────────────────────────────────

async function getGemini() {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('[CreatorOutreach] GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

// ─── Follow-up Email Generation ───────────────────────────────────────────────

async function generateFollowUpEmail(
  genAI: any,
  prospect: { handle: string; platform: string; niche?: string | null; emailBody?: string | null },
  followUpNumber: 1 | 2,
): Promise<{ subject: string; body: string }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const angle = followUpNumber === 1
    ? 'A different angle — mention a specific use case or result. Still enthusiastic but shorter.'
    : 'Final nudge — super short, warm, "no worries if not the right time" vibe. 2-3 sentences max.';

  const prompt = `Write a follow-up email for a creator we previously contacted about Or This? AI outfit app.

Creator: @${prospect.handle} on ${prospect.platform}
Niche: ${prospect.niche || 'fashion'}
Follow-up number: ${followUpNumber}
Original pitch: ${prospect.emailBody?.slice(0, 100) || 'AI outfit scoring app, free premium access'}

Follow-up angle: ${angle}

Rules:
- Subject: short, casual, different from original
- Body: under 60 words for #1, under 30 words for #2
- Don't be pushy
- For #2: explicitly say "totally fine if not interested, just wanted to follow up"
- Sound human, not automated

Return ONLY JSON: {"subject": "...", "body": "..."}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return {
      subject: followUpNumber === 1 ? 'Quick question' : 'Last one, I promise',
      body: followUpNumber === 1
        ? `Hey! Just wanted to circle back. Or This? has been getting some really interesting reactions when creators score their outfits live on camera. Totally understand if it's not your thing — just thought it might make fun content. Happy to set up free premium access if you want to try it: ${APP_STORE_URL}`
        : `Hey, totally fine if now isn't the right time! Just wanted to give it one more shot. If you ever want to try the AI outfit scorer, I'm here. — Brandon`,
    };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      subject: followUpNumber === 1 ? 'Quick thought for you' : 'All good if not!',
      body: followUpNumber === 1
        ? `Wanted to share one more thing about Or This? — creators are filming their AI outfit score reactions and they're doing really well. Free premium access is still on the table. Would love to help you try it: ${APP_STORE_URL}`
        : `Hey, no worries at all if this isn't for you! Just wanted to follow up one last time. — Brandon from Or This?`,
    };
  }
}

// ─── Creator Kit Generation (on response) ─────────────────────────────────────

async function generateCreatorKit(
  genAI: any,
  prospect: { handle: string; platform: string; niche?: string | null },
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const prompt = `Write a "Creator Kit" welcome email for a fashion creator who responded to our pitch for Or This? AI outfit app.

Creator: @${prospect.handle} on ${prospect.platform}, niche: ${prospect.niche || 'fashion'}

Include:
1. Warm welcome + congrats on joining
2. How to get premium access (say "reply to this email and I'll manually upgrade your account within 24h")
3. 3 content ideas specific to their niche (TikTok/Instagram format)
   - Each idea: hook line + what to film + why audiences love it
   - Center around "filming my reaction to the AI outfit score" concept
4. Best hashtags for their niche
5. Note: "The reveal moment when the score appears is the best part — lean into that!"

Tone: excited, like you're personally onboarding them. Under 250 words.
Return plain text email body (no subject needed).`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return `Hey! So excited you're in 🎉

Reply to this email and I'll manually upgrade your Or This? account to premium within 24 hours.

**3 content ideas for your feed:**
1. "Rating all my outfits with AI" — film your reactions to each score. The reveal moment is GOLD.
2. "AI gave my best look a ${Math.floor(Math.random() * 3) + 7}/10" — hook with the score in the caption.
3. "Asking AI to rate my worst outfit" — comedic twist, great engagement.

**Hashtags:** #outfitcheck #ootd #fashionai #outfitrating #stylecheck

The moment the score appears on screen is the best part — lean into that reaction! Can't wait to see what you create.

— Brandon from Or This?
Download: ${APP_STORE_URL}`;
  }
}

// ─── Send Outreach Emails ─────────────────────────────────────────────────────

export async function runEmailOutreach(): Promise<void> {
  console.log('[CreatorOutreach] Running email outreach...');

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) {
    console.log('[CreatorOutreach] RESEND_API_KEY not set — skipping');
    return;
  }

  const prospects = await prisma.creatorProspect.findMany({
    where: {
      outreachMethod: 'email',
      status: 'dm_ready',
      email: { not: null },
      emailBody: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: DAILY_EMAIL_LIMIT,
  });

  if (prospects.length === 0) {
    console.log('[CreatorOutreach] No email-track prospects to contact');
    return;
  }

  let sent = 0;

  for (const prospect of prospects) {
    if (!prospect.email || !prospect.emailBody) continue;

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: prospect.email,
        subject: prospect.emailSubject || 'Quick idea for your content',
        html: buildOutreachEmailHtml(prospect.emailBody, prospect.handle),
        replyTo: FROM_EMAIL,
        tags: [
          { name: 'prospect_id', value: prospect.id },
          { name: 'email_type', value: 'creator_outreach' },
        ],
      });

      await prisma.creatorProspect.update({
        where: { id: prospect.id },
        data: { status: 'contacted', contactedAt: new Date() },
      });

      sent++;
      console.log(`[CreatorOutreach] Sent to @${prospect.handle} (${prospect.email})`);

      // Rate limiting: 2s between sends
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CreatorOutreach] Failed to send to @${prospect.handle}:`, err);
    }
  }

  console.log(`[CreatorOutreach] Sent ${sent} outreach emails`);

  await publishToIntelligenceBus('creator-outreach', 'creator_outreach_metrics', {
    runAt: new Date().toISOString(),
    type: 'outreach',
    sent,
  });
}

// ─── Send Follow-up Emails ────────────────────────────────────────────────────

export async function runEmailFollowUp(): Promise<void> {
  console.log('[CreatorOutreach] Running email follow-up...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[CreatorOutreach] GEMINI_API_KEY not set — skipping follow-up generation');
    return;
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) {
    console.log('[CreatorOutreach] RESEND_API_KEY not set — skipping');
    return;
  }

  const genAI = await getGemini();
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Decline non-responders after 10 days
  const toDecline = await prisma.creatorProspect.findMany({
    where: {
      outreachMethod: 'email',
      status: { in: ['contacted', 'followed_up'] },
      contactedAt: { lte: tenDaysAgo },
    },
    take: 100,
  });

  for (const p of toDecline) {
    await prisma.creatorProspect.update({
      where: { id: p.id },
      data: { status: 'declined' },
    });
  }

  if (toDecline.length > 0) {
    console.log(`[CreatorOutreach] Declined ${toDecline.length} non-responsive prospects`);
  }

  // First follow-up: contacted 3 days ago, no follow-up yet
  const needsFirstFollowUp = await prisma.creatorProspect.findMany({
    where: {
      outreachMethod: 'email',
      status: 'contacted',
      email: { not: null },
      contactedAt: { lte: threeDaysAgo },
      followUpEmailBody: null, // hasn't been followed up yet
    },
    take: 20,
  });

  let followUpSent = 0;

  for (const prospect of needsFirstFollowUp) {
    if (!prospect.email) continue;

    try {
      const { subject, body } = await generateFollowUpEmail(genAI, prospect, 1);

      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: prospect.email,
        subject,
        html: buildOutreachEmailHtml(body, prospect.handle),
        replyTo: FROM_EMAIL,
        tags: [
          { name: 'prospect_id', value: prospect.id },
          { name: 'email_type', value: 'creator_followup_1' },
        ],
      });

      await prisma.creatorProspect.update({
        where: { id: prospect.id },
        data: {
          status: 'followed_up',
          followedUpAt: new Date(),
          followUpEmailBody: body,
        },
      });

      followUpSent++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CreatorOutreach] First follow-up failed for @${prospect.handle}:`, err);
    }
  }

  // Second follow-up: followed_up 7 days ago (7 days since first contact)
  const needsSecondFollowUp = await prisma.creatorProspect.findMany({
    where: {
      outreachMethod: 'email',
      status: 'followed_up',
      email: { not: null },
      followedUpAt: { lte: sevenDaysAgo },
    },
    take: 20,
  });

  for (const prospect of needsSecondFollowUp) {
    if (!prospect.email) continue;

    try {
      const { subject, body } = await generateFollowUpEmail(genAI, prospect, 2);

      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: prospect.email,
        subject,
        html: buildOutreachEmailHtml(body, prospect.handle),
        replyTo: FROM_EMAIL,
        tags: [
          { name: 'prospect_id', value: prospect.id },
          { name: 'email_type', value: 'creator_followup_2' },
        ],
      });

      await prisma.creatorProspect.update({
        where: { id: prospect.id },
        data: { status: 'followed_up', followedUpAt: new Date() },
      });

      followUpSent++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CreatorOutreach] Second follow-up failed for @${prospect.handle}:`, err);
    }
  }

  console.log(`[CreatorOutreach] Sent ${followUpSent} follow-up emails`);

  await publishToIntelligenceBus('creator-outreach', 'creator_outreach_metrics', {
    runAt: new Date().toISOString(),
    type: 'follow_up',
    sent: followUpSent,
    declined: toDecline.length,
  });
}

// ─── Handle Creator Response ──────────────────────────────────────────────────

export async function handleCreatorResponse(prospectId: string): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  const prospect = await prisma.creatorProspect.findUnique({ where: { id: prospectId } });
  if (!prospect || prospect.status === 'responded') return;

  await prisma.creatorProspect.update({
    where: { id: prospectId },
    data: { status: 'responded', respondedAt: new Date() },
  });

  if (!prospect.email) return;

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return;

  try {
    const genAI = await getGemini();
    const kitBody = await generateCreatorKit(genAI, prospect);

    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: prospect.email,
      subject: `Welcome to Or This? — Your creator kit is here 🎉`,
      html: buildOutreachEmailHtml(kitBody, prospect.handle),
      replyTo: FROM_EMAIL,
    });

    await prisma.creatorProspect.update({
      where: { id: prospectId },
      data: { status: 'onboarded' },
    });

    console.log(`[CreatorOutreach] Sent creator kit to @${prospect.handle}`);
  } catch (err) {
    console.error(`[CreatorOutreach] Failed to send creator kit to @${prospect.handle}:`, err);
  }
}

// ─── Email HTML Builder ────────────────────────────────────────────────────────

function buildOutreachEmailHtml(bodyText: string, _handle: string): string {
  // Convert plain text to basic HTML paragraphs
  const htmlBody = bodyText
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:28px 36px;">
            ${htmlBody}
            <p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:20px 0 0;">
              <a href="${APP_STORE_URL}" style="color:#E85D4C;font-weight:600;text-decoration:none;">
                Download Or This? on the App Store →
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 24px;border-top:1px solid #F5EDE7;">
            <p style="color:#9CA3AF;font-size:11px;margin:0;line-height:1.5;">
              Or This? · AI Outfit Scoring App ·
              <a href="https://orthis.app" style="color:#9CA3AF;">orthis.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Handle Resend Webhook Updates ────────────────────────────────────────────

export async function handleCreatorEmailWebhook(
  eventType: string,
  tags: Array<{ name: string; value: string }>,
): Promise<void> {
  const prospectTag = tags.find(t => t.name === 'prospect_id');
  if (!prospectTag) return;

  const prospectId = prospectTag.value;

  try {
    if (eventType === 'email.opened') {
      await prisma.creatorProspect.updateMany({
        where: { id: prospectId, emailOpenedAt: null },
        data: { emailOpenedAt: new Date() },
      });
    } else if (eventType === 'email.clicked') {
      await prisma.creatorProspect.updateMany({
        where: { id: prospectId, emailClickedAt: null },
        data: { emailClickedAt: new Date() },
      });
    }
  } catch (err) {
    console.warn('[CreatorOutreach] Webhook update failed:', err);
  }
}

// ─── Mark Prospect as Contacted (email action link) ──────────────────────────

export async function markProspectContacted(prospectId: string): Promise<boolean> {
  try {
    await prisma.creatorProspect.updateMany({
      where: { id: prospectId, status: 'dm_ready' },
      data: { status: 'contacted', contactedAt: new Date() },
    });
    return true;
  } catch { return false; }
}

export async function markProspectResponded(prospectId: string): Promise<boolean> {
  try {
    await prisma.creatorProspect.updateMany({
      where: { id: prospectId, status: { in: ['contacted', 'followed_up', 'dm_ready'] } },
      data: { status: 'responded', respondedAt: new Date() },
    });
    return true;
  } catch { return false; }
}
