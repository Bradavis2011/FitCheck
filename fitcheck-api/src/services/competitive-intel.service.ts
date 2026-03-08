/**
 * Competitive Intelligence Service
 *
 * Generates a weekly competitive analysis for Or This? vs key fashion app
 * competitors. Uses ASO snapshot data from the database where available,
 * falls back to hardcoded context. Gemini synthesises the intelligence
 * and emails a summary to the founder.
 *
 * Runs weekly (no external scraping; cost: ~1 Gemini call/week).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget } from './token-budget.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPETITORS = ['Stylebook', 'Combyne', 'Smart Closet', 'Cladwell'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a text summary of recent AsoSnapshot rows for a given app title */
async function buildAsoContextForCompetitor(title: string): Promise<string> {
  // AsoSnapshot tracks keywords, not app names — use title as a search hint
  const snapshots = await prisma.asoSnapshot.findMany({
    where: {
      keyword: { contains: title, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (snapshots.length === 0) {
    return `${title}: no keyword data available`;
  }

  const lines = snapshots.map(s =>
    `  - keyword="${s.keyword}" store=${s.store} difficulty=${s.difficulty?.toFixed(1) ?? 'n/a'} traffic=${s.traffic?.toFixed(1) ?? 'n/a'} rank=${s.currentRank ?? 'unranked'}`
  );

  return `${title}:\n${lines.join('\n')}`;
}

/** Build text context for Or This? using its own latest snapshots */
async function buildOrThisContext(): Promise<string> {
  const snapshots = await prisma.asoSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 18,
    distinct: ['keyword', 'store'],
  });

  if (snapshots.length === 0) {
    return 'Or This?: no ASO snapshot data yet — AI outfit feedback app, 0px editorial design, free tier 3 checks/day, paid unlimited';
  }

  const top = snapshots
    .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))
    .slice(0, 6)
    .map(s => `  - keyword="${s.keyword}" traffic=${s.traffic?.toFixed(1) ?? 'n/a'} rank=${s.currentRank ?? 'unranked'}`)
    .join('\n');

  return `Or This? (AI outfit feedback):\n${top}`;
}

// ─── Core Runner ──────────────────────────────────────────────────────────────

export async function runCompetitiveIntel(): Promise<void> {
  console.log('[CompetitiveIntel] Starting weekly competitive intelligence run...');

  // ── Budget gate (priority 4) ──
  const hasBudget = await hasLearningBudget(4);
  if (!hasBudget) {
    console.log('[CompetitiveIntel] Insufficient learning budget (priority 4) — skipping');
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log('[CompetitiveIntel] GEMINI_API_KEY not set — skipping');
    return;
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  // ── Gather context ──
  const [orThisContext, ...competitorContexts] = await Promise.all([
    buildOrThisContext(),
    ...COMPETITORS.map(c => buildAsoContextForCompetitor(c)),
  ]);

  const competitorBlock = COMPETITORS
    .map((_name, i) => competitorContexts[i])
    .join('\n\n');

  const prompt = `You are a mobile app market analyst. Given the following app store metrics, provide competitive intelligence for Or This? — an AI-powered outfit feedback app.

OR THIS? APP STORE DATA:
${orThisContext}

COMPETITOR KEYWORD DATA (from App Store):
${competitorBlock}

TASK: Provide competitive intelligence focused on:
1. Keyword gaps Or This? should target
2. Feature differentiation opportunities vs each competitor
3. Positioning recommendations

Keep response under 200 words. Be specific and actionable.`;

  let analysis = '';

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    analysis = result.response.text().trim();
    console.log('[CompetitiveIntel] Gemini analysis generated');
  } catch (err) {
    console.error('[CompetitiveIntel] Gemini call failed:', err);
    analysis = 'Unable to generate analysis — Gemini call failed.';
  }

  const payload = {
    competitors: COMPETITORS,
    analysis,
    generatedAt: new Date().toISOString(),
  };

  // ── Publish to bus ──
  try {
    await publishToIntelligenceBus(
      'competitive-intel',
      'competitive_intel',
      payload as unknown as Record<string, unknown>
    );
    console.log('[CompetitiveIntel] Published competitive_intel to bus');
  } catch (err) {
    console.error('[CompetitiveIntel] Failed to publish to bus:', err);
  }

  // ── Email founder ──
  if (resend && recipient) {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:28px 40px;text-align:center;">
      <div style="font-size:26px;font-weight:700;color:#fff;">Or This?</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Weekly Competitive Intelligence</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;">${dateStr}</div>
    </div>
    <div style="padding:32px 40px;">
      <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Competitors Tracked</div>
      <div style="background:#FBF7F4;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#2D2D2D;">
        ${COMPETITORS.join(' · ')}
      </div>
      <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">AI Analysis</div>
      <div style="font-size:14px;color:#1A1A1A;line-height:1.7;white-space:pre-wrap;">${analysis}</div>
    </div>
    <div style="background:#F5EDE7;padding:16px 40px;text-align:center;">
      <p style="color:#6B7280;font-size:12px;margin:0;">Or This? · Competitive Intelligence Agent · ${new Date().toISOString()}</p>
    </div>
  </div>
</body></html>`;

    try {
      await resend.emails.send({
        from: process.env.REPORT_FROM_EMAIL || 'intel@orthis.app',
        to: recipient,
        subject: `Or This? Competitive Intelligence — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        html,
      });
      console.log('[CompetitiveIntel] Founder email sent');
    } catch (err) {
      console.error('[CompetitiveIntel] Failed to send founder email:', err);
    }
  }

  console.log('[CompetitiveIntel] Done');
}
