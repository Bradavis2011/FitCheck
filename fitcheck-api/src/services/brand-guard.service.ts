import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface BrandGuardResult {
  approved: boolean;
  issues: string[];
  revised?: string;
}

// In-memory cache: hash → { result, expiresAt }
const cache = new Map<string, { result: BrandGuardResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
