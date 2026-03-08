/**
 * Wardrobe Prescription Service
 *
 * An agentic affiliate feature for Plus/Pro users.
 *
 * Each week, the AI analyzes a user's StyleDNA, wardrobe inventory, and
 * recurring critique weaknesses to identify 3 specific wardrobe gaps.
 * For each gap it fetches real affiliate products (CJ/Skimlinks → includes Amazon)
 * and stores the prescription, which surfaces in "Your Stylist" on the home screen.
 *
 * This is NOT passive product cards — it reasons about YOUR specific wardrobe
 * gaps before selecting products. The user sees WHY each item was chosen.
 *
 * Cron: Wednesday 11am UTC (weekly, after StyleNarrative agent).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { fetchProducts } from './product-sources.service.js';
import { trackedGenerateContent } from './token-budget.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface PrescriptionProduct {
  title: string;
  brand: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  source: string;
}

export interface PrescriptionGap {
  gapCategory: string;    // e.g. "structured belt", "loafers", "oversized blazer"
  reasoning: string;      // Why this was identified for this user specifically
  searchQuery: string;    // Used internally to fetch products
  products: PrescriptionProduct[];
}

// ─── Gap Identification (Gemini) ──────────────────────────────────────────────

async function identifyWardrobeGaps(userId: string): Promise<{ gaps: Array<{ gapCategory: string; reasoning: string; searchQuery: string }> } | null> {
  const [recentDNA, wardrobeItems, recentChecks, recentCritiques, user] = await Promise.all([
    prisma.styleDNA.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { styleArchetypes: true, dominantColors: true, garments: true, formalityLevel: true },
    }),
    prisma.wardrobeItem.findMany({
      where: { userId },
      select: { name: true, category: true, timesWorn: true },
      orderBy: { timesWorn: 'desc' },
    }),
    prisma.outfitCheck.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { occasions: true, aiScore: true },
    }),
    prisma.critiqueReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { weaknesses: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLevel: true },
    }),
  ]);

  if (recentDNA.length < 3) return null; // Not enough style data yet

  // Aggregate style data
  const archetypeCounts = new Map<string, number>();
  const allColors: string[] = [];
  const allGarments: string[] = [];
  for (const dna of recentDNA) {
    for (const a of dna.styleArchetypes) archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
    allColors.push(...dna.dominantColors);
    allGarments.push(...dna.garments);
  }
  const topArchetype = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'minimalist';
  const colorCounts = new Map<string, number>();
  for (const c of allColors) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  const dominantColors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  const garmentCounts = new Map<string, number>();
  for (const g of allGarments) garmentCounts.set(g, (garmentCounts.get(g) || 0) + 1);
  const topGarments = [...garmentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);

  // Wardrobe by category
  const wardrobeByCategory = new Map<string, string[]>();
  for (const item of wardrobeItems) {
    if (!wardrobeByCategory.has(item.category)) wardrobeByCategory.set(item.category, []);
    wardrobeByCategory.get(item.category)!.push(item.name);
  }
  const wardrobeSummary = wardrobeItems.length === 0
    ? 'No wardrobe items tracked yet'
    : [...wardrobeByCategory.entries()].map(([cat, items]) => `${cat}: ${items.slice(0, 4).join(', ')}`).join(' | ');

  // Top occasions
  const occasionCounts = new Map<string, number>();
  for (const c of recentChecks) {
    for (const o of c.occasions) occasionCounts.set(o, (occasionCounts.get(o) || 0) + 1);
  }
  const topOccasions = [...occasionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o]) => o);

  // Recent AI critique weaknesses (global — proxy for what's been flagged)
  const weaknesses = recentCritiques.flatMap(r => Array.isArray(r.weaknesses) ? r.weaknesses as string[] : []).slice(0, 4);

  const prompt = `You are an expert personal stylist analyzing a user's wardrobe data to identify the 3 most impactful product gaps.

USER STYLE PROFILE:
- Top style archetype: ${topArchetype}
- Dominant colors: ${dominantColors.join(', ')}
- Most worn garments: ${topGarments.join(', ')}
- Top occasions: ${topOccasions.join(', ')}
- Budget level: ${user?.budgetLevel || 'mid-range'}
- Total outfit checks: ${recentChecks.length}

CURRENT WARDROBE INVENTORY:
${wardrobeSummary}

RECENT AI CRITIQUE PATTERNS (what keeps getting flagged):
${weaknesses.length > 0 ? weaknesses.map(w => `- ${w}`).join('\n') : '- No recurring critiques yet'}

Identify exactly 3 wardrobe GAPS — specific product types this user is missing that would:
1. Address any recurring critique weaknesses
2. Complement their existing color palette (${dominantColors.slice(0, 2).join(', ')} based)
3. Open up occasions they currently lack good options for

Rules:
- Be specific: "tan leather belt" not "belt"; "cream linen blazer" not "blazer"
- Reference the user's actual data in the reasoning (cite their archetype, colors, or occasions)
- The searchQuery must be 3-5 words, product-focused, ready to use in an affiliate search API
- Do NOT suggest items they already have in their wardrobe

Return JSON only (no markdown):
{
  "gaps": [
    {
      "gapCategory": "specific item name",
      "reasoning": "1-2 sentences explaining why this was chosen for this user specifically",
      "searchQuery": "3-5 word product search query"
    }
  ]
}`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
  });

  const result = await trackedGenerateContent(model, prompt, 2_000, 'wardrobe_prescription');
  if (!result) return null;

  try {
    const raw = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as { gaps: Array<{ gapCategory: string; reasoning: string; searchQuery: string }> };
  } catch {
    return null;
  }
}

// ─── Main: run prescription for one user ─────────────────────────────────────

async function runPrescriptionForUser(userId: string, weekPeriod: string): Promise<boolean> {
  // Skip if already generated this week
  const existing = await prisma.wardrobePrescription.findUnique({
    where: { userId_weekPeriod: { userId, weekPeriod } },
  });
  if (existing) return false;

  // Identify gaps via Gemini
  const identified = await identifyWardrobeGaps(userId);
  if (!identified || identified.gaps.length === 0) return false;

  // For each gap, fetch affiliate products
  const prescriptionGaps: PrescriptionGap[] = [];
  for (const gap of identified.gaps.slice(0, 3)) {
    const products = await fetchProducts({
      styleArchetypes: [],
      dominantColors: [],
      garments: [gap.searchQuery],
      formalityLevel: 3,
      occasions: [],
      budgetLevel: 'mid-range',
      outfitScore: 7,
      feedbackText: gap.searchQuery,
    }, 3);

    prescriptionGaps.push({
      gapCategory: gap.gapCategory,
      reasoning: gap.reasoning,
      searchQuery: gap.searchQuery,
      products: products.map(p => ({
        title: p.title,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        imageUrl: p.imageUrl,
        affiliateUrl: p.affiliateUrl,
        source: p.source,
      })),
    });

    // Small delay between product API calls
    await new Promise(r => setTimeout(r, 500));
  }

  const totalItems = prescriptionGaps.reduce((s, g) => s + g.products.length, 0);

  await prisma.wardrobePrescription.create({
    data: {
      userId,
      weekPeriod,
      gaps: prescriptionGaps as any,
      totalItems,
    },
  });

  console.log(`[WardrobePrescription] Generated for user ${userId}: ${prescriptionGaps.length} gaps, ${totalItems} products`);
  return true;
}

// ─── Weekly batch run ─────────────────────────────────────────────────────────

export async function runWardrobePrescriptionAgent(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  const now = new Date();
  const week = getWeekPeriod(now);

  // Only run for Plus/Pro users who have enough outfit data (5+ checks)
  const eligibleUsers = await prisma.user.findMany({
    where: {
      tier: { in: ['plus', 'pro'] },
      outfitChecks: { some: { isDeleted: false } },
    },
    select: { id: true, _count: { select: { outfitChecks: true } } },
  });

  const qualified = eligibleUsers.filter(u => u._count.outfitChecks >= 5);
  console.log(`[WardrobePrescription] Running for ${qualified.length} eligible users (week ${week})`);

  let generated = 0;
  for (const user of qualified) {
    try {
      const created = await runPrescriptionForUser(user.id, week);
      if (created) generated++;
      // Delay between users to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[WardrobePrescription] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[WardrobePrescription] Done. Generated ${generated}/${qualified.length} prescriptions for week ${week}`);
}

function getWeekPeriod(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
