import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus, getLatestBusEntry } from './intelligence-bus.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface BrandGuardResult {
  approved: boolean;
  issues: string[];
  revised?: string;
}

// In-memory cache: hash → { result, expiresAt }
const cache = new Map<string, { result: BrandGuardResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Sweep expired entries every 30 minutes to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}, 30 * 60 * 1000).unref();

function cacheKey(text: string): string {
  // Cheap fingerprint: first 120 chars + length (good enough for dedup)
  return `${text.slice(0, 120)}|${text.length}`;
}

// B3: In-memory calibration note — appended to the brand guard prompt when drift is detected
let calibrationNote = '';

/**
 * B3: Read brand_guard_metrics from bus to detect over/under-flagging drift.
 * When approval rate > 95% for most agents = too lenient → tighten note.
 * When rejection rate > 50% for most agents = too strict → loosen note.
 * Updates the module-level calibrationNote injected into checkContent().
 * Called from publishBrandGuardMetrics() after each monthly measurement.
 */
export async function calibrateBrandGuard(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  try {
    const entry = await getLatestBusEntry('brand_guard_metrics');
    if (!entry) return;

    const payload = entry.payload as Record<string, unknown>;
    const overFlagging = Array.isArray(payload.overFlagging) ? payload.overFlagging as string[] : [];
    const underFlagging = Array.isArray(payload.underFlagging) ? payload.underFlagging as string[] : [];

    if (overFlagging.length === 0 && underFlagging.length === 0) {
      calibrationNote = '';
      return;
    }

    const driftDesc = [
      overFlagging.length > 0 ? `These agents have approval rates >95% (may be too lenient): ${overFlagging.slice(0, 3).join(', ')}` : '',
      underFlagging.length > 0 ? `These agents have rejection rates >50% (may be over-flagging): ${underFlagging.slice(0, 3).join(', ')}` : '',
    ].filter(Boolean).join('. ');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
    });

    const prompt = `You are calibrating an AI brand safety reviewer for "Or This?".

Drift detected: ${driftDesc}

Write a single calibration instruction (under 120 chars) to append to the brand safety review prompt.
If agents are too lenient → instruction should remind reviewer to flag more edge cases.
If agents are over-flagging → instruction should remind reviewer that minor enthusiasm is OK if not excessive.
Write ONLY the instruction text. No preamble.`;

    const result = await model.generateContent(prompt);
    const note = result.response.text().trim();
    if (note && note.length > 10 && note.length < 200) {
      calibrationNote = `\nCalibration note: ${note}`;
      console.log(`[BrandGuard] Calibration updated: ${note}`);
    }
  } catch (err) {
    console.error('[BrandGuard] Calibration failed:', err);
  }
}

/**
 * Checks content against Or This? brand guidelines using Gemini Flash.
 * Lightweight (~200 input tokens). Returns approved=true if Gemini API
 * is not configured, so agents degrade gracefully in dev.
 */
export async function checkContent(text: string, context: string): Promise<BrandGuardResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { approved: true, issues: [] };
  }

  const key = cacheKey(text);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are a brand safety reviewer for "Or This?", the first agentic platform for fashion.

Brand voice v3.0: A SoHo stylist who charges $400/hour — direct, specific, decisive, and worth every word. Not warm or encouraging. The app delivers verdicts, not validation. Tagline: "Confidence in every choice."

Approved language examples: "The proportions carry this. Clean choice." / "Strong color story. The hem is the one edit." / "Not there yet. The layering is competing — simplify by one piece."

Rejected language examples: "You've got this!" / "chef's kiss" / "gorgeous" / "Trust your instincts" / "Almost there!" / "cute!!!"

Review the following content and flag if it:
- Uses inappropriate, offensive, or profane language
- Mentions competitor apps or services by name
- Uses spam-like language (EXCESSIVE CAPS, multiple exclamation marks!!!, urgent/pushy sales pressure)
- Uses more than 3 emoji in a row or more than 5 emoji total
- Is off-brand: empty validation without specific observations, gushing positivity without specificity, judgmental about body types
- Uses prohibited phrases from brand voice v3.0: "you've got this", "chef's kiss", "nailed it", "gorgeous", "stunning", "trust your instincts", "almost there"
- Makes false or unsubstantiated claims or guarantees
- Contains personally identifiable information (names, emails, etc.)
${calibrationNote}
Context: ${context}

Content to review (max 2000 chars shown):
"""
${text.slice(0, 2000)}
"""

Respond with JSON only, no markdown fences:
{"approved":true/false,"issues":["issue1"],"revised":"optional revised version if issues found and fixable"}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Can't parse — default to approved so we don't block agents on Gemini parse failures
      return { approved: true, issues: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<BrandGuardResult>;
    const guardResult: BrandGuardResult = {
      approved: parsed.approved !== false,
      issues: Array.isArray(parsed.issues) ? parsed.issues.filter(i => typeof i === 'string') : [],
      revised: typeof parsed.revised === 'string' ? parsed.revised : undefined,
    };

    cache.set(key, { result: guardResult, expiresAt: Date.now() + CACHE_TTL_MS });
    return guardResult;
  } catch (err) {
    // Brand guard must never crash agents — default to approved
    console.error('[BrandGuard] Gemini check failed, defaulting to approved:', err);
    return { approved: true, issues: [] };
  }
}

/**
 * B5: Publish per-agent brand guard approval rates to Intelligence Bus.
 * Runs monthly in the ops learning cycle (~1K tokens/month when patterns warrant improvement).
 * Over-flagging (>95% approval) = brand guard is too strict.
 * Under-flagging (<50% approval) = brand guard needs tightening.
 */
export async function publishBrandGuardMetrics(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const actions = await prisma.agentAction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { agent: true, status: true },
    });

    if (actions.length === 0) return;

    const byAgent = new Map<string, { total: number; approved: number; rejected: number }>();
    for (const a of actions) {
      if (!byAgent.has(a.agent)) byAgent.set(a.agent, { total: 0, approved: 0, rejected: 0 });
      const m = byAgent.get(a.agent)!;
      m.total++;
      if (a.status === 'auto_approved' || a.status === 'approved') m.approved++;
      if (a.status === 'rejected') m.rejected++;
    }

    const metrics: Array<{ agent: string; total: number; approvalRate: number; rejectionRate: number }> = [];
    for (const [agent, m] of byAgent) {
      if (m.total < 5) continue;
      metrics.push({
        agent,
        total: m.total,
        approvalRate: m.total > 0 ? m.approved / m.total : 0,
        rejectionRate: m.total > 0 ? m.rejected / m.total : 0,
      });
    }

    if (metrics.length === 0) return;

    await publishToIntelligenceBus('brand-guard', 'brand_guard_metrics', {
      measuredAt: new Date().toISOString(),
      metrics,
      overFlagging: metrics.filter(m => m.approvalRate > 0.95).map(m => m.agent),
      underFlagging: metrics.filter(m => m.rejectionRate > 0.5).map(m => m.agent),
    });

    console.log(`[BrandGuard] Published metrics for ${metrics.length} agents`);

    // B3: Auto-calibrate based on the drift data just published
    await calibrateBrandGuard().catch(() => {});
  } catch (err) {
    console.error('[BrandGuard] Failed to publish metrics:', err);
  }
}
