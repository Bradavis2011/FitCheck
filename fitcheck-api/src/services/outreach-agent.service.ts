import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { executeOrQueue } from './agent-manager.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Outreach Target Definitions ─────────────────────────────────────────────

interface OutreachTarget {
  type: string;
  label: string;
  pitch: string;
}

const OUTREACH_TARGETS: OutreachTarget[] = [
  {
    type: 'fashion_blogger',
    label: 'Fashion Blogger',
    pitch: `Pitch them on covering Or This? for their audience who wants AI-powered style advice.
Angle: their readers can get instant, free AI outfit feedback from a personal AI stylist.
The subject line should be intriguing and personal — not a mass-pitch.
The email body should feel like a genuine personal message, mention their audience's interest in style/fashion, and include a clear CTA (try the app for free).`,
  },
  {
    type: 'micro_influencer',
    label: 'Micro-Influencer (10k-100k followers)',
    pitch: `Pitch micro-influencers on getting featured on the Or This? community feed.
Angle: they share an outfit in our app, get AI feedback, we feature them prominently on our community page and social media. Mutually beneficial — they get exposure, we get content.
Tone: excited, collegial, not transactional. Make them feel like they're joining something cool.`,
  },
  {
    type: 'press_tech',
    label: 'Tech / Lifestyle Press',
    pitch: `Pitch tech and lifestyle press on the AI fashion advisor app launch story.
Angle: democratizing personal styling with AI — what used to cost $500/hour is now free and instant.
Include a compelling hook about the problem being solved (decision fatigue around fashion, lack of honest feedback).
Mention key stats that would interest a journalist: saves time, builds confidence, community-driven.`,
  },
];

// ─── Draft Generation ─────────────────────────────────────────────────────────

interface OutreachDraft {
  type: string;
  subject: string;
  body: string;
}

async function generateOutreachDraft(target: OutreachTarget): Promise<OutreachDraft | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const prompt = `Write a cold outreach email for "Or This?", an AI-powered outfit feedback app.

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

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[OutreachAgent] Could not parse Gemini response for ${target.type}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
    if (!parsed.subject || !parsed.body) return null;

    return { type: target.type, subject: parsed.subject.slice(0, 100), body: parsed.body };
  } catch (err) {
    console.error(`[OutreachAgent] Gemini draft failed for ${target.type}:`, err);
    return null;
  }
}

// ─── Founder Review Email Builder ─────────────────────────────────────────────

function buildReviewEmail(draft: OutreachDraft, targetLabel: string): string {
  const escapedBody = draft.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

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
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Outreach Draft — ${targetLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#6B7280;font-size:13px;margin:0 0 24px;padding:12px 16px;background:#F5EDE7;border-radius:8px;line-height:1.5;">
              <strong>Review and send:</strong> This outreach email was drafted by your AI outreach agent. Copy the subject line and body below to send via your email client.
            </p>
            <div style="margin-bottom:20px;">
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Subject Line</div>
              <div style="background:#F5EDE7;border-radius:8px;padding:12px 16px;font-size:15px;font-weight:600;color:#1A1A1A;">${draft.subject}</div>
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Email Body</div>
              <div style="background:#F5EDE7;border-radius:8px;padding:16px;font-size:14px;color:#2D2D2D;line-height:1.7;">${escapedBody}</div>
            </div>
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

  for (const target of OUTREACH_TARGETS) {
    try {
      const draft = await generateOutreachDraft(target);
      if (!draft) {
        console.log(`[OutreachAgent] Skipping ${target.type} — draft generation failed`);
        continue;
      }

      const htmlBody = buildReviewEmail(draft, target.label);
      const contentToCheck = `${draft.subject}\n${draft.body}`;

      await executeOrQueue(
        'outreach-agent',
        'outreach_draft',
        'high',
        { type: target.type, label: target.label, subject: draft.subject, body: draft.body } as unknown as Record<string, unknown>,
        async (payload) => {
          const p = payload as { type: string; label: string; subject: string; body: string };
          const html = buildReviewEmail({ type: p.type, subject: p.subject, body: p.body }, p.label);

          await resend.emails.send({
            from: fromEmail,
            to: recipient,
            subject: `Or This? Outreach Draft: ${p.label} — "${p.subject}"`,
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
