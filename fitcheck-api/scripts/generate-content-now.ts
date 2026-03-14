/**
 * One-Shot Content Generator
 *
 * Bypasses cron scheduling and token budget gates.
 * Seeds keywords if none exist, generates 3 niche articles, publishes them directly.
 *
 * Usage: railway run npx tsx scripts/generate-content-now.ts
 *
 * Safe to run multiple times — uses upsert for keywords and slug deduplication for drafts.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const INDEXNOW_KEY = '13334acc9b0f8e60c3cf48d4c1364a28';
async function pingIndexNow(slug: string) {
  try {
    const url = `https://orthis.app/learn/${slug}`;
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'orthis.app',
        key: INDEXNOW_KEY,
        keyLocation: `https://orthis.app/${INDEXNOW_KEY}.txt`,
        urlList: [url],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    console.log(`  📡 IndexNow pinged for ${url}`);
  } catch {
    console.warn('  ⚠️  IndexNow ping failed (non-fatal)');
  }
}

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Seed data (subset of keyword-discovery seeds) ────────────────────────────

const SEED_KEYWORDS = [
  { keyword: 'what to wear to sorority rush open house', niche: 'rush', intent: 'informational' as const, difficulty: 'low' as const },
  { keyword: 'stay at home mom returning to work outfits', niche: 'sahm_rto', intent: 'informational' as const, difficulty: 'low' as const },
  { keyword: 'what to wear first date after divorce', niche: 'dating_restart', intent: 'informational' as const, difficulty: 'low' as const },
  { keyword: 'return to office outfit ideas 2026', niche: 'wfh_rto', intent: 'informational' as const, difficulty: 'medium' as const },
  { keyword: 'postpartum outfit ideas that fit', niche: 'postpartum', intent: 'informational' as const, difficulty: 'low' as const },
  { keyword: 'what to wear first day new career', niche: 'career_change', intent: 'informational' as const, difficulty: 'low' as const },
  { keyword: 'finding style again after 40', niche: 'reinvention', intent: 'informational' as const, difficulty: 'low' as const },
];

// ─── Niche tone contexts ───────────────────────────────────────────────────────

const NICHE_CONTEXT: Record<string, string> = {
  rush: `You are writing for women preparing for sorority rush week. The audience is college-aged women (18-22) anxious about their outfits. They are TikTok-native, shop at Zara, Revolve, Madewell, and Free People, and care deeply about first impressions. Tone: supportive big sister — warm, specific, honest. Acknowledge the anxiety. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. Include specific outfit recommendations with real brands. CTA at end: "Still not sure? Snap a photo of your outfit and get instant AI feedback with Or This? — know you nailed it before you walk in." with App Store link https://apps.apple.com/app/or-this/id6742406265`,
  sahm_rto: `You are writing for stay-at-home moms returning to the workplace after time away with kids. Tone: Practical, no judgment, budget-aware — like a friend who's been through this. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. Include affordable brands (Target, LOFT, Banana Republic Factory, Thrift, Poshmark). CTA: "Heading back to the office? Get AI feedback on your outfit before day one." with link https://orthis.app`,
  dating_restart: `You are writing for women dating again after divorce or a major life transition. Tone: Warm, encouraging, zero pressure — confidence-first, not trend-first. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. CTA: "Not sure how your outfit reads? Get instant AI feedback before your date." with link https://orthis.app`,
  wfh_rto: `You are writing for women returning to office after years of remote work. Tone: Direct, relatable, a little humorous. Acknowledge the wardrobe whiplash. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. Be specific about what business casual means in 2026. CTA: "Back in the office soon? Snap your outfit for instant AI feedback." with link https://orthis.app`,
  postpartum: `You are writing for new moms navigating their changing body and finding outfits that work postpartum. Tone: Gentle, body-positive, never prescriptive about hiding anything. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. Never use "get your body back." CTA: "Getting dressed with a new baby is hard enough. Let AI give you instant outfit feedback." with link https://orthis.app`,
  career_change: `You are writing for women pivoting to a new industry or starting a new career. Tone: Professional but approachable — confidence matters more than perfection. Acknowledge imposter syndrome. IMPORTANT: The app is called "Or This?" — do NOT mention community voting. CTA: "Starting a new chapter? Get AI feedback on your interview or first-day outfit." with link https://orthis.app`,
  reinvention: `You are writing for women in midlife reinvention — post-kids, post-divorce, or ready for a new chapter. Tone: Celebratory, not patronizing. Never use "age-appropriate." IMPORTANT: The app is called "Or This?" — do NOT mention community voting. CTA: "Reinventing your style? Get instant AI feedback on your outfits." with link https://orthis.app`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/**
 * Gemini often emits literal newlines/tabs inside JSON string values.
 * JSON.parse() rejects these. Walk char-by-char and escape them.
 */
function sanitizeJsonNewlines(raw: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === '\\') { result += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\n'; continue; }
    if (inString && c === '\r') { result += '\\r'; continue; }
    if (inString && c === '\t') { result += '\\t'; continue; }
    result += c;
  }
  return result;
}

interface ArticleDraft {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  ogTitle: string;
  excerpt: string;
  seoKeywords: string[];
  faqItems: Array<{ question: string; answer: string }>;
}

// ─── Generate one article via Gemini (no budget gates) ────────────────────────

async function generateArticle(keyword: string, niche: string, intent: string): Promise<ArticleDraft | null> {
  const contextNote = NICHE_CONTEXT[niche] ?? 'Write for an audience anxious about their outfit choices.';

  const MID_CTA = `\n\n> **Not sure about your outfit?** Get instant AI feedback — [Try Or This? free →](https://orthis.app)\n\n`;

  const prompt = `${contextNote}

Write a comprehensive SEO article targeting the following keyword.

TARGET KEYWORD: "${keyword}"
SEARCH INTENT: ${intent}

STRUCTURE REQUIREMENT: After your second ## section, insert this exact callout block on its own line:
${MID_CTA}
Return ONLY a JSON object with this exact shape (no markdown, no code fence):
{
  "title": "Title 50-60 chars, include keyword naturally",
  "metaDescription": "Under 155 chars, address the anxiety directly, include keyword",
  "ogTitle": "Open Graph title under 60 chars for sharing",
  "excerpt": "2-3 sentence summary for article listings",
  "seoKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content": "Full article body 1200-1800 words, proper markdown with ## and ### headings. Open with empathy. Include Do's and Don'ts section. Be specific with brand/item recommendations. End with CTA.",
  "faqItems": [
    {"question": "Question 1?", "answer": "Detailed answer."},
    {"question": "Question 2?", "answer": "Detailed answer."},
    {"question": "Question 3?", "answer": "Detailed answer."},
    {"question": "Question 4?", "answer": "Detailed answer."},
    {"question": "Question 5?", "answer": "Detailed answer."}
  ]
}`;

  // responseMimeType forces Gemini to output raw JSON without markdown fences or escaping issues
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      maxOutputTokens: 4000,
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  });

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  Calling Gemini for "${keyword}" (attempt ${attempt})...`);
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();

      // Strip markdown fences if present (shouldn't be with responseMimeType but just in case)
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`  ⚠️  No JSON object found (attempt ${attempt})`);
        continue;
      }

      const sanitized = sanitizeJsonNewlines(jsonMatch[0]);
      const parsed = JSON.parse(sanitized) as Omit<ArticleDraft, 'slug'>;
      return {
        title: parsed.title ?? keyword,
        slug: slugify(parsed.title ?? keyword),
        content: parsed.content ?? '',
        metaDescription: (parsed.metaDescription ?? '').slice(0, 155),
        ogTitle: parsed.ogTitle ?? parsed.title ?? keyword,
        excerpt: parsed.excerpt ?? '',
        seoKeywords: parsed.seoKeywords ?? [],
        faqItems: parsed.faqItems ?? [],
      };
    } catch (err) {
      console.warn(`  ⚠️  Attempt ${attempt} failed: ${(err as Error).message}`);
      if (attempt === MAX_RETRIES) {
        console.error(`  ❌ All ${MAX_RETRIES} attempts failed for "${keyword}"`);
      }
    }
  }
  return null;
}

// ─── Save directly as published (bypasses executeOrQueue) ─────────────────────

async function saveAsPublished(
  draft: ArticleDraft,
  keyword: string,
  niche: string,
): Promise<{ id: string; slug: string } | null> {
  try {
    // Deduplicate slug
    let slug = draft.slug;
    let attempt = 0;
    while (await prisma.blogDraft.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${draft.slug}-${attempt}`;
    }

    const created = await prisma.blogDraft.create({
      data: {
        title: draft.title,
        slug,
        content: draft.content,
        metaDescription: draft.metaDescription,
        ogTitle: draft.ogTitle,
        excerpt: draft.excerpt,
        seoKeywords: draft.seoKeywords,
        status: 'published',
        publishedAt: new Date(),
        category: niche,
        contentType: 'style_guide',
        sourceData: {
          targetKeyword: keyword,
          niche,
          faqItems: draft.faqItems,
          generatedAt: new Date().toISOString(),
          generatedBy: 'generate-content-now script',
        },
      },
    });

    return { id: created.id, slug };
  } catch (err) {
    console.error(`  ❌ DB save failed for "${draft.title}":`, (err as Error).message);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Or This? — One-Shot Content Generator');
  console.log('━'.repeat(60));
  console.log('Bypasses cron/budget gates. Publishes directly to DB.\n');

  // Validate Gemini key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set — cannot generate content. Add it and retry.');
    process.exit(1);
  }

  // ── Step 1: Seed keywords if none exist ─────────────────────────────────────
  const existingCount = await prisma.targetKeyword.count({
    where: { status: 'identified' },
  });

  if (existingCount === 0) {
    console.log('📌 No identified keywords found — seeding...');
    let seeded = 0;
    for (const kw of SEED_KEYWORDS) {
      await prisma.targetKeyword.upsert({
        where: { keyword: kw.keyword },
        update: {},
        create: {
          keyword: kw.keyword,
          niche: kw.niche,
          intent: kw.intent,
          difficulty: kw.difficulty,
          status: 'identified',
        },
      });
      seeded++;
    }
    console.log(`  ✅ Seeded ${seeded} keywords\n`);
  } else {
    console.log(`📌 Found ${existingCount} identified keywords — skipping seed\n`);
  }

  // ── Step 2: Pick first 3 identified keywords ─────────────────────────────────
  const keywords = await prisma.targetKeyword.findMany({
    where: { status: 'identified' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });

  console.log(`🎯 Generating ${keywords.length} articles:\n`);

  const results: Array<{ keyword: string; slug: string; url: string }> = [];

  // ── Step 3: Generate and publish each article ─────────────────────────────────
  for (const kw of keywords) {
    console.log(`[${kw.niche}] "${kw.keyword}"`);

    const draft = await generateArticle(kw.keyword, kw.niche, kw.intent);
    if (!draft) {
      console.log('  ⏭️  Skipping (generation failed)\n');
      continue;
    }

    const saved = await saveAsPublished(draft, kw.keyword, kw.niche);
    if (!saved) {
      console.log('  ⏭️  Skipping (save failed)\n');
      continue;
    }

    // Mark keyword as used
    await prisma.targetKeyword.update({
      where: { id: kw.id },
      data: { status: 'content_created', targetPageSlug: saved.slug },
    });

    const url = `https://orthis.app/learn/${saved.slug}`;
    await pingIndexNow(saved.slug);
    console.log(`  ✅ Published → ${url}\n`);
    results.push({ keyword: kw.keyword, slug: saved.slug, url });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('─'.repeat(60));
  console.log(`\n✅ Done — ${results.length}/${keywords.length} articles published\n`);

  if (results.length > 0) {
    console.log('Published articles:');
    for (const r of results) {
      console.log(`  ${r.url}`);
    }
    console.log('\nVerify at: https://orthis.app/learn');
    console.log('Also check: https://fitcheck-production-0f92.up.railway.app/api/learn/content\n');
  } else {
    console.log('No articles published. Check errors above.\n');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
