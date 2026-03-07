/**
 * Affiliate Recommendation Service
 *
 * Surfaces curated product recommendations based on user StyleDNA, archetype,
 * occasion, and outfit score. Supports multiple live product API sources.
 *
 * Source priority (first with results wins):
 *   1. CJ Affiliate (primary)    — set CJ_API_KEY + CJ_WEBSITE_ID
 *   2. Skimlinks Product API     — set SKIMLINKS_PRODUCT_API_KEY when approved
 *   3. Static catalog fallback   — affiliate-catalog.ts (manual entries, no placeholder)
 *
 * Affiliate URL wrapping:
 *   - CJ: links already include affiliate tracking (no wrapping needed)
 *   - Skimlinks/catalog: wrapped via https://go.skimresources.com?id=PUBLISHER_ID&url=...
 *
 * Amazon PA API: requires 10 qualifying sales/trailing 30 days to get credentials.
 *   Add when that threshold is reached — slot reserved in SourceProduct.source.
 *
 * DO NOT use ShopStyle/Collective Voice — permanently shutting down.
 * DO NOT use Rakuten Advertising — rejected our application.
 *
 * Env vars:
 *   CJ_API_KEY                 — from cj.com Account > API Keys
 *   CJ_WEBSITE_ID              — your CJ website/property ID
 *   SKIMLINKS_PUBLISHER_ID     — your Skimlinks publisher ID
 *   SKIMLINKS_PRODUCT_API_KEY  — from Publisher Hub (activate when approved)
 */

import { prisma } from '../utils/prisma.js';
import { trackServerEvent } from '../lib/posthog.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { AFFILIATE_CATALOG, type CatalogProduct } from '../data/affiliate-catalog.js';
import { fetchProducts, type SourceProduct } from './product-sources.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AffiliateProduct {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  relevanceReason: string;
  source: string;
}

export interface AffiliateRecommendationResult {
  impressionId: string;
  placement: string;
  headline: string;
  subtext: string;
  products: AffiliateProduct[];
}

// ─── Placement copy ───────────────────────────────────────────────────────────

const PLACEMENT_COPY: Record<string, { headline: string; subtext: string }> = {
  post_feedback_high: { headline: 'Own this look',      subtext: 'Curated picks that match your style' },
  post_feedback_mid:  { headline: 'Level it up',        subtext: 'Pieces that could close the gap' },
  archive:            { headline: 'Build on your archive', subtext: 'Picks based on what you wear most' },
  style_dna:          { headline: 'Curated for your DNA',  subtext: 'Brands that match your archetype' },
  inline:             { headline: 'Shop the look',      subtext: 'Picked to match this suggestion' },
  your_week:          { headline: 'Prep for the week',  subtext: 'Curated for what\'s coming up' },
};

// ─── Skimlinks URL wrapper ────────────────────────────────────────────────────

function wrapWithSkimlinks(url: string): string {
  const pubId = process.env.SKIMLINKS_PUBLISHER_ID;
  if (!pubId) return url;
  return `https://go.skimresources.com?id=${pubId}&url=${encodeURIComponent(url)}`;
}

// ─── User context ─────────────────────────────────────────────────────────────

interface UserContext {
  topArchetype: string;
  styleArchetypes: string[];
  dominantColors: string[];
  garments: string[];
  avgFormalityLevel: number;
  budgetLevel: string;
  topOccasions: string[];
  cohort: string;
  latestFeedbackText: string;
}

async function getUserContext(userId: string, outfitCheckId?: string): Promise<UserContext> {
  const [user, recentDNA, recentChecks, targetOutfit] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { budgetLevel: true },
    }),
    prisma.styleDNA.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { styleArchetypes: true, formalityLevel: true, dominantColors: true, garments: true },
    }),
    prisma.outfitCheck.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { occasions: true },
    }),
    outfitCheckId
      ? prisma.outfitCheck.findUnique({
          where: { id: outfitCheckId },
          select: { aiFeedback: true },
        })
      : Promise.resolve(null),
  ]);

  // Aggregate archetype frequencies
  const archetypeCounts = new Map<string, number>();
  const allColors: string[] = [];
  const allGarments: string[] = [];
  for (const dna of recentDNA) {
    for (const a of dna.styleArchetypes) archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
    allColors.push(...dna.dominantColors);
    allGarments.push(...dna.garments);
  }

  const topArchetype = archetypeCounts.size > 0
    ? [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : 'minimalist';

  const styleArchetypes = [...archetypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a);

  // Dominant colors (most frequent)
  const colorCounts = new Map<string, number>();
  for (const c of allColors) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  const dominantColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  // Most worn garments
  const garmentCounts = new Map<string, number>();
  for (const g of allGarments) garmentCounts.set(g, (garmentCounts.get(g) || 0) + 1);
  const garments = [...garmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);

  const formalityValues = recentDNA.map(d => d.formalityLevel).filter(Boolean) as number[];
  const avgFormalityLevel = formalityValues.length > 0
    ? formalityValues.reduce((a, b) => a + b, 0) / formalityValues.length
    : 3;

  const occasionCounts = new Map<string, number>();
  for (const c of recentChecks) {
    for (const o of c.occasions) occasionCounts.set(o, (occasionCounts.get(o) || 0) + 1);
  }
  const topOccasions = [...occasionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([o]) => o);

  // Extract AI feedback text for query building
  const feedback = targetOutfit?.aiFeedback as any;
  const latestFeedbackText = [
    ...(feedback?.couldImprove ?? []),
    ...(feedback?.takeItFurther ?? []),
  ].join(' ');

  return {
    topArchetype,
    styleArchetypes,
    dominantColors,
    garments,
    avgFormalityLevel,
    budgetLevel: user?.budgetLevel ?? 'mid-range',
    topOccasions,
    cohort: `${topArchetype}-${user?.budgetLevel ?? 'mid'}`,
    latestFeedbackText,
  };
}

// ─── User affiliate preferences (learning) ───────────────────────────────────

export interface UserAffiliatePreferences {
  preferredCategories: string[];
  preferredBrands: string[];
  priceRange: { min: number; max: number };
  avoidCategories: string[];
}

// ─── Static catalog scoring (fallback) ───────────────────────────────────────

function scoreStaticProduct(
  product: CatalogProduct,
  ctx: UserContext,
  userPrefs?: UserAffiliatePreferences,
): number {
  let score = 0;
  if (product.archetypes.includes(ctx.topArchetype.toLowerCase())) score += 40;
  else if (product.archetypes.includes('all')) score += 15;
  if (product.budgetLevels.includes('all') || product.budgetLevels.includes(ctx.budgetLevel)) score += 30;
  const [fMin, fMax] = product.formalityRange;
  if (ctx.avgFormalityLevel >= fMin && ctx.avgFormalityLevel <= fMax) score += 20;
  else if (Math.abs(ctx.avgFormalityLevel - (fMin + fMax) / 2) <= 1) score += 10;
  if (ctx.topOccasions.some(o => product.occasions.map(p => p.toLowerCase()).includes(o.toLowerCase()))) score += 10;

  // Per-user learned preferences
  if (userPrefs) {
    if (userPrefs.preferredCategories.includes(product.category)) score += 25;
    if (userPrefs.preferredBrands.some(b => product.brand.toLowerCase() === b.toLowerCase())) score += 15;
    if (product.price >= userPrefs.priceRange.min && product.price <= userPrefs.priceRange.max) score += 10;
    if (userPrefs.avoidCategories.includes(product.category)) score -= 20;
  }

  return score;
}

function staticToAffiliateProduct(product: CatalogProduct, ctx: UserContext): AffiliateProduct {
  const relevanceReason = product.archetypes.includes(ctx.topArchetype.toLowerCase())
    ? `Matches your ${ctx.topArchetype} archetype`
    : product.budgetLevels.includes(ctx.budgetLevel)
      ? `Fits your ${ctx.budgetLevel} budget`
      : 'Picked for your style profile';

  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    // Use pre-built affiliate URL when provided (e.g. Amazon SiteStripe links —
    // wrapping those with Skimlinks would strip the associate tag)
    affiliateUrl: product.affiliateUrl ?? wrapWithSkimlinks(product.merchantUrl),
    relevanceReason,
    source: 'catalog',
  };
}

function sourceToAffiliateProduct(product: SourceProduct, ctx: UserContext): AffiliateProduct {
  // CJ links already include affiliate tracking — use as-is
  // Skimlinks/catalog items need manual wrapping via go.skimresources.com
  const affiliateUrl = product.source === 'cj'
    ? product.affiliateUrl
    : wrapWithSkimlinks(product.originalUrl);

  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    affiliateUrl,
    relevanceReason: `Matched to your ${ctx.topArchetype} style`,
    source: product.source,
  };
}

// ─── Main: get recommendations ────────────────────────────────────────────────

export async function getRecommendations(
  userId: string,
  placement: string,
  outfitCheckId?: string,
  score?: number,
): Promise<AffiliateRecommendationResult | null> {
  if ((placement === 'post_feedback_high' || placement === 'post_feedback_mid') && (score === undefined || score < 6)) {
    return null;
  }

  const ctx = await getUserContext(userId, outfitCheckId);

  // Resolve gender filter (same B→A→C priority as inline matching)
  const userRaw = await prisma.user.findUnique({
    where: { id: userId },
    select: { genderPreference: true } as any,
  }) as any;

  let outfitAiGender: string | null = null;
  if (outfitCheckId) {
    const outfitRow = await prisma.outfitCheck.findUnique({
      where: { id: outfitCheckId },
      select: { aiFeedback: true },
    });
    const fb = outfitRow?.aiFeedback as Record<string, unknown> | null;
    outfitAiGender = (fb?.subjectGender as string | undefined) ?? null;
    if (!outfitAiGender) {
      const garments = ((fb?.styleDNA as any)?.garments as string[] | undefined) ?? [];
      const inferred = inferGenderFromGarments(garments);
      if (inferred !== 'unknown') outfitAiGender = inferred === 'men' ? 'male' : 'female';
    }
  }

  const subjectGender = resolveSubjectGender(userRaw?.genderPreference, outfitAiGender, []);

  let products: AffiliateProduct[] = [];

  // ── Try live API sources first ─────────────────────────────────────────────
  const hasLiveSource = process.env.CJ_API_KEY || process.env.SKIMLINKS_PRODUCT_API_KEY;

  if (hasLiveSource) {
    const sourceProducts = await fetchProducts(
      {
        styleArchetypes: ctx.styleArchetypes,
        dominantColors: ctx.dominantColors,
        garments: ctx.garments,
        formalityLevel: ctx.avgFormalityLevel,
        occasions: ctx.topOccasions,
        budgetLevel: ctx.budgetLevel,
        outfitScore: score ?? 7,
        feedbackText: ctx.latestFeedbackText,
      },
      4,
    );

    products = sourceProducts.map(p => sourceToAffiliateProduct(p, ctx));
  }

  // ── Fallback: static catalog ───────────────────────────────────────────────
  if (products.length === 0) {
    const liveStatic = AFFILIATE_CATALOG.filter(p => {
      if (!p.isPlaceholder && p.imageUrl) {
        if (subjectGender !== 'unknown') {
          const pg = getProductGender(p);
          if (pg !== 'unisex' && pg !== subjectGender) return false;
        }
        return true;
      }
      return false;
    });
    if (liveStatic.length === 0) return null;

    products = liveStatic
      .map(p => ({ product: p, score: scoreStaticProduct(p, ctx) }))
      .filter(({ score: s }) => s > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ product }) => staticToAffiliateProduct(product, ctx));
  }

  if (products.length === 0) return null;

  const copyKey = placement in PLACEMENT_COPY ? placement : 'archive';
  const copy = PLACEMENT_COPY[copyKey];

  const impression = await prisma.affiliateImpression.create({
    data: {
      userId,
      outfitCheckId: outfitCheckId ?? null,
      placement,
      archetype: ctx.topArchetype,
      cohort: ctx.cohort,
      score: score ?? null,
      productIds: products.map(p => p.id),
    },
  });

  trackServerEvent(userId, 'affiliate_impression', {
    placement,
    productCount: products.length,
    archetype: ctx.topArchetype,
    score,
    source: products[0]?.source,
  });

  return { impressionId: impression.id, placement, headline: copy.headline, subtext: copy.subtext, products };
}

// ─── Track click ──────────────────────────────────────────────────────────────

export async function trackAffiliateClick(
  impressionId: string,
  productId: string,
  userId: string,
): Promise<void> {
  // Look up product metadata from catalog so we can store it on the impression
  const product = AFFILIATE_CATALOG.find(p => p.id === productId);

  await prisma.affiliateImpression.updateMany({
    where: { id: impressionId, userId, clickedId: null },
    data: {
      clickedId: productId,
      clickedAt: new Date(),
      clickedCategory: product?.category ?? null,
      clickedBrand: product?.brand ?? null,
      clickedPrice: product?.price ?? null,
    } as any, // new fields added via migration
  });

  trackServerEvent(userId, 'affiliate_click', { impressionId, productId });
}

// ─── Inline product matching ─────────────────────────────────────────────────

export interface InlineMatch {
  section: 'couldImprove' | 'takeItFurther';
  index: number;
  product: AffiliateProduct;
}

export interface InlineMatchResult {
  impressionId: string;
  matches: InlineMatch[];
}

const GARMENT_CATEGORY_MAP: Array<{ regex: RegExp; category: string }> = [
  { regex: /blazer|jacket|coat|layer|outerwear/i,                          category: 'outerwear' },
  { regex: /sneaker|shoe|boot|heel|sandal|loafer/i,                        category: 'shoes' },
  { regex: /bag|crossbody|tote|purse|clutch/i,                             category: 'bags' },
  { regex: /jean|trouser|pant|skirt|short/i,                               category: 'bottoms' },
  { regex: /dress/i,                                                        category: 'dresses' },
  { regex: /top|shirt|blouse|sweater|cami|turtleneck/i,                    category: 'tops' },
  { regex: /necklace|earring|bracelet|jewelry|belt|watch|ring/i,           category: 'accessories' },
];

function detectCategory(text: string): string | null {
  for (const { regex, category } of GARMENT_CATEGORY_MAP) {
    if (regex.test(text)) return category;
  }
  return null;
}

/** Infer product gender from the explicit `gender` field or product title. */
function getProductGender(p: CatalogProduct): 'men' | 'women' | 'unisex' {
  if (p.gender) return p.gender;
  if (/\bwomen'?s\b/i.test(p.title)) return 'women';
  if (/\bmen'?s\b/i.test(p.title)) return 'men';
  return 'unisex';
}

/**
 * Garment-keyword heuristic — last-resort fallback for outfit checks
 * that were analyzed before subjectGender was added to the AI schema.
 * Returns 'unknown' when signals are ambiguous.
 */
function inferGenderFromGarments(garments: string[]): 'men' | 'women' | 'unknown' {
  const text = garments.join(' ').toLowerCase();

  const femaleHits = [
    /\bskirt\b/, /\bdress\b(?!.*suit)/, /\b(kitten |stiletto |block )?heel[s]?\b/,
    /\bpump[s]?\b/, /\bblouse\b/, /\bbralette\b/, /\bcorset\b/, /\bromper\b/,
    /\bslingback\b/, /\bmary jane\b/, /\bmidi skirt\b/, /\bwrap dress\b/,
  ].filter(r => r.test(text)).length;

  const maleHits = [
    /\b(neck)?tie\b/, /\btuxedo\b/, /\bdress shirt\b/, /\bpocket square\b/,
    /\boxford shoe\b/, /\bderby shoe\b/, /\bmonk strap\b/, /\bmen'?s\b/,
    /\bsport coat\b/, /\bsuit jacket\b/,
  ].filter(r => r.test(text)).length;

  const suitBoost = /\bsuit\b/.test(text) && !/\bpantsuit\b/.test(text) ? 0.5 : 0;

  if (femaleHits > maleHits + suitBoost) return 'women';
  if (maleHits + suitBoost > femaleHits) return 'men';
  return 'unknown';
}

/**
 * Resolve final gender filter for product matching.
 * Priority: B (user profile) → A (AI field) → C (garment heuristic for old outfits)
 */
function resolveSubjectGender(
  profileGender: string | null | undefined,
  aiGender: string | null | undefined,
  garmentFallback: string[],
): 'men' | 'women' | 'unknown' {
  // B: explicit user preference always wins
  if (profileGender === 'male') return 'men';
  if (profileGender === 'female') return 'women';

  // A: AI-detected from photo (new outfits only)
  if (aiGender === 'male') return 'men';
  if (aiGender === 'female') return 'women';

  // C: garment keyword heuristic (old outfits without subjectGender)
  return inferGenderFromGarments(garmentFallback);
}

export async function getInlineMatches(
  userId: string,
  outfitCheckId: string,
): Promise<InlineMatchResult | null> {
  const outfit = await prisma.outfitCheck.findUnique({
    where: { id: outfitCheckId },
    select: { aiFeedback: true },
  });
  if (!outfit?.aiFeedback) return null;

  const feedback = outfit.aiFeedback as Record<string, unknown>;
  const couldImprove = (feedback.couldImprove as string[] | undefined) ?? [];
  const takeItFurther = (feedback.takeItFurther as string[] | undefined) ?? [];
  const currentGarments: string[] = ((feedback.styleDNA as any)?.garments as string[] | undefined) ?? [];

  // A: AI-detected gender from the photo (present on outfits analyzed after schema update)
  const aiGender = (feedback.subjectGender as string | undefined) ?? null;

  const ctx = await getUserContext(userId, outfitCheckId);

  // Load user profile: B-override gender preference + affiliate preferences
  const userRaw = await prisma.user.findUnique({
    where: { id: userId },
    select: { affiliatePreferences: true, genderPreference: true } as any,
  }) as any;
  const userPrefs: UserAffiliatePreferences | undefined = userRaw?.affiliatePreferences
    ? (userRaw.affiliatePreferences as UserAffiliatePreferences)
    : undefined;

  // B → A → C: profile wins, then AI field, then garment heuristic for old outfits
  const subjectGender = resolveSubjectGender(userRaw?.genderPreference, aiGender, currentGarments);

  const liveStatic = AFFILIATE_CATALOG.filter(p => !p.isPlaceholder && p.imageUrl);
  if (liveStatic.length === 0) return null;

  const matches: InlineMatch[] = [];
  const usedProductIds = new Set<string>();
  const usedCategories = new Set<string>();

  const bullets: Array<{ section: 'couldImprove' | 'takeItFurther'; text: string; index: number }> = [
    ...couldImprove.map((text, i) => ({ section: 'couldImprove' as const, text, index: i })),
    ...takeItFurther.map((text, i) => ({ section: 'takeItFurther' as const, text, index: i })),
  ];

  for (const bullet of bullets) {
    if (matches.length >= 3) break;

    const category = detectCategory(bullet.text);
    if (!category || usedCategories.has(category)) continue;

    const candidates = liveStatic.filter(p => {
      if (p.category !== category) return false;
      // Gender filter — skip products that are explicitly for the wrong gender
      if (subjectGender !== 'unknown') {
        const pg = getProductGender(p);
        if (pg !== 'unisex' && pg !== subjectGender) return false;
      }
      return true;
    });
    if (candidates.length === 0) continue;

    const best = candidates
      .map(p => ({ product: p, score: scoreStaticProduct(p, ctx, userPrefs) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!best || usedProductIds.has(best.product.id)) continue;

    usedProductIds.add(best.product.id);
    usedCategories.add(category);

    matches.push({
      section: bullet.section,
      index: bullet.index,
      product: staticToAffiliateProduct(best.product, ctx),
    });
  }

  if (matches.length === 0) return null;

  const impression = await prisma.affiliateImpression.create({
    data: {
      userId,
      outfitCheckId,
      placement: 'inline',
      archetype: ctx.topArchetype,
      cohort: ctx.cohort,
      productIds: matches.map(m => m.product.id),
    },
  });

  trackServerEvent(userId, 'affiliate_impression', {
    placement: 'inline',
    productCount: matches.length,
    archetype: ctx.topArchetype,
    source: 'catalog',
  });

  return { impressionId: impression.id, matches };
}

// ─── Per-user affiliate preference learning ───────────────────────────────────

export async function computeUserAffiliatePreferences(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Find users with 3+ impressions
  const impressionGroups = await prisma.affiliateImpression.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: ninetyDaysAgo } },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
  });

  let processed = 0;

  for (const group of impressionGroups) {
    const userId = group.userId;

    try {
      const impressions = await prisma.affiliateImpression.findMany({
        where: { userId, createdAt: { gte: ninetyDaysAgo } },
        select: {
          placement: true,
          productIds: true,
          clickedId: true,
          clickedCategory: true,
          clickedBrand: true,
          clickedPrice: true,
        } as any,
      }) as unknown as Array<{
        placement: string;
        productIds: string[];
        clickedId: string | null;
        clickedCategory: string | null;
        clickedBrand: string | null;
        clickedPrice: number | null;
      }>;

      const clicks = impressions.filter(i => (i as any).clickedId !== null);
      if (clicks.length === 0) continue;

      // Count clicks per category
      const categoryCounts = new Map<string, number>();
      const brandCounts = new Map<string, number>();
      const clickedPrices: number[] = [];

      for (const imp of clicks) {
        const cat = (imp as any).clickedCategory;
        if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        const brand = (imp as any).clickedBrand;
        if (brand) brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
        const price = (imp as any).clickedPrice;
        if (price !== null && price > 0) clickedPrices.push(price);
      }

      // Categories with >30% click rate
      const categoryImpressionCounts = new Map<string, number>();
      for (const imp of impressions) {
        // For each shown product, look up category
        for (const pid of imp.productIds) {
          const p = AFFILIATE_CATALOG.find(c => c.id === pid);
          if (p) categoryImpressionCounts.set(p.category, (categoryImpressionCounts.get(p.category) || 0) + 1);
        }
      }

      const preferredCategories: string[] = [];
      const avoidCategories: string[] = [];
      for (const [cat, impressionCount] of categoryImpressionCounts) {
        const clickCount = categoryCounts.get(cat) || 0;
        const ctr = impressionCount > 0 ? clickCount / impressionCount : 0;
        if (ctr > 0.3) preferredCategories.push(cat);
        if (impressionCount >= 5 && clickCount === 0) avoidCategories.push(cat);
      }

      // Brands clicked 2+ times
      const preferredBrands: string[] = [];
      for (const [brand, count] of brandCounts) {
        if (count >= 2) preferredBrands.push(brand);
      }

      // Price range: avg ± 1 stddev
      let priceRange = { min: 0, max: 500 };
      if (clickedPrices.length >= 2) {
        const avg = clickedPrices.reduce((a, b) => a + b, 0) / clickedPrices.length;
        const variance = clickedPrices.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / clickedPrices.length;
        const stddev = Math.sqrt(variance);
        priceRange = { min: Math.max(0, Math.round(avg - stddev)), max: Math.round(avg + stddev) };
      }

      const prefs: UserAffiliatePreferences = { preferredCategories, preferredBrands, priceRange, avoidCategories };

      await (prisma.user as any).update({
        where: { id: userId },
        data: { affiliatePreferences: prefs as any },
      });

      processed++;
    } catch (err) {
      console.error(`[Affiliate] Failed to compute preferences for user ${userId}:`, err);
    }
  }

  console.log(`[Affiliate] computeUserAffiliatePreferences: processed ${processed} users`);
}

// ─── Daily metrics cron ───────────────────────────────────────────────────────

export async function measureAffiliateMetrics(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const impressions = await prisma.affiliateImpression.findMany({
    where: { createdAt: { gte: since } },
    select: { placement: true, archetype: true, cohort: true, clickedId: true },
  });

  if (impressions.length === 0) return;

  const total = impressions.length;
  const clicks = impressions.filter(i => i.clickedId).length;
  const ctr = clicks / total;

  const byPlacement: Record<string, { impressions: number; clicks: number; ctr: number }> = {};
  const byArchetype: Record<string, { impressions: number; clicks: number; ctr: number }> = {};

  for (const imp of impressions) {
    const p = imp.placement;
    if (!byPlacement[p]) byPlacement[p] = { impressions: 0, clicks: 0, ctr: 0 };
    byPlacement[p].impressions++;
    if (imp.clickedId) byPlacement[p].clicks++;

    const a = imp.archetype ?? 'unknown';
    if (!byArchetype[a]) byArchetype[a] = { impressions: 0, clicks: 0, ctr: 0 };
    byArchetype[a].impressions++;
    if (imp.clickedId) byArchetype[a].clicks++;
  }

  for (const v of Object.values(byPlacement)) v.ctr = v.impressions > 0 ? v.clicks / v.impressions : 0;
  for (const v of Object.values(byArchetype)) v.ctr = v.impressions > 0 ? v.clicks / v.impressions : 0;

  await publishToIntelligenceBus('affiliate', 'affiliate_metrics', {
    period: 'last_7d',
    totalImpressions: total,
    totalClicks: clicks,
    overallCtr: ctr,
    byPlacement,
    byArchetype,
  });

  console.log(`[Affiliate] ${total} impressions, ${clicks} clicks, CTR=${(ctr * 100).toFixed(1)}%`);
}
