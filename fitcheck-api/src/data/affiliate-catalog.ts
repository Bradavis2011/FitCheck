/**
 * Affiliate Product Catalog
 *
 * HOW TO POPULATE:
 * 1. Sign up at https://skimlinks.com as a Publisher
 * 2. Browse your Skimlinks merchant dashboard for approved merchants
 * 3. Find specific product URLs on each merchant's site
 * 4. Replace entries below with real products from approved merchants
 * 5. Remove `isPlaceholder: true` when a product is ready for production
 * 6. Set SKIMLINKS_PUBLISHER_ID in your Railway env vars
 *
 * Products with isPlaceholder: true are NEVER shown to users.
 */

export interface CatalogProduct {
  id: string;
  title: string;
  brand: string;
  category: 'tops' | 'bottoms' | 'shoes' | 'accessories' | 'outerwear' | 'bags' | 'dresses' | 'activewear';
  merchantUrl: string;         // Original product URL — will be wrapped with Skimlinks
  price: number;
  currency: string;
  archetypes: string[];        // Which style archetypes this suits (from StyleDNA.styleArchetypes)
  budgetLevels: string[];      // 'budget' | 'mid-range' | 'investment' | 'all'
  formalityRange: [number, number]; // [min, max] formalityLevel 1-5 this suits
  occasions: string[];         // Occasion tags matching OutfitCheck.occasions
  imageUrl: string;            // Direct image URL (hosted on brand CDN or your own CDN)
  isPlaceholder: boolean;      // true = never shown to users, needs real product data
}

export const AFFILIATE_CATALOG: CatalogProduct[] = [
  // ─── MINIMALIST / CLASSIC ────────────────────────────────────────────────────
  // PLACEHOLDER — replace with real Everlane product from Skimlinks merchant dashboard
  {
    id: 'placeholder-min-001',
    title: 'Clean-cut blazer (add real product)',
    brand: 'Everlane',
    category: 'outerwear',
    merchantUrl: 'https://www.everlane.com/collections/womens-blazers',
    price: 0,
    currency: 'USD',
    archetypes: ['minimalist', 'classic'],
    budgetLevels: ['mid-range'],
    formalityRange: [3, 5],
    occasions: ['work', 'business casual', 'interview'],
    imageUrl: '',
    isPlaceholder: true,
  },
  {
    id: 'placeholder-min-002',
    title: 'Tailored trousers (add real product)',
    brand: 'COS',
    category: 'bottoms',
    merchantUrl: 'https://www.cos.com',
    price: 0,
    currency: 'USD',
    archetypes: ['minimalist', 'preppy'],
    budgetLevels: ['mid-range'],
    formalityRange: [3, 5],
    occasions: ['work', 'business casual'],
    imageUrl: '',
    isPlaceholder: true,
  },

  // ─── STREETWEAR ────────────────────────────────────────────────────────────
  {
    id: 'placeholder-street-001',
    title: 'Oversized graphic tee (add real product)',
    brand: 'ASOS',
    category: 'tops',
    merchantUrl: 'https://www.asos.com',
    price: 0,
    currency: 'USD',
    archetypes: ['streetwear', 'edgy', 'maximalist'],
    budgetLevels: ['budget', 'mid-range'],
    formalityRange: [1, 2],
    occasions: ['casual', 'weekend', 'concert'],
    imageUrl: '',
    isPlaceholder: true,
  },

  // ─── ROMANTIC / BOHEMIAN ──────────────────────────────────────────────────
  {
    id: 'placeholder-rom-001',
    title: 'Flowy midi dress (add real product)',
    brand: 'Free People',
    category: 'dresses',
    merchantUrl: 'https://www.freepeople.com',
    price: 0,
    currency: 'USD',
    archetypes: ['romantic', 'bohemian'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 4],
    occasions: ['date night', 'weekend', 'brunch', 'vacation'],
    imageUrl: '',
    isPlaceholder: true,
  },

  // ─── PREPPY ───────────────────────────────────────────────────────────────
  {
    id: 'placeholder-prep-001',
    title: 'Striped oxford shirt (add real product)',
    brand: 'J.Crew',
    category: 'tops',
    merchantUrl: 'https://www.jcrew.com',
    price: 0,
    currency: 'USD',
    archetypes: ['preppy', 'classic'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 4],
    occasions: ['casual', 'brunch', 'work', 'weekend'],
    imageUrl: '',
    isPlaceholder: true,
  },

  // ─── EDGY ─────────────────────────────────────────────────────────────────
  {
    id: 'placeholder-edgy-001',
    title: 'Structured leather jacket (add real product)',
    brand: 'AllSaints',
    category: 'outerwear',
    merchantUrl: 'https://www.allsaints.com',
    price: 0,
    currency: 'USD',
    archetypes: ['edgy', 'streetwear', 'maximalist'],
    budgetLevels: ['mid-range', 'investment'],
    formalityRange: [1, 3],
    occasions: ['casual', 'concert', 'night out'],
    imageUrl: '',
    isPlaceholder: true,
  },
];
