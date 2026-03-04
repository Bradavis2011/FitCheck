import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { executeOrQueue, registerExecutor } from './agent-manager.service.js';
import { getTrendData } from './content-calendar.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Outreach Target Definitions ─────────────────────────────────────────────

interface OutreachTarget {
  type: string;
  label: string;
  pitch: string;
  searchInstructions: string;
}

function generateOutreachTargets(trendStyles: string[], trendOccasions: string[]): OutreachTarget[] {
  const styleList = trendStyles.slice(0, 3).join(', ') || 'casual, minimalist, classic';
  const occasionList = trendOccasions.slice(0, 3).join(', ') || 'work, date night, weekend';
  return [
    {
      type: 'nano_creator',
      label: 'TikTok/IG Nano-Creator (1K-10K)',
      pitch: `Write a TikTok/IG DM to a creator who posts outfit check or "this or that" content with 1K-10K followers.

Context about the app:
- Or This? gives a score out of 10 + honest style feedback for any outfit photo
- Currently TestFlight only (invite-only iOS beta)
- The creator's audience gets to vote, then the creator films the AI score reveal — that's the content format

What you're offering:
1. A new content format their audience will engage with (AI score reveal)
2. First access to something nobody else has yet
3. "Founding Creator" status when the app publicly launches

Current trending styles in the app: ${styleList}
Popular occasions users ask about: ${occasionList}

Rules:
- Casual, peer-to-peer tone. Not corporate.
- Do NOT make up a specific video they posted. Instead reference their CONTENT TYPE (e.g. "saw your fit checks")
- Under 80 words
- No "collab" or "partnership" language
- End with: "want early access? i can add you to testflight today"
- No subject line. No emojis. No sign-off.`,
      searchInstructions: `WHERE TO FIND THEM:\n• TikTok search: #outfitcheck, #ratemyoutfit, #thisorthat, #fitcheck — sort by "most recent"\n• Look for creators posting at least 2x/week about outfit choices, 1K-10K followers\n• IG Reels: same hashtags, filter by under 10K followers\n• DO NOT message anyone over 50K — they get too many DMs`,
    },
    {
      type: 'fashion_blogger',
      label: 'Fashion Blogger / Newsletter',
      pitch: `Write a cold email pitching Or This? to a fashion blogger or newsletter writer whose audience cares about personal style, getting dressed, and looking their best.

Context:
- Or This? gives instant AI outfit feedback — score + specific tips — from a photo on your phone
- Free to use (3 outfit checks/day free tier)
- Best angle for their audience: "your readers never have to wonder if the outfit works again"
- Trending styles users are getting rated: ${styleList}

Requirements:
- Subject line: personal, curious, under 60 chars — NOT "I'd love to collaborate"
- Body: 3-4 tight paragraphs, genuine voice
- Lead with the problem their audience has (outfit doubt, decision fatigue), not with what the app does
- Soft CTA: try it free, worth writing about
- Sign off as: The Or This? Team
- No buzzwords (synergy, leverage, disruptive, game-changing)`,
      searchInstructions: `WHERE TO FIND THEM:\n• Substack: search "fashion", "style", "outfit" — filter newsletters with 1K-10K subscribers\n• Google: "fashion newsletter" + site:substack.com, site:beehiiv.com\n• Bloggers: search "personal style blog" + city name, or "[style archetype] fashion blog"\n• Instagram: bio says "fashion blogger" or "style tips" with link to website`,
    },
    {
      type: 'micro_influencer',
      label: 'Micro-Influencer (10K-100K followers)',
      pitch: `Write a cold email to a fashion/lifestyle micro-influencer (10K-100K followers) pitching being featured on the Or This? community feed.

Context:
- Or This? has a community feed where public outfits get highlighted
- The pitch: they post an outfit in the app → get an AI score + feedback → we feature their look + profile in the community highlight
- Trending styles being featured: ${styleList}
- Occasions people dress for: ${occasionList}

What they get:
- Featured on our community feed (exposure to our growing user base)
- A score card they can share on their own social media
- Early access to the app while it's invite-only

Tone: excited, collegial. They're joining something, not being sold to.
No transactional language. Subject line should feel like it came from a real person, not a marketing team.`,
      searchInstructions: `WHERE TO FIND THEM:\n• TikTok/IG: #${trendStyles[0] || 'minimalist'}fashion, #${trendStyles[1] || 'ootd'}, #styleinspo — filter 10K-100K followers\n• Look for people who post outfit-of-the-day content regularly (at least weekly)\n• Avoid mega-niche accounts (only post about one brand, etc.) — want lifestyle/style mix\n• Check if their engagement rate is decent (likes + comments / followers > 2%)`,
    },
    {
      type: 'press_tech',
      label: 'Tech / Lifestyle Press',
      pitch: `Write a press pitch email for Or This? targeting tech, lifestyle, or women's interest publications.

Context:
- Or This? is an AI outfit feedback app: take a photo, get a score out of 10 + honest styling advice in under 10 seconds
- Currently in iOS TestFlight (beta), pending App Store review
- The human angle: most people have outfit decision fatigue — they change 3 times and still aren't sure. This app gives the honest feedback a friend won't give you.
- Trending styles users are getting rated: ${styleList}

Angle: not "new AI app" — that's noise. The angle is: the gap between what we own and what we feel confident in.
Journalists want: a problem, a person it affects, a surprising solution.

Requirements:
- Subject: story-first, under 60 chars — pitch the angle, not the app
- Lead with the problem / relatable moment, not the technology
- One paragraph on what the app actually does
- Soft hook for a "try it" call — TestFlight available for review
- Sign off as: The Or This? Team`,
      searchInstructions: `WHERE TO FIND THEM:\n• Refinery29, Who What Wear, The Zoe Report, InStyle, Glamour — look for staff writers covering "fashion tech" or "AI style"\n• TechCrunch, The Verge, Fast Company — search "AI fashion" + author name\n• Google: "write for us" + "fashion tech" or "AI lifestyle"\n• Twitter/X: search "fashion tech journalist" or check bylines on articles about AI apps`,
    },
  ];
}

// ─── Draft Generation ─────────────────────────────────────────────────────────

const DM_TARGET_TYPES = new Set(['nano_creator']);

interface OutreachDraft {
  type: string;
  subject: string;
  body: string;
  isDm?: boolean;
}

async function generateOutreachDraft(target: OutreachTarget): Promise<OutreachDraft | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const isDm = DM_TARGET_TYPES.has(target.type);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    let prompt: string;
    if (isDm) {
      prompt = `Write a TikTok/Instagram DM for "Or This?", an AI-powered outfit feedback app (TestFlight only).

App: Or This? gives users instant AI outfit feedback with a confidence score and specific styling tips. Currently invite-only on TestFlight.

Target: ${target.label}
Pitch guidance: ${target.pitch}

Return JSON only (no markdown):
{"body": "string (under 80 words, use \\n for line breaks, casual DM style, no subject line)"}`;
    } else {
      prompt = `Write a cold outreach email for "Or This?", an AI-powered outfit feedback app.

App description: Or This? gives users instant AI outfit feedback with a confidence score and specific styling tips. Like having a personal stylist in your pocket. Free to use.

Target: ${target.label}
Pitch guidance: ${target.pitch}

Requirements:
- Authentic, personal tone — not a template
- Subject line: intriguing, under 60 chars, no generic phrases like "collaboration opportunity"
- Body: 3-4 short paragraphs, ends with a soft CTA, no hard sell
- No buzzwords (synergy, leverage, disruptive, etc.)
- Sign off as: "The Or This? Team"

Return JSON only (no markdown):
{"subject": "string", "body": "string (use \\n for line breaks)"}`;
    }

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[OutreachAgent] Could not parse Gemini response for ${target.type}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
    if (!parsed.body) return null;

    return {
      type: target.type,
      subject: isDm ? '' : (parsed.subject?.slice(0, 100) || ''),
      body: parsed.body,
      isDm,
    };
  } catch (err) {
    console.error(`[OutreachAgent] Gemini draft failed for ${target.type}:`, err);
    return null;
  }
}

// ─── Founder Review Email Builder ─────────────────────────────────────────────

function buildReviewEmail(draft: OutreachDraft, targetLabel: string, searchInstructions?: string): string {
  const escapedBody = draft.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const isDm = draft.isDm === true;

  const subjectSection = isDm ? '' : `
            <div style="margin-bottom:20px;">
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Subject Line</div>
              <div style="background:#F5EDE7;border-radius:8px;padding:12px 16px;font-size:15px;font-weight:600;color:#1A1A1A;">${draft.subject}</div>
            </div>`;

  const instructions = isDm
    ? '<strong>DM Template — copy/paste to TikTok/IG:</strong> Find a creator using the search instructions below → tap Message → paste this text. Add their name and mention one specific video before sending.'
    : '<strong>Review and send:</strong> Use the search instructions below to find a specific target, personalise the first line with something specific about them, then send.';

  const bodyLabel = isDm ? 'DM Text (copy/paste)' : 'Email Body';

  const searchSection = searchInstructions
    ? `<div style="margin-top:24px;padding:16px;background:#F0F9FF;border-radius:8px;border-left:3px solid #3B82F6;">
        <div style="font-size:12px;font-weight:600;color:#3B82F6;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">How to Find Your Target</div>
        <div style="font-size:13px;color:#1A1A1A;line-height:1.7;white-space:pre-line;">${searchInstructions.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:28px 40px;text-align:center;">
            <div style="font-size:26px;font-weight:700;color:#fff;">Or This?</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">${isDm ? 'DM Template' : 'Outreach Draft'} — ${targetLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#6B7280;font-size:13px;margin:0 0 24px;padding:12px 16px;background:#F5EDE7;border-radius:8px;line-height:1.5;">
              ${instructions}
            </p>
            ${subjectSection}
            <div>
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${bodyLabel}</div>
              <div style="background:#F5EDE7;border-radius:8px;padding:16px;font-size:14px;color:#2D2D2D;line-height:1.7;">${escapedBody}</div>
            </div>
            ${searchSection}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;">
            <p style="color:#6B7280;font-size:12px;margin:0;">Or This? · Outreach Agent · ${new Date().toISOString()}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runOutreachAgent(): Promise<void> {
  console.log('[OutreachAgent] Weekly run starting...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[OutreachAgent] GEMINI_API_KEY not set — skipping');
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.log('[OutreachAgent] RESEND_API_KEY not set — skipping');
    return;
  }
  if (!process.env.REPORT_RECIPIENT_EMAIL) {
    console.log('[OutreachAgent] REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  const fromEmail = process.env.REPORT_FROM_EMAIL || 'reports@orthis.app';
  let drafted = 0;

  const trendData = await getTrendData();
  const outreachTargets = generateOutreachTargets(trendData.topStyles, trendData.popularOccasions);

  for (const target of outreachTargets) {
    try {
      const draft = await generateOutreachDraft(target);
      if (!draft) {
        console.log(`[OutreachAgent] Skipping ${target.type} — draft generation failed`);
        continue;
      }

      const contentToCheck = `${draft.subject}\n${draft.body}`;

      await executeOrQueue(
        'outreach-agent',
        'outreach_draft',
        'high',
        { type: target.type, label: target.label, subject: draft.subject, body: draft.body, isDm: draft.isDm ?? false, searchInstructions: target.searchInstructions } as unknown as Record<string, unknown>,
        async (payload) => {
          const p = payload as { type: string; label: string; subject: string; body: string; isDm?: boolean; searchInstructions?: string };
          const html = buildReviewEmail({ type: p.type, subject: p.subject, body: p.body, isDm: p.isDm }, p.label, p.searchInstructions);
          const emailSubject = p.isDm
            ? `Or This? DM Template: ${p.label}`
            : `Or This? Outreach Draft: ${p.label} — "${p.subject}"`;

          await resend.emails.send({
            from: fromEmail,
            to: recipient,
            subject: emailSubject,
            html,
          });

          return { type: p.type, sent: true, preview: p.body.slice(0, 100) };
        },
        contentToCheck,
      );

      drafted++;
    } catch (err) {
      console.error(`[OutreachAgent] Failed to process ${target.type}:`, err);
    }
  }

  console.log(`[OutreachAgent] Done — ${drafted} outreach draft(s) queued for approval`);
}

/** Register executors at startup so processApprovedActions works after a server restart. */
export function registerExecutors(): void {
  // Also called at module load time below
  registerExecutor('outreach-agent', 'outreach_draft', async (payload) => {
    const p = payload as { type: string; label: string; subject: string; body: string; isDm?: boolean; searchInstructions?: string };
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (!resend) {
      console.warn('[OutreachAgent] RESEND_API_KEY not set — cannot send outreach email');
      return { sent: false, note: 'resend_not_configured' };
    }
    const recipient = process.env.REPORT_RECIPIENT_EMAIL;
    const fromEmail = process.env.REPORT_FROM_EMAIL || 'reports@orthis.app';
    if (!recipient) {
      return { sent: false, note: 'no_recipient' };
    }
    const html = buildReviewEmail({ type: p.type, subject: p.subject, body: p.body, isDm: p.isDm }, p.label, p.searchInstructions);
    const emailSubject = p.isDm
      ? `Or This? DM Template: ${p.label}`
      : `Or This? Outreach Draft: ${p.label} — "${p.subject}"`;
    await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject: emailSubject,
      html,
    });
    return { type: p.type, sent: true, preview: p.body.slice(0, 100) };
  });
}

// Auto-register at module load time
registerExecutors();
