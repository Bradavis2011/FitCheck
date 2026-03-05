/**
 * Product Sources Service
 *
 * Provides a unified product search interface across multiple affiliate APIs.
 * Sources are tried in priority order; first one with results wins.
 *
 * Priority:
 *   1. ShopStyle Collective API  — fashion-first, free, sign up at shopstylecollective.com
 *   2. Skimlinks Product API     — pending approval (SKIMLINKS_PUBLISHER_ID set but no product API yet)
 *   3. Static catalog fallback   — affiliate-catalog.ts (manual entries)
 *
 * Activation:
 *   - ShopStyle: set SHOPSTYLE_API_KEY → auto-activates
 *   - Skimlinks Product API: set SKIMLINKS_PRODUCT_API_KEY when approved → auto-activates
 *   - Amazon PA-API: set AMAZON_PA_ACCESS_KEY + AMAZON_PA_SECRET_KEY + AMAZON_PA_PARTNER_TAG
 */

export interface SourceProduct {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;         // Ready-to-use affiliate URL (pre-wrapped)
  originalUrl: string;          // Original merchant URL
  source: 'shopstyle' | 'cj' | 'skimlinks' | 'amazon' | 'catalog';
}

// ─── Search query builder ─────────────────────────────────────────────────────
// Converts StyleDNA + occasion into keyword queries for product APIs

interface SearchContext {
  styleArchetypes: string[];
  dominantColors: string[];
  garments: string[];
  formalityLevel: number;
  occasions: string[];
  budgetLevel: string;          // 'budget' | 'mid-range' | 'investment'
  outfitScore: number;
  feedbackText?: string;        // e.g. "consider adding a structured layer"
}

interface PriceRange {
  min: number;
  max: number;
}

function budgetToPriceRange(budgetLevel: string): PriceRange {
  switch (budgetLevel) {
    case 'budget':     return { min: 10,  max: 75  };
    case 'investment': return { min: 150, max: 800 };
    default:           return { min: 40,  max: 200 }; // mid-range
  }
}

// Maps archetypes to ShopStyle category slugs
const ARCHETYPE_CATEGORIES: Record<string, string[]> = {
  minimalist:  ['womens-blazers', 'womens-trousers', 'womens-tshirts'],
  classic:     ['womens-blazers', 'womens-skirts', 'womens-blouses'],
  streetwear:  ['womens-hoodies', 'womens-sneakers', 'womens-joggers'],
  maximalist:  ['womens-dresses', 'womens-statement-tops', 'womens-heels'],
  romantic:    ['womens-dresses', 'womens-blouses', 'womens-skirts'],
  bohemian:    ['womens-dresses', 'womens-tops', 'womens-sandals'],
  preppy:      ['womens-blazers', 'womens-polos', 'womens-loafers'],
  edgy:        ['womens-jackets', 'womens-boots', 'womens-graphic-tees'],
};

// Occasion → search modifier
const OCCASION_MODIFIERS: Record<string, string> = {
  work:             'office professional',
  'business casual': 'smart casual work',
  date:             'chic feminine',
  'date night':     'evening chic',
  casual:           'everyday casual',
  weekend:          'casual weekend',
  wedding:          'wedding guest formal',
  party:            'cocktail party',
  vacation:         'resort vacation',
  brunch:           'brunch casual',
  gym:              'athletic activewear',
};

export function buildSearchQueries(ctx: SearchContext): string[] {
  const queries: string[] = [];
  const topArchetype = ctx.styleArchetypes[0] ?? 'minimalist';
  const topOccasion = ctx.occasions[0] ?? 'casual';
  const occasionMod = OCCASION_MODIFIERS[topOccasion.toLowerCase()] ?? topOccasion;

  // Primary: archetype + occasion blend
  queries.push(`${topArchetype} ${occasionMod} outfit`);

  // Secondary: complement what AI said to improve
  if (ctx.feedbackText) {
    const structuredLayerMatch = /structured layer|blazer|jacket/i.test(ctx.feedbackText);
    const shoeMatch = /shoes|footwear|boots|sneakers/i.test(ctx.feedbackText);
    const colorMatch = /color|tone|palette/i.test(ctx.feedbackText);

    if (structuredLayerMatch) queries.push(`${topArchetype} blazer jacket`);
    if (shoeMatch) queries.push(`${topArchetype} shoes ${topOccasion}`);
    if (colorMatch && ctx.dominantColors[0]) queries.push(`${ctx.dominantColors[0]} ${topArchetype} outfit`);
  }

  // Tertiary: garment-specific complement
  // If user has a blazer, suggest bottoms. If they have jeans, suggest tops.
  const hasBottoms = ctx.garments.some(g => /trouser|jean|skirt|pant|short/i.test(g));
  const hasTops = ctx.garments.some(g => /shirt|blouse|top|tee|sweater|jacket|blazer/i.test(g));
  const hasShoes = ctx.garments.some(g => /shoe|boot|sneaker|heel|sandal/i.test(g));

  if (hasBottoms && !hasTops) queries.push(`${topArchetype} ${occasionMod} top blouse`);
  if (hasTops && !hasBottoms) queries.push(`${topArchetype} ${occasionMod} trousers skirt`);
  if (!hasShoes) queries.push(`${topArchetype} shoes ${topOccasion}`);

  return queries.slice(0, 3); // max 3 queries to keep latency low
}

// ─── ShopStyle Collective API ─────────────────────────────────────────────────
// Sign up: https://shopstylecollective.com
// Docs:    https://api.shopstyle.com/api/v2/docs
// Free plan includes product search, images, prices, auto-affiliate links

const SHOPSTYLE_BASE = 'https://api.shopstyle.com/api/v2';

interface ShopStyleProduct {
  id: string;
  name: string;
  brand?: { name: string };
  price: number;
  salePrice?: number;
  currency?: string;
  image?: { sizes?: { IPhone?: { url: string }; Best?: { url: string } } };
  clickUrl: string;     // ShopStyle's pre-built affiliate URL
  categories?: Array<{ id: string; name: string }>;
}

interface ShopStyleResponse {
  products?: ShopStyleProduct[];
}

export async function searchShopStyle(
  queries: string[],
  priceRange: PriceRange,
  limit = 8,
): Promise<SourceProduct[]> {
  const apiKey = process.env.SHOPSTYLE_API_KEY;
  if (!apiKey) return [];

  const results: SourceProduct[] = [];

  for (const query of queries) {
    if (results.length >= limit) break;

    try {
      const params = new URLSearchParams({
        pid: apiKey,
        q: query,
        min: priceRange.min.toString(),
        max: priceRange.max.toString(),
        limit: Math.min(4, limit - results.length).toString(),
        format: 'json',
      });

      const res = await fetch(`${SHOPSTYLE_BASE}/products?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data: ShopStyleResponse = await res.json();
      const products = data.products ?? [];

      for (const p of products) {
        const imageUrl = p.image?.sizes?.IPhone?.url ?? p.image?.sizes?.Best?.url ?? '';
        if (!imageUrl || !p.clickUrl) continue;

        results.push({
          id: `shopstyle-${p.id}`,
          title: p.name,
          brand: p.brand?.name ?? 'Unknown',
          category: p.categories?.[0]?.name ?? 'fashion',
          price: p.salePrice ?? p.price,
          currency: p.currency ?? 'USD',
          imageUrl,
          affiliateUrl: p.clickUrl,   // ShopStyle handles affiliate tracking
          originalUrl: p.clickUrl,
          source: 'shopstyle',
        });
      }
    } catch (err) {
      console.warn('[ProductSources] ShopStyle query failed:', err);
    }
  }

  return results;
}

// ─── Skimlinks Product API ────────────────────────────────────────────────────
// Available from Skimlinks Publisher Hub after account approval.
// Set SKIMLINKS_PRODUCT_API_KEY once you receive it.
// This slot is pre-wired — just set the env var to activate.

export async function searchSkimlinks(
  queries: string[],
  priceRange: PriceRange,
  limit = 8,
): Promise<SourceProduct[]> {
  const apiKey = process.env.SKIMLINKS_PRODUCT_API_KEY;
  const pubId  = process.env.SKIMLINKS_PUBLISHER_ID;
  if (!apiKey || !pubId) return []; // not yet approved — skip silently

  // Skimlinks Product API endpoint — available from Publisher Hub
  // Docs: https://publisher.skimlinks.com — API section
  const results: SourceProduct[] = [];

  for (const query of queries) {
    if (results.length >= limit) break;

    try {
      const params = new URLSearchParams({
        query,
        min_price: priceRange.min.toString(),
        max_price: priceRange.max.toString(),
        limit: Math.min(4, limit - results.length).toString(),
      });

      const res = await fetch(`https://api.skimlinks.com/products/search?${params}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = await res.json() as { products?: any[] };

      for (const p of (data.products ?? [])) {
        const merchantUrl: string = p.url ?? p.merchant_url ?? '';
        if (!merchantUrl || !p.image) continue;

        results.push({
          id: `skim-${p.id ?? Math.random()}`,
          title: p.name ?? p.title,
          brand: p.brand ?? p.merchant ?? 'Unknown',
          category: p.category ?? 'fashion',
          price: parseFloat(p.price ?? '0'),
          currency: p.currency ?? 'USD',
          imageUrl: p.image,
          affiliateUrl: `https://go.skimresources.com?id=${pubId}&url=${encodeURIComponent(merchantUrl)}`,
          originalUrl: merchantUrl,
          source: 'skimlinks',
        });
      }
    } catch (err) {
      console.warn('[ProductSources] Skimlinks query failed:', err);
    }
  }

  return results;
}

// ─── CJ Affiliate Product Catalog API ────────────────────────────────────────
// Sign up at cj.com as Publisher. Apply to individual merchant programs.
// Once approved by merchants, set CJ_API_KEY from Account > API Keys.
// Docs: https://developers.cj.com/docs/product-catalog/product-catalog-overview
//
// Env vars:
//   CJ_API_KEY          — from cj.com Account > API Keys
//   CJ_WEBSITE_ID       — your website/property ID in CJ (found in Account settings)
//
// Good fashion merchants to apply for on CJ:
//   Nordstrom, Macy's, Nike, ASOS, H&M, Levi's, Anthropologie, Gap, Banana Republic

const CJ_GRAPHQL = 'https://ads.api.cj.com/query';

export async function searchCJ(
  queries: string[],
  priceRange: PriceRange,
  limit = 8,
): Promise<SourceProduct[]> {
  const apiKey    = process.env.CJ_API_KEY;
  const websiteId = process.env.CJ_WEBSITE_ID;
  if (!apiKey || !websiteId) return [];

  const results: SourceProduct[] = [];

  for (const query of queries) {
    if (results.length >= limit) break;

    // CJ uses a GraphQL API for product catalog search
    const gql = `{
      products(
        websiteId: "${websiteId}"
        keywords: "${query.replace(/"/g, '')}"
        minPrice: "${priceRange.min}"
        maxPrice: "${priceRange.max}"
        limit: ${Math.min(4, limit - results.length)}
      ) {
        resultList {
          id
          title
          description
          imageLink
          link
          price
          salePrice
          brand
          productType
          currency
        }
      }
    }`;

    try {
      const res = await fetch(CJ_GRAPHQL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: gql }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const json = await res.json() as { data?: { products?: { resultList?: any[] } } };
      const items = json.data?.products?.resultList ?? [];

      for (const p of items) {
        if (!p.imageLink || !p.link) continue;
        results.push({
          id: `cj-${p.id}`,
          title: p.title,
          brand: p.brand ?? 'Unknown',
          category: p.productType ?? 'fashion',
          price: parseFloat(p.salePrice ?? p.price ?? '0'),
          currency: p.currency ?? 'USD',
          imageUrl: p.imageLink,
          affiliateUrl: p.link,   // CJ link already includes affiliate tracking
          originalUrl: p.link,
          source: 'cj',
        });
      }
    } catch (err) {
      console.warn('[ProductSources] CJ query failed:', err);
    }
  }

  return results;
}

// ─── Main: fetch from all sources, deduplicate ────────────────────────────────

export async function fetchProducts(
  ctx: SearchContext,
  limit = 4,
): Promise<SourceProduct[]> {
  const priceRange = budgetToPriceRange(ctx.budgetLevel);
  const queries = buildSearchQueries(ctx);

  // All sources run in parallel — first results win after dedup
  const [shopStyleResults, cjResults, skimlinkResults] = await Promise.all([
    searchShopStyle(queries, priceRange, limit * 2),
    searchCJ(queries, priceRange, limit * 2),
    searchSkimlinks(queries, priceRange, limit * 2),
  ]);

  // Merge priority: ShopStyle → CJ → Skimlinks, deduplicate by title prefix
  const merged: SourceProduct[] = [];
  const seenTitles = new Set<string>();

  for (const product of [...shopStyleResults, ...cjResults, ...skimlinkResults]) {
    const titleKey = product.title.toLowerCase().replace(/\s+/g, '').slice(0, 20);
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    merged.push(product);
    if (merged.length >= limit) break;
  }

  return merged;
}
