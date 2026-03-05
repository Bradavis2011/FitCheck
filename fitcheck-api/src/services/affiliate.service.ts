/**
 * Affiliate Recommendation Service
 *
 * Surfaces curated product recommendations based on user StyleDNA, archetype,
 * occasion, and outfit score. Supports multiple live product API sources.
 *
 * Source priority (first with results wins):
 *   1. ShopStyle Collective API  — set SHOPSTYLE_API_KEY to activate
 *   2. Skimlinks Product API     — set SKIMLINKS_PRODUCT_API_KEY when approved
 *   3. Static catalog fallback   — affiliate-catalog.ts (manual entries, no placeholder)
 *
 * Affiliate URL wrapping:
 *   - ShopStyle: URLs are already affiliate-tracked (no wrapping needed)
 *   - All others: wrapped via https://go.skimresources.com?id=PUBLISHER_ID&url=...
 *
 * New env vars:
 *   SKIMLINKS_PUBLISHER_ID     — your publisher ID (299508X1787287)
 *   SHOPSTYLE_API_KEY          — from shopstylecollective.com (activate now)
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

// ─── Static catalog scoring (fallback) ───────────────────────────────────────

function scoreStaticProduct(product: CatalogProduct, ctx: UserContext): number {
  let score = 0;
  if (product.archetypes.includes(ctx.topArchetype.toLowerCase())) score += 40;
  else if (product.archetypes.includes('all')) score += 15;
  if (product.budgetLevels.includes('all') || product.budgetLevels.includes(ctx.budgetLevel)) score += 30;
  const [fMin, fMax] = product.formalityRange;
  if (ctx.avgFormalityLevel >= fMin && ctx.avgFormalityLevel <= fMax) score += 20;
  else if (Math.abs(ctx.avgFormalityLevel - (fMin + fMax) / 2) <= 1) score += 10;
  if (ctx.topOccasions.some(o => product.occasions.map(p => p.toLowerCase()).includes(o.toLowerCase()))) score += 10;
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
    affiliateUrl: wrapWithSkimlinks(product.merchantUrl),
    relevanceReason,
    source: 'catalog',
  };
}

function sourceToAffiliateProduct(product: SourceProduct, ctx: UserContext): AffiliateProduct {
  // ShopStyle handles its own affiliate tracking — don't double-wrap
  const affiliateUrl = product.source === 'shopstyle'
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

  let products: AffiliateProduct[] = [];

  // ── Try live API sources first ─────────────────────────────────────────────
  const hasLiveSource = process.env.SHOPSTYLE_API_KEY || process.env.SKIMLINKS_PRODUCT_API_KEY;

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
    const liveStatic = AFFILIATE_CATALOG.filter(p => !p.isPlaceholder && p.imageUrl);
    if (liveStatic.length === 0) return null; // catalog not populated yet

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
  await prisma.affiliateImpression.updateMany({
    where: { id: impressionId, userId, clickedId: null },
    data: { clickedId: productId, clickedAt: new Date() },
  });

  trackServerEvent(userId, 'affiliate_click', { impressionId, productId });
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
