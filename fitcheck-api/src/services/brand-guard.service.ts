import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

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

    const prompt = `You are a brand safety reviewer for "Or This?", an AI-powered outfit feedback app.

Brand voice: Warm, encouraging, supportive, confidence-building. Like a supportive best friend who happens to know fashion.
Tagline: "Confidence in every choice"

Review the following content and flag if it:
- Uses inappropriate, offensive, or profane language
- Mentions competitor apps or services by name
- Uses spam-like language (EXCESSIVE CAPS, multiple exclamation marks!!!, urgent/pushy sales pressure)
- Uses more than 3 emoji in a row or more than 5 emoji total
- Is off-brand: judgmental about body types, fashion choices, or people
- Makes false or unsubstantiated claims or guarantees
- Contains personally identifiable information (names, emails, etc.)

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
  } catch (err) {
    console.error('[BrandGuard] Failed to publish metrics:', err);
  }
}
