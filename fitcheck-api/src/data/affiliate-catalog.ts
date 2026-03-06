/**
 * Affiliate Product Catalog — Or This?
 *
 * Static product catalog used as a fallback when live API sources (CJ, Skimlinks) have
 * no results. Products here are hand-curated Amazon SiteStripe affiliate links.
 *
 * TO ADD MORE PRODUCTS:
 * 1. Get a SiteStripe link from Amazon (amzn.to short link)
 * 2. Set affiliateUrl AND merchantUrl to the amzn.to link
 * 3. Image URL: fetch the Amazon page — og:image in the HTML head has the CDN URL
 * 4. Set isPlaceholder: false to go live immediately
 *
 * AFFILIATE TRACKING:
 * - Amazon SiteStripe (amzn.to) links are already affiliate-tracked — do NOT wrap with Skimlinks
 * - Set affiliateUrl = the amzn.to link; Skimlinks wrapping is bypassed automatically
 * - For non-Amazon entries: leave affiliateUrl undefined — Skimlinks wraps merchantUrl
 *
 * EXCLUDED LINKS (off-brand / fast-fashion):
 * - amzn.to/3OO0PhD  — "People Free Dup ES" knockoff
 * - amzn.to/4uePHdF  — unknown brand boho tank
 * - amzn.to/4aQG79m  — Zwurew (unknown)
 * - amzn.to/4aYDyRe  — Mostrin (unknown)
 * - amzn.to/4rkZpZr  — CUSHIONAIRE (comfort, not editorial)
 * - amzn.to/4rfWwZR  — BPJZIM (fast fashion)
 * - amzn.to/4ldlgAr  — PRETTYGARDEN (fast fashion)
 */

export interface CatalogProduct {
  id: string;
  title: string;
  brand: string;
  category: 'tops' | 'bottoms' | 'shoes' | 'accessories' | 'outerwear' | 'bags' | 'dresses' | 'activewear';
  merchantUrl: string;
  affiliateUrl?: string;       // Pre-built affiliate URL — used as-is, bypasses Skimlinks wrapping
  price: number;               // Verify on Amazon periodically — prices change
  currency: string;
  archetypes: string[];
  budgetLevels: string[];      // 'budget' | 'mid-range' | 'investment' | 'all'
  formalityRange: [number, number]; // [min, max] 1–5
  occasions: string[];
  imageUrl: string;
  isPlaceholder: boolean;
}

export const AFFILIATE_CATALOG: CatalogProduct[] = [

  // ─── BAGS ──────────────────────────────────────────────────────────────────

  {
    id: 'amz-mk-wristlet-luggage',
    title: 'Michael Kors Jet Set Charm Medium Top-Zip Wristlet',
    brand: 'Michael Kors',
    category: 'bags',
    merchantUrl: 'https://amzn.to/47qO6HS',
    affiliateUrl: 'https://amzn.to/47qO6HS',
    price: 118,
    currency: 'USD',
    archetypes: ['classic', 'minimalist', 'preppy'],
    budgetLevels: ['mid-range', 'investment'],
    formalityRange: [2, 5],
    occasions: ['date night', 'work', 'party', 'brunch', 'casual'],
    imageUrl: 'https://m.media-amazon.com/images/I/81zIIBaclYL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-mk-card-case-pink',
    title: 'Michael Kors Jet Set Small Zip Around Card Case',
    brand: 'Michael Kors',
    category: 'bags',
    merchantUrl: 'https://amzn.to/47t6Q9H',
    affiliateUrl: 'https://amzn.to/47t6Q9H',
    price: 78,
    currency: 'USD',
    archetypes: ['classic', 'minimalist', 'romantic'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 5],
    occasions: ['casual', 'brunch', 'date night', 'work'],
    imageUrl: 'https://m.media-amazon.com/images/I/61JaOMZj8bL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  // ─── SHOES ─────────────────────────────────────────────────────────────────

  {
    id: 'amz-ks-deco-bow-flat-black',
    title: 'Kate Spade Deco Bow Smooth Leather Flat',
    brand: 'Kate Spade',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/46LO4Kt',
    affiliateUrl: 'https://amzn.to/46LO4Kt',
    price: 178,
    currency: 'USD',
    archetypes: ['preppy', 'romantic', 'classic'],
    budgetLevels: ['investment'],
    formalityRange: [3, 5],
    occasions: ['work', 'date night', 'brunch', 'party', 'formal'],
    imageUrl: 'https://m.media-amazon.com/images/I/61Z8DpOF62L._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-vince-daniela-mary-jane',
    title: "Vince Women's Daniela Mary Jane Flat",
    brand: 'Vince',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4rS6f9H',
    affiliateUrl: 'https://amzn.to/4rS6f9H',
    price: 248,
    currency: 'USD',
    archetypes: ['minimalist', 'classic'],
    budgetLevels: ['investment'],
    formalityRange: [3, 5],
    occasions: ['work', 'date night', 'brunch', 'party'],
    imageUrl: 'https://m.media-amazon.com/images/I/61QZbc3U2gL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-tory-burch-miller-sandal',
    title: "Tory Burch Women's Miller Sandals",
    brand: 'Tory Burch',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/3NhJvky',
    affiliateUrl: 'https://amzn.to/3NhJvky',
    price: 218,
    currency: 'USD',
    archetypes: ['preppy', 'classic', 'minimalist'],
    budgetLevels: ['investment'],
    formalityRange: [2, 4],
    occasions: ['casual', 'weekend', 'brunch', 'vacation', 'date night'],
    imageUrl: 'https://m.media-amazon.com/images/I/812hprjsXbL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-vc-elvin-platform-bootie',
    title: "Vince Camuto Women's Elvin Platform Ankle Bootie",
    brand: 'Vince Camuto',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4la69ry',
    affiliateUrl: 'https://amzn.to/4la69ry',
    price: 99,
    currency: 'USD',
    archetypes: ['edgy', 'classic', 'minimalist'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 4],
    occasions: ['casual', 'date night', 'weekend', 'work'],
    imageUrl: 'https://m.media-amazon.com/images/I/71Oi78s8qrL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-vc-saprenda-strappy-sandal',
    title: "Vince Camuto Women's Saprenda Strappy Heeled Sandal",
    brand: 'Vince Camuto',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4rQ2OjT',
    affiliateUrl: 'https://amzn.to/4rQ2OjT',
    price: 89,
    currency: 'USD',
    archetypes: ['romantic', 'classic'],
    budgetLevels: ['mid-range'],
    formalityRange: [3, 5],
    occasions: ['date night', 'party', 'wedding', 'brunch'],
    imageUrl: 'https://m.media-amazon.com/images/I/61VWTiGoFCL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-vc-retsie-pump',
    title: "Vince Camuto Women's Retsie Pointed Toe Pump",
    brand: 'Vince Camuto',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4ldkVxF',
    affiliateUrl: 'https://amzn.to/4ldkVxF',
    price: 89,
    currency: 'USD',
    archetypes: ['classic', 'minimalist'],
    budgetLevels: ['mid-range'],
    formalityRange: [3, 5],
    occasions: ['work', 'date night', 'party', 'interview'],
    imageUrl: 'https://m.media-amazon.com/images/I/71L56VBLVfL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-vc-sangeti-knee-boot',
    title: "Vince Camuto Women's Sangeti Stacked Heel Knee High Boot",
    brand: 'Vince Camuto',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4uatvkY',
    affiliateUrl: 'https://amzn.to/4uatvkY',
    price: 129,
    currency: 'USD',
    archetypes: ['classic', 'edgy', 'minimalist'],
    budgetLevels: ['mid-range', 'investment'],
    formalityRange: [2, 4],
    occasions: ['casual', 'date night', 'work', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/61pVEVdXQcL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-se-hazel-pump',
    title: "Sam Edelman Women's Hazel Pump",
    brand: 'Sam Edelman',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4ldGmyR',
    affiliateUrl: 'https://amzn.to/4ldGmyR',
    price: 90,
    currency: 'USD',
    archetypes: ['classic', 'minimalist'],
    budgetLevels: ['mid-range'],
    formalityRange: [3, 5],
    occasions: ['work', 'date night', 'party', 'interview'],
    imageUrl: 'https://m.media-amazon.com/images/I/71C8CE2sI5L._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-se-taylin-knee-boot',
    title: "Sam Edelman Women's Taylin Knee High Boot",
    brand: 'Sam Edelman',
    category: 'shoes',
    merchantUrl: 'https://amzn.to/4d33w8S',
    affiliateUrl: 'https://amzn.to/4d33w8S',
    price: 120,
    currency: 'USD',
    archetypes: ['classic', 'edgy', 'minimalist'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 4],
    occasions: ['casual', 'date night', 'work', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/61796dpU8gL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  // ─── BOTTOMS ───────────────────────────────────────────────────────────────

  {
    id: 'amz-levis-ribcage-full-length',
    title: "Levi's Women's Ribcage Full Length Jeans",
    brand: "Levi's",
    category: 'bottoms',
    merchantUrl: 'https://amzn.to/3P3CW5z',
    affiliateUrl: 'https://amzn.to/3P3CW5z',
    price: 79,
    currency: 'USD',
    archetypes: ['minimalist', 'classic', 'streetwear'],
    budgetLevels: ['mid-range'],
    formalityRange: [1, 3],
    occasions: ['casual', 'weekend', 'brunch'],
    imageUrl: 'https://m.media-amazon.com/images/I/81GePWHqNOL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-levis-501-90s-womens',
    title: "Levi's Women's 501 '90s Jeans",
    brand: "Levi's",
    category: 'bottoms',
    merchantUrl: 'https://amzn.to/46N4L8u',
    affiliateUrl: 'https://amzn.to/46N4L8u',
    price: 79,
    currency: 'USD',
    archetypes: ['streetwear', 'casual', 'minimalist'],
    budgetLevels: ['mid-range'],
    formalityRange: [1, 3],
    occasions: ['casual', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/71BqsQ0UEUL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-levis-501-mens-rigid',
    title: "Levi's Men's 501 Original Shrink-to-Fit Jeans",
    brand: "Levi's",
    category: 'bottoms',
    merchantUrl: 'https://amzn.to/4udGhPC',
    affiliateUrl: 'https://amzn.to/4udGhPC',
    price: 69,
    currency: 'USD',
    archetypes: ['streetwear', 'casual', 'classic'],
    budgetLevels: ['mid-range'],
    formalityRange: [1, 2],
    occasions: ['casual', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/51sY1YmXtRL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  // ─── TOPS ──────────────────────────────────────────────────────────────────

  {
    id: 'amz-fp-opal-sweater',
    title: 'Free People Opal Sweater',
    brand: 'Free People',
    category: 'tops',
    merchantUrl: 'https://amzn.to/4s0YfUe',
    affiliateUrl: 'https://amzn.to/4s0YfUe',
    price: 108,
    currency: 'USD',
    archetypes: ['bohemian', 'romantic'],
    budgetLevels: ['mid-range'],
    formalityRange: [2, 3],
    occasions: ['casual', 'weekend', 'brunch'],
    imageUrl: 'https://m.media-amazon.com/images/I/71tOivEMtML._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-fp-wait-a-minute-tee',
    title: 'Free People Wait A Minute Baby Tee',
    brand: 'Free People',
    category: 'tops',
    merchantUrl: 'https://amzn.to/4la5SF2',
    affiliateUrl: 'https://amzn.to/4la5SF2',
    price: 42,
    currency: 'USD',
    archetypes: ['bohemian', 'romantic', 'streetwear'],
    budgetLevels: ['budget', 'mid-range'],
    formalityRange: [1, 2],
    occasions: ['casual', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/61lQA3p594L._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  // ─── OUTERWEAR ─────────────────────────────────────────────────────────────

  {
    id: 'amz-fp-birdie-denim-jacket',
    title: 'Free People Birdie Denim Jacket',
    brand: 'Free People',
    category: 'outerwear',
    merchantUrl: 'https://amzn.to/4cverIr',
    affiliateUrl: 'https://amzn.to/4cverIr',
    price: 128,
    currency: 'USD',
    archetypes: ['bohemian', 'streetwear', 'casual'],
    budgetLevels: ['mid-range'],
    formalityRange: [1, 3],
    occasions: ['casual', 'weekend', 'brunch'],
    imageUrl: 'https://m.media-amazon.com/images/I/41YP2aV6nRL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  // ─── DRESSES ───────────────────────────────────────────────────────────────

  {
    id: 'amz-the-drop-luna-linen-maxi',
    title: "The Drop Women's Luna Scoop Neck Linen Maxi Dress",
    brand: 'The Drop',
    category: 'dresses',
    merchantUrl: 'https://amzn.to/46I4zXY',
    affiliateUrl: 'https://amzn.to/46I4zXY',
    price: 55,
    currency: 'USD',
    archetypes: ['minimalist', 'romantic', 'bohemian'],
    budgetLevels: ['budget', 'mid-range'],
    formalityRange: [2, 4],
    occasions: ['vacation', 'casual', 'brunch', 'date night'],
    imageUrl: 'https://m.media-amazon.com/images/I/61WwJba4faL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

  {
    id: 'amz-ae-fit-flare-midi-stripe',
    title: "Amazon Essentials Women's Fit and Flare Midi Dress",
    brand: 'Amazon Essentials',
    category: 'dresses',
    merchantUrl: 'https://amzn.to/4rfXaGL',
    affiliateUrl: 'https://amzn.to/4rfXaGL',
    price: 32,
    currency: 'USD',
    archetypes: ['classic', 'preppy'],
    budgetLevels: ['budget'],
    formalityRange: [2, 4],
    occasions: ['casual', 'brunch', 'weekend'],
    imageUrl: 'https://m.media-amazon.com/images/I/41fRhC56ktL._AC_SL1500_.jpg',
    isPlaceholder: false,
  },

];
