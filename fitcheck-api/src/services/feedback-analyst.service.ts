/**
 * Feedback Analyst Service
 *
 * Clusters open UserFeedback entries into themes using Gemini,
 * surfaces critical bugs to the founder, and marks items reviewed.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget } from './token-budget.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackTheme {
  theme: string;
  count: number;
  examples: string[];
}

interface AnalystResult {
  themes: FeedbackTheme[];
  criticalBugs: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildAnalystPrompt(feedbackTexts: string[]): string {
  const numbered = feedbackTexts.map((t, i) => `${i + 1}. ${t}`).join('\n');

  return `You are a product analyst for "Or This?" — an AI-powered outfit feedback app.

Analyse the following ${feedbackTexts.length} user feedback items and return a JSON object.

FEEDBACK ITEMS:
${numbered}

Return ONLY a JSON object with this exact shape (no markdown, no explanation):
{
  "themes": [
    { "theme": "short theme label", "count": <number of items matching>, "examples": ["item text 1", "item text 2"] }
  ],
  "criticalBugs": ["brief description of critical bug or crash if mentioned, else empty array"],
  "sentiment": "positive" | "neutral" | "negative"
}

Rules:
- Identify the top 3 themes only.
- criticalBugs should only contain actual bugs or crashes, not feature requests. If there are none, return [].
- Overall sentiment is based on the majority tone across all items.`;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runFeedbackAnalyst(): Promise<void> {
  console.log('[FeedbackAnalyst] Starting run...');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const items = await prisma.userFeedback.findMany({
    where: { status: 'open', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, text: true },
  });

  if (items.length < 5) {
    console.log(`[FeedbackAnalyst] Only ${items.length} open items — skipping (need >= 5)`);
    return;
  }

  const budgetOk = await hasLearningBudget(3);
  if (!budgetOk) {
    console.log('[FeedbackAnalyst] No learning budget — skipping');
    return;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { maxOutputTokens: 3000, temperature: 0.3 },
  });

  let result: AnalystResult | null = null;

  try {
    const response = await model.generateContent(buildAnalystPrompt(items.map(i => i.text)));
    const raw = response.response.text().trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object in Gemini response');

    result = JSON.parse(jsonMatch[0]) as AnalystResult;
  } catch (err) {
    console.error('[FeedbackAnalyst] Gemini call failed:', err);
    return;
  }

  // Mark items as reviewed
  const ids = items.map(i => i.id);
  try {
    await prisma.userFeedback.updateMany({
      where: { id: { in: ids } },
      data: { status: 'reviewed', sentiment: result.sentiment },
    });
  } catch (err) {
    console.error('[FeedbackAnalyst] Failed to mark items reviewed:', err);
  }

  // Publish to bus
  try {
    await publishToIntelligenceBus('feedback-analyst', 'product_feedback', {
      themes: result.themes,
      criticalBugsCount: result.criticalBugs.length,
      sentiment: result.sentiment,
      itemsAnalysed: items.length,
    });
  } catch (err) {
    console.error('[FeedbackAnalyst] Failed to publish to bus:', err);
  }

  // Email founder if critical bugs found
  if (result.criticalBugs.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    const recipient = process.env.REPORT_RECIPIENT_EMAIL;

    if (resendKey && recipient) {
      try {
        const resend = new Resend(resendKey);
        const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';
        const bugList = result.criticalBugs.map(b => `<li>${b}</li>`).join('');
        const themeList = result.themes
          .map(t => `<li><strong>${t.theme}</strong> (${t.count} mentions)</li>`)
          .join('');

        await resend.emails.send({
          from,
          to: recipient,
          subject: `Or This? — ${result.criticalBugs.length} Critical Bug(s) in User Feedback`,
          html: `<h2>Feedback Analyst Report</h2>
<p>Analysed <strong>${items.length}</strong> open feedback items. Overall sentiment: <strong>${result.sentiment}</strong>.</p>
<h3>Critical Bugs</h3>
<ul>${bugList}</ul>
<h3>Top Themes</h3>
<ul>${themeList}</ul>`,
        });

        console.log('[FeedbackAnalyst] Critical bug email sent to founder');
      } catch (err) {
        console.error('[FeedbackAnalyst] Failed to send critical bug email:', err);
      }
    }
  }

  console.log(
    `[FeedbackAnalyst] Done — ${items.length} items analysed, sentiment=${result.sentiment}, bugs=${result.criticalBugs.length}`,
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getFeedbackSummary(): Promise<{
  openCount: number;
  sentiment: string | null;
}> {
  const openCount = await prisma.userFeedback.count({ where: { status: 'open' } });

  // Most recent sentiment from a reviewed batch
  const latest = await prisma.userFeedback.findFirst({
    where: { status: 'reviewed', sentiment: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { sentiment: true },
  });

  return { openCount, sentiment: latest?.sentiment ?? null };
}
