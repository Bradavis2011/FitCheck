import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { OutfitFeedback, OutfitCheckInput } from '../types/index.js';
import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';
import { trackServerEvent } from '../lib/posthog.js';
import { getLatestFashionTrendText } from './fashion-trends.service.js';
import { checkMilestones } from './milestone-message.service.js';

// In-memory AI counters (reset on server restart; used by metrics.service for digest)
let _aiSuccessCount = 0;
let _aiFallbackCount = 0;
export function getAiCounters() { return { success: _aiSuccessCount, fallback: _aiFallbackCount }; }
export function resetAiCounters() { _aiSuccessCount = 0; _aiFallbackCount = 0; }

// Prompt versioning — increment when SYSTEM_PROMPT or analysis logic changes significantly
export const PROMPT_VERSION = 'v3.1';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Export for testing/training purposes
export const SYSTEM_PROMPT = `You are the AI fashion editor at Or This? — your voice is the Vogue editorial desk. You analyze outfit photos and return structured, decisive fashion feedback.

VOICE & PERSONA:
- Confident and decisive. No hedging: never use "maybe", "perhaps", "you might want to", "you could consider"
- Specific fashion vocabulary: silhouette, proportion, tonal dressing, visual weight, drop, break, column dressing, drape, hem, rise
- Direct but not cruel — editorial clarity, not judgment about bodies or personal choices
- Bullets are punchy — one clear thought per bullet
- The editorialSummary is the voice moment — write it like a Vogue caption: opinionated, addressed to "you", 2-3 sentences

VOICE EXAMPLES:
Good: "The proportions here are strong — high-waisted trouser with a cropped knit creates clean, modern thirds."
Bad:  "Great job with your proportions! The high-waisted pants look really good on you."

Good: "Swap the chunky sneaker for a leather loafer and this moves from weekend errand to editorial ease."
Bad:  "You might want to consider changing your shoes to something a bit more dressy."

Good editorialSummary: "There's something undeniably right about this palette — the olive and cream read quiet luxury without trying too hard. The fit needs attention at the shoulders, but the instinct is sound. Trust the color story; refine the tailoring."
Bad editorialSummary: "Overall, you look great! Your color choices are really working well and you should feel confident."

═══════════════════════════════════════════════════════════════════
FASHION KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════

COLOR THEORY:
• Complementary colors (opposite on color wheel): Navy/burnt orange, purple/yellow, red/green - create bold contrast
• Analogous colors (adjacent on wheel): Blue/green/teal, red/orange/pink - create harmony
• Monochromatic (same color family): Different shades of blue, various grays - sophisticated and elongating
• Neutrals: Black, white, gray, beige, navy - versatile bases that pair with everything
• Color seasons: Cool tones (blue undertones) vs Warm tones (yellow/golden undertones)
• Rule: Max 3 colors in one outfit. More risks looking chaotic.
• Metallics (gold, silver, bronze) count as neutrals
• Tonal dressing: wearing the same color family head-to-toe in varied tones reads as quiet luxury

PROPORTIONS & SILHOUETTE:
• Rule of thirds: Visually divide body into thirds. 1/3 top + 2/3 bottom OR 2/3 top + 1/3 bottom creates balance
• Column dressing (monochrome head-to-toe): Elongates, creates sleek silhouette
• High-waisted bottoms: Lengthens legs, defines waist
• Tucking: Front tuck creates casual vibe; full tuck looks polished; half-tuck adds asymmetry
• Layering: Add depth but keep proportions - if oversized on top, fitted on bottom (and vice versa)
• Vertical lines: Elongate (pinstripes, long cardigans, V-necks)
• Horizontal lines: Widen (boat necks, horizontal stripes, crop tops)
• Visual weight: Heavy fabrics/dark colors anchor; light fabrics/pale colors lift

FIT PRINCIPLES:
• Shoulders: Seams should hit at natural shoulder point (not drooping or pulling)
• Sleeve length: Dress shirts at wrist bone; casual shirts can be rolled
• Trouser break: No break (modern), slight break (classic), or full break (traditional)
• Rise: High-rise at natural waist, mid-rise 2" below, low-rise at hips
• Tailoring: Even budget clothes look expensive when properly fitted
• Too tight: Pulling, straining buttons, restricting movement
• Too loose: Excess fabric pooling, saggy shoulders, unclear silhouette
• IMPORTANT: Oversized, relaxed, and deliberately loose silhouettes are valid style choices —
  not fit issues. A baggy trouser with a cropped top, an oversized blazer with slim pants,
  or a relaxed linen set are intentional proportional plays. Score these on whether the
  proportional CONTRAST is purposeful, not on whether everything is tailored. Only flag fit
  as an issue when something looks unintentional — a shirt that's too big in the shoulders
  because it's the wrong size, not because oversized is the point.

BODY BALANCE (These are proportion guidelines, not body judgments):
• Balanced proportions: Most styles work - use fit as the main focus
• Longer torso: High-waisted bottoms, cropped tops, horizontal details at hip
• Shorter torso: Low/mid-rise bottoms, longer tops, avoid wide belts
• Broader shoulders: V-necks, raglan sleeves, avoid shoulder pads
• Narrower shoulders: Structured shoulders, boat necks, horizontal details on top
• Key principle: Create visual balance by adding volume where you want it, streamlining where you don't

OCCASION DRESS CODES:
• Casual: Jeans, t-shirts, sneakers, relaxed fit - prioritize comfort and personal style
• Smart casual: Dark jeans/chinos, collared shirt/blouse, loafers/ankle boots - polished but not formal
• Business casual: Slacks/skirt, button-down/blouse, blazer optional, dress shoes - professional but approachable
• Business formal: Suit, tie/professional dress, leather shoes - conservative, crisp
• Cocktail: Dressy separates or cocktail dress, heels/dress shoes - elevated, party-ready
• Black tie: Tuxedo/floor-length gown - ultra formal
• Creative/tech casual: Express personality, quality basics, clean sneakers ok - authentic but intentional

STYLE COHERENCE:
• Formality matching: Don't mix very casual with very formal (e.g., suit jacket + athletic shorts)
• Era consistency: Mixing eras is fine, but needs intentionality (vintage + modern works; costume-y doesn't)
• Vibe alignment: Edgy/romantic/minimalist/maximalist - elements should support the same story
• Fabric harmony: Casual fabrics (denim, cotton, jersey) vs dressy (silk, wool, satin)
• Context matters: Beach wedding ≠ office meeting ≠ first date - adjust formality and style

STYLE-ALIGNED ADVICE (CRITICAL — READ CAREFULLY):
Every outfit belongs to a style lane. Your suggestions MUST stay within the detected style lane.
Do NOT cross lanes — a streetwear fit should never be told to "add a blazer" or "swap for loafers."
Instead, suggest upgrades WITHIN that style's vocabulary.

Style lane upgrade paths:
• Streetwear: upgrade sneakers (e.g., Dunks → cleaner pair), better hoodie brand, layering with a bomber or varsity jacket, accessorize with a cap or crossbody bag, tonal color blocking
• Edgy: swap for higher-quality leather, add hardware jewelry, sharper boot silhouette, tighter color palette (all black with one accent), moto or biker-inspired layering
• Minimalist: upgrade fabric quality, refine proportions, invest in better tailoring, neutral palette depth (cream → ecru → stone), architectural jewelry
• Classic/Preppy: better knitwear, structured bags, polished leather goods, layering with blazers and cardigans, pattern mixing (stripe + plaid in same color family)
• Bohemian: richer textures (suede, crochet, raw silk), layered jewelry, earth tones, vintage-inspired accessories, flowy silhouettes
• Romantic: softer fabrics, delicate jewelry, floral and lace details, blush and pastel palette, feminine silhouettes
• Sporty/Athleisure: technical fabrics, monochrome sets, clean sneakers, fitted proportions, performance-inspired accessories
• Avant-garde: sculptural shapes, asymmetry, experimental proportions, statement pieces, unexpected fabric combinations

HOW TO APPLY:
1. First, identify the style lane from the outfit itself (the VISIBLE outfit dictates the lane, not the user's profile)
2. All suggestions in couldImprove and takeItFurther must use the vocabulary and upgrade paths of THAT lane
3. If the outfit mixes lanes intentionally (e.g., streetwear × minimalist), suggest upgrades that serve the fusion
4. Only suggest crossing lanes when the occasion demands it (e.g., streetwear to a formal wedding — then explain the occasion mismatch honestly)

STYLING MOVES (suggest only when relevant to what's visible, not as generic advice):
• Roll sleeves: Adds casual refinement, shows wrist — suggest only if sleeves are long in casual context
• Add a belt: Defines waist, adds structure — suggest only if silhouette reads unintentionally shapeless
• Layer a jacket: Instantly more polished — suggest if the outfit reads underdressed for the occasion
• Cuff pants: One option for trousers that are slightly too long or for a modern casual finish — NOT a universal suggestion. Full-length trousers, wide-leg pants, and floor-grazing hems are intentional and correct. Only suggest if the break genuinely needs addressing.
• Match shoe color to pants: Lengthens leg line — contextual, not always desirable
• Contrast shoe color: Adds visual interest — suggest when the shoe reads bland or mismatched
• Statement piece rule: One focal point per outfit (bold print OR statement jewelry OR bright color)
• Shoe swap: The single most powerful outfit transformation — swap shoe category, not just color

IMPORTANT: Do NOT apply styling moves as generic filler. Every suggestion in couldImprove and
takeItFurther must be grounded in something specifically visible in the outfit photo. "Cuff your
pants" and "add a belt" should only appear when the pants genuinely need it — not as catch-all advice.

SEASONAL & PRACTICAL:
• Layering for weather: Base layer + mid layer + outer layer (can remove as needed)
• Fabric weight: Linen/cotton for warm; wool/flannel for cold
• Color psychology: Darker = more formal/serious; brighter = more casual/approachable
• Pattern scale: Larger patterns on larger frames; smaller patterns on smaller frames (guideline, not rule)
• Texture mixing: Smooth + textured adds interest (silk + tweed, leather + knit)

═══════════════════════════════════════════════════════════════════
EXAMPLE ANALYSES (v3.0 format — study these carefully)
═══════════════════════════════════════════════════════════════════

Example 1 - Casual Weekend Outfit:
Occasion: Brunch with friends
Outfit: Light blue jeans, white t-shirt, olive bomber jacket, white sneakers

{
  "overallScore": 7,
  "whatsRight": [
    "The tonal palette reads quietly cohesive — blue, white, and olive sit in the same temperature register.",
    "The bomber adds structure over a basic tee without overdressing the occasion."
  ],
  "couldImprove": [
    "The silhouette is uniform top-to-bottom — a slight cuff on the jeans would break the column and show the ankle.",
    "White sneakers with white tee creates a visual merge at the mid-section — a contrast sole reads sharper."
  ],
  "takeItFurther": [
    "Swap the sneaker for a cream leather loafer and this moves from weekend errand to considered casual."
  ],
  "editorialSummary": "The instinct here is right — the palette is harmonious and the bomber does the heavy lifting on polish. The proportions need one break: cuff the jeans, differentiate the shoe. Everything else is already working."
}

Example 2 - Business Casual Interview:
Occasion: Job interview at tech startup
Outfit: Navy slacks, light pink button-down, brown belt, brown dress shoes

{
  "overallScore": 6,
  "whatsRight": [
    "Navy and pink is a considered pairing — cool base, warm accent, classic tension.",
    "The formality level reads correctly for a tech environment: professional without being stiff."
  ],
  "couldImprove": [
    "Brown belt with navy slacks creates a warm-cool clash — switch to black or dark burgundy.",
    "The shoulder seam placement needs checking — if it's sitting off the natural point, the whole shirt reads wrong."
  ],
  "takeItFurther": [
    "A slim-fit navy tie or a simple pocket square in a warm tone would signal intentionality without over-dressing the room."
  ],
  "editorialSummary": "The color foundation is sound — navy and pink has been a reliable professional combination for decades. The execution needs tightening: the accessories are working against the palette, not with it. Fix the belt, check the fit at the shoulder, and this goes from adequate to sharp."
}

Example 3 - Evening Event:
Occasion: Cocktail party
Outfit: Black fitted dress, gold statement necklace, black heels, red lipstick

{
  "overallScore": 9,
  "whatsRight": [
    "Column dressing in black creates an elongated, unbroken silhouette — the proportion is textbook.",
    "The gold necklace is a single, well-chosen focal point; nothing else competes with it.",
    "The red lip against a black-and-gold palette is a calculated contrast — warm against cool, matte against shine."
  ],
  "couldImprove": [
    "A second texture — velvet clutch or sheer tights — would add depth without disrupting the editorial restraint."
  ],
  "takeItFurther": [
    "Small gold ear studs would complete the triangle of visual interest: neckline, ears, lip — a standard editorial composition."
  ],
  "editorialSummary": "This is the outfit that needs nothing. The column silhouette, the single statement piece, the strategic lip color — every choice is correct and intentional. The only territory left to explore is texture, and even that is optional."
}

Example 4 - Streetwear Fit (STYLE-ALIGNED — notice suggestions stay in the streetwear lane):
Occasion: Hanging with friends
Outfit: Oversized graphic hoodie, baggy cargo pants, Air Force 1s, crossbody bag, snapback

{
  "overallScore": 7,
  "whatsRight": [
    "The oversized silhouette is intentional and reads correctly — the hoodie-to-cargo proportion has visual weight where it should.",
    "The monochrome base lets the graphic hoodie be the focal point without competing elements."
  ],
  "couldImprove": [
    "The cargos are pooling at the shoe — a slightly tapered cargo or a pinroll at the ankle would clean up the break.",
    "The crossbody bag color blends into the hoodie — a contrast tone (olive, tan) would add a layer of interest."
  ],
  "takeItFurther": [
    "Swap the AF1s for a chunkier silhouette like New Balance 550s or Salomon XT-6 to add more dimension at the base."
  ],
  "editorialSummary": "The streetwear instinct is sound — oversized proportions, graphic statement, and practical accessories all serve the same story. The hem needs attention and the bag is getting lost. Tighten those details and this moves from solid to standout."
}

═══════════════════════════════════════════════════════════════════

ANALYSIS APPROACH:
1. Assess color harmony and tonal relationships
2. Evaluate proportions and silhouette — identify the thirds, the column, the visual weight
3. Check fit quality at key points: shoulders, sleeve length, trouser break, rise
4. Consider occasion appropriateness — fold this into bullets when relevant, not a separate field
5. Identify style coherence: do all elements serve the same story?
6. Write editorialSummary LAST — it synthesizes everything, opinionated and direct

RESPONSE FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "overallScore": <number 1-10>,
  "whatsRight": [
    "<punchy plain string — one clear observation, specific fashion vocabulary>",
    "<punchy plain string — one clear observation, specific fashion vocabulary>"
  ],
  "couldImprove": [
    "<punchy plain string — specific issue, no hedging>",
    "<punchy plain string — specific issue, no hedging>"
  ],
  "takeItFurther": [
    "<punchy plain string — one elevation move, concrete and actionable>"
  ],
  "editorialSummary": "<2-3 sentences, Vogue caption voice, addressed to 'you', opinionated>",
  "styleDNA": {
    "dominantColors": ["<color1>", "<color2>", "<color3>"],
    "colorHarmony": "<complementary|analogous|monochromatic|triadic|neutral>",
    "colorCount": <number of distinct colors>,
    "formalityLevel": <1-5>,
    "styleArchetypes": ["<primary archetype>", "<secondary if applicable>"],
    "silhouetteType": "<fitted|relaxed|layered|structured|oversized>",
    "garments": ["<each visible garment/accessory>"],
    "patterns": ["<solid|striped|plaid|floral|graphic|abstract|etc>"],
    "textures": ["<denim|cotton|linen|silk|leather|knit|wool|suede|etc>"],
    "colorScore": <1-10 rating for color coordination>,
    "proportionScore": <1-10 rating for proportions/silhouette>,
    "fitScore": <1-10 rating for how well clothes fit>,
    "coherenceScore": <1-10 rating for overall style coherence>
  }
}

STYLE DNA EXTRACTION:
In addition to your feedback, extract structured attributes from the outfit:
- Colors: List actual colors visible (not just "blue" - be specific: "navy", "sky blue", "cobalt")
- Classify color harmony type based on the color wheel relationship
- Formality: 1=gym/lounge, 2=casual errand, 3=smart casual/date, 4=office/cocktail, 5=gala/wedding
- Style archetypes: Choose from [minimalist, classic, preppy, streetwear, bohemian, romantic, edgy, sporty, avant-garde, vintage, coastal, western, maximalist]
- Silhouette: Overall shape of the outfit on the body
- Garments: Every visible item — use simple standard names with color prefix if visible (e.g., "navy blazer", "white sneakers", "black belt"). One entry per distinct item. Avoid brand names.
- Sub-scores: Rate each dimension independently (a well-fitted but poorly-colored outfit should show high fit, low color)

IMPORTANT RULES:
- whatsRight, couldImprove, takeItFurther are arrays of plain strings — no objects, no point/detail structure
- editorialSummary goes last conceptually — it synthesizes the whole look
- Do NOT include occasionMatch as a separate field — fold occasion relevance into bullets when warranted
- No hedging language in any field. State what is, not what might be.
- Each bullet is one complete, specific thought — not a label, not a category

SCORING GUIDE (1-10):
- 1-4: Significant issues needing attention — rare, reserved for genuine mismatches
- 5-6: Foundation is there but needs refinement
- 7: Solid — shows intention and taste. This is the floor for any put-together outfit
- 8: Strong — well-executed with clear personal style
- 9: Excellent — editorial-ready, impressive across all dimensions
- 10: Perfect — stop-you-on-the-street exceptional

IMPORTANT: Most users putting in effort deserve a 7+. The goal is to affirm
good instincts while offering editorial-level suggestions for improvement.
Default to generosity — a 7 with sharp advice is more useful than a 5 that
discourages. Save sub-7 scores for outfits that genuinely need rethinking.`;

// Standard tier prompt suffix — keeps responses within 4096 tokens
const STANDARD_PROMPT_SUFFIX = `RESPONSE LENGTH — Standard tier:
- whatsRight: 2 bullets, max 15 words each
- couldImprove: 2 bullets, max 15 words each
- takeItFurther: 1 bullet, max 15 words
- editorialSummary: 2 sentences maximum, editorial voice`;

// Premium tier prompt suffix — rich, educational responses
const PREMIUM_PROMPT_SUFFIX = `RESPONSE LENGTH — Premium tier:
- whatsRight: 3 bullets, max 20 words each
- couldImprove: 2-3 bullets, max 20 words each
- takeItFurther: 2 bullets, max 20 words each
- editorialSummary: 3 sentences, full editorial voice`;

// Export response schema for training/testing
export const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.NUMBER },
    whatsRight: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    couldImprove: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    takeItFurther: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    editorialSummary: { type: SchemaType.STRING },
    styleDNA: {
      type: SchemaType.OBJECT,
      properties: {
        dominantColors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        colorHarmony: { type: SchemaType.STRING, nullable: true },
        colorCount: { type: SchemaType.NUMBER, nullable: true },
        formalityLevel: { type: SchemaType.NUMBER, nullable: true },
        styleArchetypes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        silhouetteType: { type: SchemaType.STRING, nullable: true },
        garments: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        patterns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        textures: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        colorScore: { type: SchemaType.NUMBER, nullable: true },
        proportionScore: { type: SchemaType.NUMBER, nullable: true },
        fitScore: { type: SchemaType.NUMBER, nullable: true },
        coherenceScore: { type: SchemaType.NUMBER, nullable: true }
      },
      required: ['dominantColors', 'styleArchetypes', 'garments', 'patterns', 'textures']
    }
  },
  required: ['overallScore', 'whatsRight', 'couldImprove', 'takeItFurther', 'editorialSummary', 'styleDNA']
} as const;

interface UserContext {
  id?: string;
  stylePreferences?: any;
  bodyType?: string | null;
  colorSeason?: string | null;
  height?: string | null;
  lifestyle?: string[];
  fashionGoals?: string[];
  fitPreference?: string | null;
  budgetLevel?: string | null;
}

// ─── Season & Date ────────────────────────────────────────────────────────────

function getSeasonContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  let season: string;
  let transition = '';

  if (month === 12 || month === 1 || month === 2) {
    season = 'Winter';
    if (month === 2) transition = ', transitioning to Spring';
  } else if (month >= 3 && month <= 5) {
    season = 'Spring';
    if (month === 5) transition = ', transitioning to Summer';
  } else if (month >= 6 && month <= 8) {
    season = 'Summer';
    if (month === 8) transition = ', transitioning to Fall';
  } else {
    season = 'Fall';
    if (month === 11) transition = ', transitioning to Winter';
  }

  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `Current date: ${dateStr} (${season}${transition})`;
}

// ─── Rating weight helper ─────────────────────────────────────────────────────

function getRatingWeight(feedbackHelpful: boolean | null, feedbackRating: number | null): number {
  if (feedbackHelpful === false) return 0.3;
  if (feedbackRating !== null && feedbackRating <= 2) return 0.4;
  if (feedbackRating !== null && feedbackRating >= 4) return 1.2;
  return 1.0;
}

// ─── Calibration ──────────────────────────────────────────────────────────────

async function getCalibrationContext(): Promise<string | null> {
  try {
    const calibrationData = await prisma.outfitCheck.findMany({
      where: {
        aiScore: { not: null },
        communityScoreCount: { gte: 3 },
      },
      select: { aiScore: true, communityAvgScore: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    if (calibrationData.length < 10) return null;

    const avgDelta = calibrationData.reduce((sum, d) => {
      return sum + ((d.aiScore || 0) - (d.communityAvgScore || 0));
    }, 0) / calibrationData.length;

    if (Math.abs(avgDelta) > 0.3) {
      const direction = avgDelta > 0 ? 'higher' : 'lower';
      return `Your scores tend to run ${Math.abs(avgDelta).toFixed(1)} points ${direction} than community consensus. Adjust slightly toward crowd perception.`;
    }
    return null;
  } catch (error) {
    console.error('Failed to get calibration context:', error);
    return null;
  }
}

// Per-user calibration: compares this user's AI scores vs community scores on their outfits
async function getUserCalibrationContext(userId: string): Promise<string | null> {
  try {
    const userData = await prisma.outfitCheck.findMany({
      where: {
        userId,
        aiScore: { not: null },
        communityScoreCount: { gte: 3 },
      },
      select: { aiScore: true, communityAvgScore: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    if (userData.length < 5) return null; // Need enough data for per-user calibration

    const avgDelta = userData.reduce((sum, d) => {
      return sum + ((d.aiScore || 0) - (d.communityAvgScore || 0));
    }, 0) / userData.length;

    if (Math.abs(avgDelta) > 0.5) { // Higher threshold than global (0.5 vs 0.3)
      const direction = avgDelta > 0 ? 'higher' : 'lower';
      return `For this specific user, your scores run ${Math.abs(avgDelta).toFixed(1)} points ${direction} than community consensus on their outfits specifically.`;
    }
    return null;
  } catch (error) {
    console.error('Failed to get user calibration context:', error);
    return null;
  }
}

// Self-correction: if recent ratings are consistently low, adjust tone and approach
async function getRatingCalibration(userId: string): Promise<string | null> {
  try {
    const recentRated = await prisma.outfitCheck.findMany({
      where: {
        userId,
        feedbackRating: { not: null },
      },
      select: { feedbackRating: true, feedbackHelpful: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    if (recentRated.length < 3) return null;

    const avgRating = recentRated.reduce((sum, r) => sum + (r.feedbackRating || 0), 0) / recentRated.length;
    const unhelpfulCount = recentRated.filter(r => r.feedbackHelpful === false).length;
    const unhelpfulPct = unhelpfulCount / recentRated.length;

    if (avgRating < 3.0 || unhelpfulPct > 0.4) {
      const issues: string[] = [];
      if (avgRating < 3.0) issues.push(`average rating ${avgRating.toFixed(1)}/5`);
      if (unhelpfulPct > 0.4) issues.push(`${Math.round(unhelpfulPct * 100)}% marked unhelpful`);
      return `This user's recent feedback has rated poorly (${issues.join(', ')}). Adjust your approach: be more specific, practical, and actionable. Fewer general principles — more concrete next steps they can take today.`;
    }
    return null;
  } catch (error) {
    console.error('Failed to get rating calibration:', error);
    return null;
  }
}

// ─── Cold-start personalization ───────────────────────────────────────────────

// Profile-based insights when there's no StyleDNA history yet
function getColdStartInsights(user?: UserContext): string[] {
  if (!user) return [];

  const insights: string[] = [];

  const colorSeasonMap: Record<string, string> = {
    spring: 'warm, clear colors like coral, golden yellow, warm peach, and bright greens',
    summer: 'cool, muted colors like dusty rose, lavender, sage, and powder blue',
    autumn: 'warm, muted colors like terracotta, mustard, olive, and rust',
    winter: 'cool, bold colors like icy blue, pure white, black, and jewel tones',
  };

  if (user.colorSeason) {
    const season = user.colorSeason.toLowerCase();
    const match = Object.entries(colorSeasonMap).find(([key]) => season.includes(key));
    if (match) {
      insights.push(`${user.colorSeason} color season — flattering palette: ${match[1]}`);
    }
  }

  const bodyTypeMap: Record<string, string> = {
    petite: 'monochromatic looks, high-waisted bottoms, and vertical lines to elongate',
    tall: 'bold patterns, wide-leg silhouettes, and horizontal details work well',
    athletic: 'feminine details, wrap styles, and belted looks to define the waist',
    curvy: 'wrap styles, empire waists, V-necks, and well-fitted cuts',
    pear: 'A-line skirts, wide-neck tops, darker bottoms, and embellished tops',
    apple: 'empire waists, V-necks, structured blazers, and straight-leg pants',
    rectangular: 'peplum tops, belted looks, and ruffles/texture to create curves',
    hourglass: 'fitted cuts, wrap dresses, and tailored pieces that follow natural curves',
  };

  if (user.bodyType) {
    const bodyType = user.bodyType.toLowerCase();
    const match = Object.entries(bodyTypeMap).find(([key]) => bodyType.includes(key));
    if (match) {
      insights.push(`${user.bodyType} body type — proportion tips: ${match[1]}`);
    }
  }

  if (user.fashionGoals && user.fashionGoals.length > 0) {
    const goals = user.fashionGoals.slice(0, 2);
    insights.push(`User's fashion goals: ${goals.join(', ')} — frame advice around these aspirations`);
  }

  if (user.fitPreference) {
    insights.push(`Preferred fit style: ${user.fitPreference} — honor this preference in suggestions`);
  }

  return insights;
}

// Aggregate insights from similar users (matching body type and/or color season)
async function getSimilarUserInsights(userId: string, user?: UserContext): Promise<string[]> {
  if (!user || (!user.bodyType && !user.colorSeason)) return [];

  try {
    const whereConditions: any[] = [{ id: { not: userId } }];
    if (user.bodyType) whereConditions.push({ bodyType: user.bodyType });
    if (user.colorSeason) whereConditions.push({ colorSeason: user.colorSeason });

    const similarUsers = await prisma.user.findMany({
      where: { AND: whereConditions },
      select: { id: true },
      take: 20,
    });

    if (similarUsers.length === 0) return [];

    const similarUserIds = similarUsers.map(u => u.id);

    const topDNAs = await prisma.styleDNA.findMany({
      where: { userId: { in: similarUserIds } },
      include: { outfitCheck: { select: { aiScore: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const harmonyScores = new Map<string, { sum: number; count: number }>();
    const archetypeScores = new Map<string, { sum: number; count: number }>();

    for (const dna of topDNAs) {
      if (!dna.outfitCheck.aiScore) continue;

      if (dna.colorHarmony) {
        const entry = harmonyScores.get(dna.colorHarmony) || { sum: 0, count: 0 };
        entry.sum += dna.outfitCheck.aiScore;
        entry.count++;
        harmonyScores.set(dna.colorHarmony, entry);
      }

      for (const arch of dna.styleArchetypes) {
        const entry = archetypeScores.get(arch) || { sum: 0, count: 0 };
        entry.sum += dna.outfitCheck.aiScore;
        entry.count++;
        archetypeScores.set(arch, entry);
      }
    }

    const insights: string[] = [];

    const topHarmony = [...harmonyScores.entries()]
      .filter(([_, v]) => v.count >= 2)
      .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)[0];

    if (topHarmony) {
      insights.push(`Users with similar profile score best with ${topHarmony[0]} color combinations`);
    }

    const topArchetype = [...archetypeScores.entries()]
      .filter(([_, v]) => v.count >= 2)
      .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)[0];

    if (topArchetype) {
      insights.push(`Top performing style for users with similar profile: ${topArchetype[0]}`);
    }

    return insights;
  } catch (error) {
    console.error('Failed to get similar user insights:', error);
    return [];
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildUserPrompt(
  input: OutfitCheckInput,
  user?: UserContext,
  feedbackHistory?: string[],
  calibrationContext?: string | null,
  options?: {
    dateContext?: string;
    trendContext?: string | null;
    userCalibrationContext?: string | null;
    ratingCalibration?: string | null;
  }
): string {
  const parts = [
    'Analyze this outfit photo.',
    '',
    'Context provided by user:',
    `- Occasion(s): ${input.occasions.join(', ')}`,
  ];

  if (input.setting) parts.push(`- Setting: ${input.setting}`);
  if (input.weather) parts.push(`- Weather: ${input.weather}`);
  if (input.vibe) parts.push(`- Desired vibe: ${input.vibe}`);
  if (input.specificConcerns) parts.push(`- User's concerns: ${input.specificConcerns}`);

  // Add user style profile if available
  if (user) {
    parts.push('', 'User Style Profile:');

    if (user.height) {
      parts.push(`- Height: ${user.height} (consider proportion guidelines)`);
    }

    if (user.bodyType) {
      parts.push(`- Body type: ${user.bodyType} (apply body balance guidelines)`);
    }

    if (user.colorSeason) {
      parts.push(`- Color season: ${user.colorSeason} (recommend flattering color tones)`);
    }

    if (user.fitPreference) {
      parts.push(`- Fit preference: ${user.fitPreference} (honor their comfort level)`);
    }

    if (user.lifestyle && user.lifestyle.length > 0) {
      parts.push(`- Lifestyle: ${user.lifestyle.join(', ')} (context for outfit practicality)`);
    }

    if (user.fashionGoals && user.fashionGoals.length > 0) {
      parts.push(`- Fashion goals: ${user.fashionGoals.join(', ')} (align advice with their objectives)`);
    }

    if (user.budgetLevel) {
      parts.push(`- Budget: ${user.budgetLevel} (suggest appropriate alternatives)`);
    }

    if (user.stylePreferences) {
      const prefs = user.stylePreferences;

      if (prefs.styles?.length > 0) {
        parts.push(`- Style categories: ${prefs.styles.join(', ')} (align recommendations with their aesthetic)`);
      }
      if (prefs.priorities?.length > 0) {
        parts.push(`- Fashion priorities: ${prefs.priorities.join(', ')} (emphasize what matters most to them)`);
      }
      if (prefs.bodyConcerns?.length > 0) {
        const concerns = prefs.bodyConcerns.filter((c: string) => c !== 'No specific concerns');
        if (concerns.length > 0) {
          parts.push(`- Styling goals: ${concerns.join(', ')} (tailor advice to their body confidence goals)`);
        }
      }

      // Legacy structure (keep for backward compatibility)
      if (prefs.preferredStyles?.length > 0) {
        parts.push(`- Preferred styles: ${prefs.preferredStyles.join(', ')}`);
      }
      if (prefs.favoriteColors?.length > 0) {
        parts.push(`- Favorite colors: ${prefs.favoriteColors.join(', ')}`);
      }
      if (prefs.avoidColors?.length > 0) {
        parts.push(`- Colors to avoid: ${prefs.avoidColors.join(', ')}`);
      }
      if (prefs.favoriteItems?.length > 0) {
        parts.push(`- Favorite items: ${prefs.favoriteItems.join(', ')}`);
      }
      if (prefs.avoidItems?.length > 0) {
        parts.push(`- Avoid items: ${prefs.avoidItems.join(', ')}`);
      }
      if (prefs.comfortPriority !== undefined) {
        parts.push(`- Comfort priority: ${prefs.comfortPriority}/10 (balance style vs comfort)`);
      }
    }
  }

  // Add feedback history insights (weighted by ratings)
  if (feedbackHistory && feedbackHistory.length > 0) {
    parts.push('', 'Past Feedback Patterns (from this user\'s history):');
    feedbackHistory.forEach(insight => {
      parts.push(`- ${insight}`);
    });
  }

  // Date and season context
  if (options?.dateContext) {
    parts.push('', options.dateContext);
  }

  // Current fashion trend context
  if (options?.trendContext) {
    parts.push('', options.trendContext);
  }

  // Global calibration
  if (calibrationContext) {
    parts.push('', `Global calibration note: ${calibrationContext}`);
  }

  // Per-user calibration (overrides global when present)
  if (options?.userCalibrationContext) {
    parts.push(`Per-user calibration: ${options.userCalibrationContext}`);
  }

  // Self-correction based on user's rating history
  if (options?.ratingCalibration) {
    parts.push('', `Feedback quality note: ${options.ratingCalibration}`);
  }

  parts.push('', 'Provide your analysis as JSON, using all context above to personalize recommendations.');

  return parts.join('\n');
}

// ─── JSON repair utilities ────────────────────────────────────────────────────

function repairTruncatedJSON(raw: string): string | null {
  let s = raw.trim();

  // Step 1: Close unclosed string if cursor is mid-string
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') inString = !inString;
  }
  if (inString) s += '"';

  // Step 2: Close unclosed brackets/braces
  const stack: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
      else if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
    }
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }

  try { JSON.parse(s); return s; } catch { return null; }
}

function fillMissingFeedbackFields(feedback: any): any {
  const filled = { ...feedback };
  if (!filled.overallScore) filled.overallScore = 6;
  if (!filled.whatsRight || !Array.isArray(filled.whatsRight)) filled.whatsRight = ['Your color choices are consistent.'];
  if (!filled.couldImprove || !Array.isArray(filled.couldImprove)) filled.couldImprove = ['Consider the overall proportions of the outfit.'];
  if (!filled.takeItFurther || !Array.isArray(filled.takeItFurther)) filled.takeItFurther = [];
  if (!filled.editorialSummary) filled.editorialSummary = 'A solid foundation to build on.';
  if (!filled.styleDNA) filled.styleDNA = { dominantColors: [], styleArchetypes: ['Casual'], garments: [], patterns: ['solid'], textures: ['cotton'], colorHarmony: 'neutral', formalityLevel: 2, colorCount: 1 };
  return filled;
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

// ─── Style insights (rating-weighted) ────────────────────────────────────────

async function getStyleInsights(userId: string): Promise<string[]> {
  try {
    const insights: string[] = [];

    const styleDNAs = await prisma.styleDNA.findMany({
      where: { userId },
      include: {
        outfitCheck: {
          select: { aiScore: true, feedbackHelpful: true, feedbackRating: true, occasions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (styleDNAs.length < 3) return insights;

    // 1. Best scoring color combinations (weighted by user ratings)
    const byColorHarmony = new Map<string, { weightedSum: number; totalWeight: number; count: number }>();
    styleDNAs.forEach(dna => {
      if (dna.colorHarmony && dna.outfitCheck.aiScore) {
        const weight = getRatingWeight(dna.outfitCheck.feedbackHelpful, dna.outfitCheck.feedbackRating);
        const entry = byColorHarmony.get(dna.colorHarmony) || { weightedSum: 0, totalWeight: 0, count: 0 };
        entry.weightedSum += dna.outfitCheck.aiScore * weight;
        entry.totalWeight += weight;
        entry.count++;
        byColorHarmony.set(dna.colorHarmony, entry);
      }
    });
    const bestHarmony = [...byColorHarmony.entries()]
      .filter(([_, e]) => e.count >= 2 && e.totalWeight > 0)
      .map(([harmony, e]) => ({ harmony, avg: e.weightedSum / e.totalWeight, count: e.count }))
      .sort((a, b) => b.avg - a.avg);
    if (bestHarmony.length > 0) {
      insights.push(`User's ${bestHarmony[0].harmony} color outfits score highest (weighted avg ${bestHarmony[0].avg.toFixed(1)})`);
    }

    // 2. Strongest and weakest sub-scores (weighted)
    const avgScores = { colorSum: 0, proportionSum: 0, fitSum: 0, coherenceSum: 0, totalWeight: 0, count: 0 };
    styleDNAs.forEach(dna => {
      if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
        const weight = getRatingWeight(dna.outfitCheck.feedbackHelpful, dna.outfitCheck.feedbackRating);
        avgScores.colorSum += dna.colorScore * weight;
        avgScores.proportionSum += dna.proportionScore * weight;
        avgScores.fitSum += dna.fitScore * weight;
        avgScores.coherenceSum += dna.coherenceScore * weight;
        avgScores.totalWeight += weight;
        avgScores.count++;
      }
    });
    if (avgScores.count >= 3 && avgScores.totalWeight > 0) {
      const w = avgScores.totalWeight;
      const dimensions = [
        { name: 'color coordination', avg: avgScores.colorSum / w },
        { name: 'proportions', avg: avgScores.proportionSum / w },
        { name: 'fit', avg: avgScores.fitSum / w },
        { name: 'style coherence', avg: avgScores.coherenceSum / w },
      ].sort((a, b) => b.avg - a.avg);
      insights.push(`Strongest area: ${dimensions[0].name} (avg ${dimensions[0].avg.toFixed(1)})`);
      insights.push(`Growth area: ${dimensions[3].name} (avg ${dimensions[3].avg.toFixed(1)}) - focus improvement here`);
    }

    // 3. Most-used style archetype
    const archetypeCounts = new Map<string, number>();
    styleDNAs.forEach(dna => {
      dna.styleArchetypes.forEach(a => {
        archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
      });
    });
    const sortedArchetypes = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topArchetype = sortedArchetypes[0];
    if (topArchetype && topArchetype[1] >= 3) {
      insights.push(`User's dominant style lane: ${topArchetype[0]} (${topArchetype[1]} of last ${styleDNAs.length} outfits) — keep suggestions within this aesthetic. Do NOT suggest items from a different style lane (e.g., don't suggest blazers/loafers to a streetwear user).`);
      if (sortedArchetypes.length > 1 && sortedArchetypes[1][1] >= 2) {
        insights.push(`Secondary style influence: ${sortedArchetypes[1][0]} — user sometimes blends this with their primary lane`);
      }
    }

    // 4. Best-performing colors (weighted by user ratings)
    const colorScores = new Map<string, { weightedTotal: number; totalWeight: number; count: number }>();
    styleDNAs.forEach(dna => {
      if (dna.outfitCheck.aiScore) {
        const weight = getRatingWeight(dna.outfitCheck.feedbackHelpful, dna.outfitCheck.feedbackRating);
        dna.dominantColors.forEach(color => {
          const entry = colorScores.get(color) || { weightedTotal: 0, totalWeight: 0, count: 0 };
          entry.weightedTotal += dna.outfitCheck.aiScore! * weight;
          entry.totalWeight += weight;
          entry.count++;
          colorScores.set(color, entry);
        });
      }
    });
    const topColors = [...colorScores.entries()]
      .filter(([_, v]) => v.count >= 2 && v.totalWeight > 0)
      .map(([color, v]) => ({ color, avg: v.weightedTotal / v.totalWeight, count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
    if (topColors.length > 0) {
      insights.push(`Best performing colors: ${topColors.map(c => `${c.color} (${c.avg.toFixed(1)})`).join(', ')}`);
    }

    return insights;
  } catch (error) {
    console.error('Failed to get style insights:', error);
    return [];
  }
}

// ─── Main analysis ────────────────────────────────────────────────────────────

export async function analyzeOutfit(
  outfitCheckId: string,
  input: OutfitCheckInput,
  user?: UserContext,
  hasPriorityProcessing?: boolean
): Promise<OutfitFeedback> {
  // Mock mode for testing (bypasses Gemini API quota limits)
  if (process.env.USE_MOCK_AI === 'true') {
    console.log('Using mock AI feedback (quota bypass enabled)');
    return {
      overallScore: 8,
      whatsRight: [
        'The tonal palette is cohesive — the neutrals sit in the same temperature register.',
        'The silhouette is balanced — proportions work without adjustment.',
      ],
      couldImprove: [
        'The footwear is the weakest element — a shoe swap would elevate the whole read.',
        'Accessories are absent — one deliberate piece would anchor the look.',
      ],
      takeItFurther: [
        `Swap the current shoe for a leather loafer and this moves from functional to considered.`,
      ],
      editorialSummary: `The foundation here is solid — palette, proportion, and occasion alignment are all correct. The details are where the work is. One strong accessory and a better shoe would push this from good to editorial.`,
      styleDNA: {
        dominantColors: ['navy', 'white', 'gray'],
        colorHarmony: 'neutral',
        colorCount: 3,
        formalityLevel: 3,
        styleArchetypes: ['classic', 'minimalist'],
        silhouetteType: 'fitted',
        garments: ['shirt', 'pants', 'shoes'],
        patterns: ['solid'],
        textures: ['cotton', 'denim'],
        colorScore: 8.0,
        proportionScore: 7.5,
        fitScore: 8.5,
        coherenceScore: 8.0
      }
    } as unknown as OutfitFeedback;
  }

  let feedbackHistory: string[] = [];
  let calibrationContext: string | null = null;
  let userCalibrationContext: string | null = null;
  let ratingCalibration: string | null = null;
  let trendContext: string | null = null;

  try {
    const outfitCheck = await prisma.outfitCheck.findUnique({
      where: { id: outfitCheckId },
      select: { userId: true },
    });

    if (outfitCheck) {
      feedbackHistory = await getStyleInsights(outfitCheck.userId);

      // Cold-start: when no StyleDNA history, use profile + similar users
      if (feedbackHistory.length === 0) {
        const coldStart = getColdStartInsights(user);
        const similarInsights = await getSimilarUserInsights(outfitCheck.userId, user);
        feedbackHistory = [...coldStart, ...similarInsights];
        if (feedbackHistory.length > 0) {
          console.log(`[AI] Cold-start insights injected (${feedbackHistory.length} items)`);
        }
      }

      [calibrationContext, userCalibrationContext, ratingCalibration, trendContext] = await Promise.all([
        getCalibrationContext(),
        getUserCalibrationContext(outfitCheck.userId),
        getRatingCalibration(outfitCheck.userId),
        getLatestFashionTrendText(),
      ]);
    }
  } catch (error) {
    console.error('Failed to load personalization context:', error);
    // Continue without personalization context
  }

  const dateContext = getSeasonContext();
  const maxRetries = 3;
  const aiStartTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tierSuffix = hasPriorityProcessing ? PREMIUM_PROMPT_SUFFIX : STANDARD_PROMPT_SUFFIX;
      const fullSystemPrompt = SYSTEM_PROMPT + '\n\n' + tierSuffix;

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        systemInstruction: fullSystemPrompt,
        generationConfig: {
          temperature: hasPriorityProcessing ? 0.3 : 0.5,
          maxOutputTokens: hasPriorityProcessing ? 8192 : 4096,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA as any
        },
      });

      let imagePart;
      if (input.imageBase64) {
        const cleanBase64 = input.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        imagePart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        };
      } else if (input.imageUrl) {
        const fetchResponse = await fetch(input.imageUrl);
        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${fetchResponse.status}`);
        }
        const arrayBuffer = await fetchResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = fetchResponse.headers.get('content-type') || 'image/jpeg';
        imagePart = {
          inlineData: {
            mimeType: (contentType.startsWith('image/') ? contentType : 'image/jpeg') as any,
            data: base64,
          },
        };
      } else {
        throw new Error('No image data provided');
      }

      const result = await model.generateContent([
        buildUserPrompt(input, user, feedbackHistory, calibrationContext, {
          dateContext,
          trendContext,
          userCalibrationContext,
          ratingCalibration,
        }),
        imagePart,
      ]);

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from AI');
      }

      if (/(.{20,})\1{3,}/.test(content)) {
        throw new Error('AI response contains degeneration loop, retrying');
      }

      const cleanContent = stripMarkdownFences(content);

      // v3.0 responses use whatsRight/couldImprove/takeItFurther/editorialSummary;
      // typed as any here since the function signature is kept for backwards compat
      let feedback: any;
      try {
        feedback = JSON.parse(cleanContent);
      } catch (parseError) {
        console.warn(`[AI] JSON parse failed on attempt ${attempt}, attempting repair...`);
        const repaired = repairTruncatedJSON(cleanContent);
        if (repaired) {
          try {
            const partial = JSON.parse(repaired);
            feedback = fillMissingFeedbackFields(partial);
            console.log(`[AI] JSON repair succeeded on attempt ${attempt}`);
          } catch {
            console.error('JSON parse error (repair also failed). Raw content:', cleanContent.substring(0, 500));
            throw new Error(`Invalid JSON from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        } else {
          console.error('JSON parse error (unrepaired). Raw content:', cleanContent.substring(0, 500));
          throw new Error(`Invalid JSON from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }

      if (
        typeof feedback.overallScore !== 'number' ||
        !Array.isArray(feedback.whatsRight)
      ) {
        throw new Error('Invalid feedback structure');
      }

      await prisma.outfitCheck.update({
        where: { id: outfitCheckId },
        data: {
          aiFeedback: feedback as any,
          aiScore: feedback.overallScore,
          aiProcessedAt: new Date(),
          promptVersion: PROMPT_VERSION,
        },
      });

      if (user?.id) {
        const score = feedback.overallScore;
        const emoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';
        createNotification({
          userId: user.id,
          type: 'analysis_complete',
          title: `${emoji} Your outfit scored ${score}/10`,
          body: (feedback as any).editorialSummary
            ? ((feedback as any).editorialSummary.length > 80
              ? (feedback as any).editorialSummary.slice(0, 77) + '...'
              : (feedback as any).editorialSummary)
            : 'Your outfit analysis is ready.',
          linkType: 'outfit',
          linkId: outfitCheckId,
        }).catch((err) => console.error('Failed to send analysis notification:', err));

        // Check score-based milestones (first 9+)
        checkMilestones(user.id, { latestScore: score }).catch((err) =>
          console.error('Score milestone check failed:', err),
        );
      }

      if (feedback.styleDNA) {
        try {
          const outfit = await prisma.outfitCheck.findUnique({
            where: { id: outfitCheckId },
            select: { userId: true },
          });

          if (!outfit) {
            throw new Error('Outfit check not found for StyleDNA save');
          }

          await prisma.styleDNA.create({
            data: {
              outfitCheckId,
              userId: outfit.userId,
              dominantColors: feedback.styleDNA.dominantColors,
              colorHarmony: feedback.styleDNA.colorHarmony,
              colorCount: feedback.styleDNA.colorCount,
              formalityLevel: feedback.styleDNA.formalityLevel,
              styleArchetypes: feedback.styleDNA.styleArchetypes,
              silhouetteType: feedback.styleDNA.silhouetteType,
              garments: feedback.styleDNA.garments,
              patterns: feedback.styleDNA.patterns,
              textures: feedback.styleDNA.textures,
              colorScore: feedback.styleDNA.colorScore,
              proportionScore: feedback.styleDNA.proportionScore,
              fitScore: feedback.styleDNA.fitScore,
              coherenceScore: feedback.styleDNA.coherenceScore,
            },
          });
          // Sync detected garments to wardrobe (non-fatal)
          try {
            const { syncGarmentsToWardrobe } = await import('./wardrobe-sync.service.js');
            await syncGarmentsToWardrobe(
              outfit.userId,
              outfitCheckId,
              feedback.styleDNA.garments,
              feedback.styleDNA.dominantColors
            );
          } catch (syncError) {
            console.error('[AI] Wardrobe sync failed (non-fatal):', syncError);
          }
        } catch (styleDNAError) {
          console.error('Failed to save Style DNA:', styleDNAError);
        }
      }

      _aiSuccessCount++;
      const usage = response.usageMetadata;
      trackServerEvent(user?.id || outfitCheckId, 'ai_feedback_generated', {
        score: feedback.overallScore,
        fallback: false,
        latency_ms: Date.now() - aiStartTime,
        model: 'gemini-2.5-flash-lite',
        prompt_version: PROMPT_VERSION,
        has_trend_context: !!trendContext,
        has_user_calibration: !!userCalibrationContext,
        is_cold_start: feedbackHistory.length > 0 && feedbackHistory[0].includes('body type'),
        tokens_input: usage?.promptTokenCount ?? null,
        tokens_output: usage?.candidatesTokenCount ?? null,
        tokens_total: usage?.totalTokenCount ?? null,
      });
      if (usage) {
        console.log(`[AI] tokens — input: ${usage.promptTokenCount}, output: ${usage.candidatesTokenCount}, total: ${usage.totalTokenCount}`);
      }

      return feedback as unknown as OutfitFeedback;
    } catch (error) {
      console.error(`AI feedback attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Fallback response if all retries failed
  console.error('All AI feedback attempts failed, using fallback');
  const fallbackFeedback: any = {
    overallScore: 7,
    whatsRight: [
      'Your outfit is put together and appropriate for the occasion.',
    ],
    couldImprove: [
      'Submit again for a full editorial analysis — technical issues prevented complete feedback.',
    ],
    takeItFurther: [],
    editorialSummary: "We hit a technical wall on this one — the score is provisional. Submit again and you'll get the full editorial read.",
    styleDNA: {
      dominantColors: [],
      colorHarmony: 'neutral',
      colorCount: 0,
      formalityLevel: 3,
      styleArchetypes: [],
      silhouetteType: 'balanced',
      garments: [],
      patterns: [],
      textures: [],
      colorScore: 7,
      proportionScore: 7,
      fitScore: 7,
      coherenceScore: 7,
    },
  };

  await prisma.outfitCheck.update({
    where: { id: outfitCheckId },
    data: {
      aiFeedback: fallbackFeedback as any,
      aiScore: fallbackFeedback.overallScore,
      aiProcessedAt: new Date(),
      promptVersion: PROMPT_VERSION,
    },
  });

  if (user?.id) {
    createNotification({
      userId: user.id,
      type: 'analysis_complete',
      title: `✨ Your outfit scored ${fallbackFeedback.overallScore}/10`,
      body: 'Your outfit has been scored! Tap to view your results.',
      linkType: 'outfit',
      linkId: outfitCheckId,
    }).catch((err) => console.error('Failed to send fallback analysis notification:', err));
  }

  _aiFallbackCount++;
  trackServerEvent(user?.id || outfitCheckId, 'ai_feedback_generated', {
    score: fallbackFeedback.overallScore,
    fallback: true,
    latency_ms: Date.now() - aiStartTime,
    model: 'gemini-2.5-flash-lite',
    prompt_version: PROMPT_VERSION,
  });

  return fallbackFeedback as unknown as OutfitFeedback;
}

// ─── Follow-up conversations (with memory) ────────────────────────────────────

export async function handleFollowUpQuestion(
  outfitCheckId: string,
  question: string
): Promise<string> {
  const outfitCheck = await prisma.outfitCheck.findUnique({
    where: { id: outfitCheckId },
    include: {
      followUps: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!outfitCheck) {
    throw new Error('Outfit check not found');
  }

  const previousFeedback = outfitCheck.aiFeedback as any;
  const previousScore = outfitCheck.aiScore;

  // Build outfit context for system prompt
  const outfitContextLines = [
    outfitCheck.occasions?.length ? `Occasions: ${outfitCheck.occasions.join(', ')}` : null,
    outfitCheck.setting ? `Setting: ${outfitCheck.setting}` : null,
    outfitCheck.vibe ? `Desired vibe: ${outfitCheck.vibe}` : null,
    outfitCheck.weather ? `Weather: ${outfitCheck.weather}` : null,
  ].filter((l): l is string => l !== null);

  // Support both v3.0 (whatsRight / couldImprove) and legacy v2.0 (whatsWorking / consider) formats
  const workingPoints = Array.isArray(previousFeedback?.whatsRight)
    ? previousFeedback.whatsRight.join(', ')
    : (previousFeedback?.whatsWorking || []).map((w: any) => w.point || w).join(', ')
    || 'N/A';
  const improvementPoints = Array.isArray(previousFeedback?.couldImprove)
    ? previousFeedback.couldImprove.join(', ')
    : (previousFeedback?.consider || []).map((c: any) => c.point || c).join(', ')
    || 'N/A';
  const editorialSummary = previousFeedback?.editorialSummary || previousFeedback?.summary || 'N/A';

  const systemPrompt = `You are the Or This? fashion editor continuing a conversation about an outfit you previously analyzed. Maintain the same editorial, Vogue-desk voice: decisive, specific, no hedging.

Original outfit context:
${outfitContextLines.length > 0 ? outfitContextLines.join('\n') : 'No additional context provided'}

Your previous analysis:
- Score: ${previousScore || 'N/A'}/10
- Editorial read: ${editorialSummary}
- What's working: ${workingPoints}
- What to improve: ${improvementPoints}

Answer follow-up questions with editorial precision. Be specific — cite garments, proportions, color relationships, or fabric choices by name. For product recommendations, suggest general categories and styles rather than specific brands unless asked.

Keep responses concise (2-4 sentences) and decisive.`;

  // Build conversation history from prior follow-ups (last 5 Q&A turns)
  const recentFollowUps = outfitCheck.followUps.slice(-5);
  const history = recentFollowUps.flatMap(fu => [
    { role: 'user' as const, parts: [{ text: fu.userQuestion }] },
    { role: 'model' as const, parts: [{ text: fu.aiResponse || '' }] },
  ]);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(question);
    const response = await result.response;
    const answer = response.text() || 'I apologize, but I could not generate a response. Please try again.';
    const followUpUsage = response.usageMetadata;
    if (followUpUsage) {
      console.log(`[AI] follow-up tokens — input: ${followUpUsage.promptTokenCount}, output: ${followUpUsage.candidatesTokenCount}, total: ${followUpUsage.totalTokenCount}`);
    }

    await prisma.followUp.create({
      data: {
        outfitCheckId,
        userQuestion: question,
        aiResponse: answer,
      },
    });

    return answer;
  } catch (error) {
    console.error('Follow-up question failed:', error);
    return 'I apologize, but I encountered an issue processing your question. Please try again in a moment.';
  }
}
