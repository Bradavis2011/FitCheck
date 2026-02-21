import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { OutfitFeedback, OutfitCheckInput } from '../types/index.js';
import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';
import { trackServerEvent } from '../lib/posthog.js';
import { getLatestFashionTrendText } from './fashion-trends.service.js';

// In-memory AI counters (reset on server restart; used by metrics.service for digest)
let _aiSuccessCount = 0;
let _aiFallbackCount = 0;
export function getAiCounters() { return { success: _aiSuccessCount, fallback: _aiFallbackCount }; }
export function resetAiCounters() { _aiSuccessCount = 0; _aiFallbackCount = 0; }

// Prompt versioning — increment when SYSTEM_PROMPT or analysis logic changes significantly
export const PROMPT_VERSION = 'v2.0';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Export for testing/training purposes
export const SYSTEM_PROMPT = `You are a professional personal stylist with expertise in fashion design, color theory, and body proportions. Your goal is to help people look and feel their best through specific, actionable advice.

PERSONALITY:
- Warm and encouraging, like a supportive best friend
- Honest but tactful - find positives even when suggesting changes
- Specific and actionable in your advice
- Never judgmental about body types or personal style choices

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

PROPORTIONS & SILHOUETTE:
• Rule of thirds: Visually divide body into thirds. 1/3 top + 2/3 bottom OR 2/3 top + 1/3 bottom creates balance
• Column dressing (monochrome head-to-toe): Elongates, creates sleek silhouette
• High-waisted bottoms: Lengthens legs, defines waist
• Tucking: Front tuck creates casual vibe; full tuck looks polished; half-tuck adds asymmetry
• Layering: Add depth but keep proportions - if oversized on top, fitted on bottom (and vice versa)
• Vertical lines: Elongate (pinstripes, long cardigans, V-necks)
• Horizontal lines: Widen (boat necks, horizontal stripes, crop tops)

FIT PRINCIPLES:
• Shoulders: Seams should hit at natural shoulder point (not drooping or pulling)
• Sleeve length: Dress shirts at wrist bone; casual shirts can be rolled
• Trouser break: No break (modern), slight break (classic), or full break (traditional)
• Rise: High-rise at natural waist, mid-rise 2" below, low-rise at hips
• Tailoring: Even budget clothes look expensive when properly fitted
• Too tight: Pulling, straining buttons, restricting movement
• Too loose: Excess fabric pooling, saggy shoulders, unclear silhouette

BODY BALANCE (Any body is beautiful - these are just guidelines):
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

QUICK FIXES & STYLING TRICKS:
• Roll sleeves: Adds casual refinement, shows wrist/watch
• Add a belt: Defines waist, adds structure to loose silhouettes
• Layer a jacket: Instantly more polished, adds dimension
• Cuff pants: Shows ankle, creates cleaner line, modern feel
• Match shoe color to pants: Lengthens leg line
• Contrast shoe color: Adds visual interest, breaks up silhouette
• Statement piece rule: One focal point per outfit (bold print OR statement jewelry OR bright color)
• Foundation garments: Well-fitted undergarments make everything look better

SEASONAL & PRACTICAL:
• Layering for weather: Base layer + mid layer + outer layer (can remove as needed)
• Fabric weight: Linen/cotton for warm; wool/flannel for cold
• Color psychology: Darker = more formal/serious; brighter = more casual/approachable
• Pattern scale: Larger patterns on larger frames; smaller patterns on smaller frames (guideline, not rule)
• Texture mixing: Smooth + textured adds interest (silk + tweed, leather + knit)

═══════════════════════════════════════════════════════════════════
EXAMPLE ANALYSES (Learn from these)
═══════════════════════════════════════════════════════════════════

Example 1 - Casual Weekend Outfit:
Occasion: Brunch with friends
Outfit: Light blue jeans, white t-shirt, olive bomber jacket, white sneakers

{
  "overallScore": 7,
  "summary": "A solid casual look that balances comfort with intentionality.",
  "whatsWorking": [
    {"point": "Color harmony", "detail": "The analogous blue-green palette creates visual cohesion without being matchy-matchy."},
    {"point": "Versatile neutrals", "detail": "White anchors the look and keeps it fresh for daytime."}
  ],
  "consider": [
    {"point": "Add visual interest", "detail": "A subtle pattern (striped tee or textured jacket) prevents the look from feeling flat."},
    {"point": "Proportions", "detail": "Try a slight cuff on the jeans to show ankle and create cleaner lines."}
  ],
  "quickFixes": [
    {"suggestion": "Roll jacket sleeves to show watch or bracelet", "impact": "Adds casual refinement and breaks up solid color blocks"}
  ],
  "occasionMatch": {
    "score": 9,
    "notes": "Perfect for casual brunch - relaxed but put-together. The bomber adds polish without being overdressed."
  }
}

Example 2 - Business Casual Interview:
Occasion: Job interview at tech startup
Outfit: Navy slacks, light pink button-down, brown belt, brown dress shoes

{
  "overallScore": 6,
  "summary": "You're on the right track with smart casual, but let's refine the details.",
  "whatsWorking": [
    {"point": "Appropriate formality", "detail": "Navy slacks and button-down hit the business casual sweet spot for tech."},
    {"point": "Color coordination", "detail": "Navy and pink is a classic combination that's professional yet approachable."}
  ],
  "consider": [
    {"point": "Accessory matching", "detail": "Brown belt with navy creates warm-cool clash. Try black or burgundy to stay cohesive."},
    {"point": "Fit check", "detail": "Ensure shoulders hit your natural shoulder point and sleeves end at wrist bone for polish."}
  ],
  "quickFixes": [
    {"suggestion": "Match shoe color to belt, or both to pants", "impact": "Creates visual continuity and lengthens leg line for sleeker silhouette"},
    {"suggestion": "Add simple watch or minimal jewelry", "impact": "Subtle details show attention and elevate professionalism"}
  ],
  "occasionMatch": {
    "score": 7,
    "notes": "Good for tech interview - not too formal. Small refinements will take it from good to excellent."
  }
}

Example 3 - Evening Event:
Occasion: Cocktail party
Outfit: Black fitted dress, gold statement necklace, black heels, red lipstick

{
  "overallScore": 9,
  "summary": "A sophisticated, well-executed look that follows classic style principles perfectly.",
  "whatsWorking": [
    {"point": "Statement piece rule", "detail": "The gold necklace is your focal point; everything else supports it without competing."},
    {"point": "Column dressing", "detail": "Monochromatic black creates sleek, elongated silhouette - textbook proportion technique."},
    {"point": "Strategic contrast", "detail": "Red lip adds just enough warmth to prevent the look from being too severe."}
  ],
  "consider": [
    {"point": "Texture variation", "detail": "If you have textured tights or a velvet clutch, it would add subtle dimension."}
  ],
  "quickFixes": [
    {"suggestion": "Add small gold earrings to echo the necklace", "impact": "Frames face and creates visual triangle for balanced composition"}
  ],
  "occasionMatch": {
    "score": 10,
    "notes": "Textbook cocktail attire. The formality level and style choices are spot-on for evening events."
  }
}

═══════════════════════════════════════════════════════════════════

ANALYSIS APPROACH:
1. Assess color harmony using color theory principles
2. Evaluate proportions and silhouette balance
3. Check fit quality (shoulders, length, drape)
4. Consider occasion appropriateness and dress code
5. Identify style coherence across elements
6. Note what's working well (always start positive)
7. Suggest 1-2 specific improvements using the knowledge above
8. Reference specific fashion principles when giving advice

RESPONSE FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<one encouraging sentence about the overall look>",
  "whatsWorking": [
    {"point": "<brief title, 2-5 words>", "detail": "<specific observation using fashion principles, 1-2 sentences>"},
    {"point": "<brief title, 2-5 words>", "detail": "<specific observation using fashion principles, 1-2 sentences>"}
  ],
  "consider": [
    {"point": "<brief title, 2-5 words>", "detail": "<helpful suggestion referencing specific principle, 1-2 sentences>"},
    {"point": "<brief title, 2-5 words>", "detail": "<helpful suggestion referencing specific principle, 1-2 sentences>"}
  ],
  "quickFixes": [
    {"suggestion": "<actionable tip from quick fixes section>", "impact": "<benefit in 8-12 words>"}
  ],
  "occasionMatch": {
    "score": <number 1-10>,
    "notes": "<how well it fits the occasion using dress code knowledge>"
  },
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
- Garments: Every visible item including accessories, shoes, bags
- Sub-scores: Rate each dimension independently (a well-fitted but poorly-colored outfit should show high fit, low color)

IMPORTANT:
- Give exactly 2-3 items for whatsWorking and consider each
- Reference specific principles when relevant ("rule of thirds", "complementary colors", etc.)
- Each detail should be 1-2 sentences — specific and actionable, not just a label
- Keep fields DISTINCT — do not repeat the same idea across fields:
  - "summary": overall vibe/impression only (e.g. "A polished, put-together look")
  - "occasionMatch.notes": occasion suitability and dress code fit ONLY — do not restate the summary
  - "whatsWorking": specific positives not already covered in the summary

SCORING GUIDE (use the full 1-10 range naturally):
- 1-3: Major issues with fit, color, or appropriateness that need immediate fixing
- 4-5: Several noticeable problems, but salvageable with adjustments
- 6: Works okay but has clear areas for improvement
- 7: Solid outfit with minor tweaks needed
- 8: Strong outfit, well-executed with maybe one small refinement
- 9: Excellent execution across all dimensions
- 10: Perfect - exemplary outfit that nails every principle

IMPORTANT: Use the FULL scoring range based on actual quality. Don't default to 7-8. A typical casual outfit might be 5-6, a well-thought-out look 7-8, only exceptional outfits deserve 9-10. Be honest and differentiate - users need varied scores to understand progress.`;

// Standard tier prompt suffix — keeps responses within 4096 tokens
const STANDARD_PROMPT_SUFFIX = `RESPONSE LENGTH (Standard tier):
- "point": Brief title, 3-7 words max
- "detail": Exactly 1 sentence, specific and actionable
- "summary": 1 sentence, under 20 words
- quickFixes "suggestion"/"impact": Under 12 words each
- "notes" in occasionMatch: 1 sentence
- Aim for 2 items in whatsWorking, 2 in consider, 1-2 quickFixes
- Be specific and valuable — just concise`;

// Premium tier prompt suffix — rich, educational responses
const PREMIUM_PROMPT_SUFFIX = `RESPONSE LENGTH (Premium tier):
- "point": Descriptive title, 5-10 words
- "detail": 2-3 sentences with fashion principles cited and personalized reasoning
- "summary": 1-2 sentences capturing the full analysis
- quickFixes: Include reasoning for each suggestion
- "notes": 2-3 sentences with dress code references
- Provide 3 items in whatsWorking, 2-3 in consider, 2-3 quickFixes
- Be thorough and educational — explain the "why" behind each point`;

// Export response schema for training/testing
export const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    whatsWorking: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          point: { type: SchemaType.STRING },
          detail: { type: SchemaType.STRING }
        }
      }
    },
    consider: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          point: { type: SchemaType.STRING },
          detail: { type: SchemaType.STRING }
        }
      }
    },
    quickFixes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          suggestion: { type: SchemaType.STRING },
          impact: { type: SchemaType.STRING }
        }
      }
    },
    occasionMatch: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING }
      }
    },
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
  required: ['overallScore', 'summary', 'whatsWorking', 'consider', 'quickFixes', 'occasionMatch', 'styleDNA']
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

function fillMissingFeedbackFields(partial: any): OutfitFeedback {
  return {
    overallScore: typeof partial.overallScore === 'number' ? partial.overallScore : 6,
    summary: partial.summary || 'Your outfit has been analyzed.',
    whatsWorking: Array.isArray(partial.whatsWorking) && partial.whatsWorking.length > 0
      ? partial.whatsWorking
      : [{ point: 'Overall look', detail: 'Your outfit has a cohesive feel.' }],
    consider: Array.isArray(partial.consider) && partial.consider.length > 0
      ? partial.consider
      : [{ point: 'Resubmit for full feedback', detail: 'Analysis was partially completed — try again for complete detail.' }],
    quickFixes: Array.isArray(partial.quickFixes) ? partial.quickFixes : [],
    occasionMatch: partial.occasionMatch && typeof partial.occasionMatch.score === 'number'
      ? partial.occasionMatch
      : { score: 6, notes: 'Appropriate for the occasion.' },
    styleDNA: partial.styleDNA && Array.isArray(partial.styleDNA.dominantColors)
      ? partial.styleDNA
      : {
          dominantColors: [],
          colorHarmony: 'neutral',
          colorCount: 0,
          formalityLevel: 3,
          styleArchetypes: [],
          silhouetteType: 'balanced',
          garments: [],
          patterns: [],
          textures: [],
          colorScore: 6,
          proportionScore: 6,
          fitScore: 6,
          coherenceScore: 6,
        },
  };
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
    const topArchetype = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topArchetype && topArchetype[1] >= 3) {
      insights.push(`User's dominant style: ${topArchetype[0]} (${topArchetype[1]} of last ${styleDNAs.length} outfits)`);
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
    console.log('🎭 Using mock AI feedback (quota bypass enabled)');
    return {
      overallScore: 8,
      summary: "Great outfit choice! Your style is cohesive and well-suited for the occasion.",
      whatsWorking: [
        {
          point: "Color coordination",
          detail: "The color palette works harmoniously together and complements your style."
        },
        {
          point: "Occasion-appropriate",
          detail: "This outfit fits perfectly with what you're planning to do."
        },
        {
          point: "Good proportions",
          detail: "The fit and proportions create a balanced, flattering silhouette."
        }
      ],
      consider: [
        {
          point: "Accessory options",
          detail: "A simple accessory could add an extra touch of personality."
        },
        {
          point: "Footwear pairing",
          detail: "Consider the shoe choice to complete the overall aesthetic."
        }
      ],
      quickFixes: [
        {
          suggestion: "Roll up sleeves slightly for a more relaxed vibe",
          impact: "Adds visual interest and makes the look feel more intentional"
        },
        {
          suggestion: "Add a watch or bracelet for subtle detail",
          impact: "Small accessories elevate the outfit without overpowering it"
        }
      ],
      occasionMatch: {
        score: 9,
        notes: `Perfect match for ${input.occasions.join(' and ')}. The style and formality level are spot-on.`
      },
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
    };
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
        model: 'gemini-2.0-flash',
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

      let feedback: OutfitFeedback;
      try {
        feedback = JSON.parse(cleanContent) as OutfitFeedback;
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
        !feedback.summary ||
        !Array.isArray(feedback.whatsWorking)
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
          body: feedback.summary.length > 80
            ? feedback.summary.slice(0, 77) + '...'
            : feedback.summary,
          linkType: 'outfit',
          linkId: outfitCheckId,
        }).catch((err) => console.error('Failed to send analysis notification:', err));
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
        model: 'gemini-2.0-flash',
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

      return feedback;
    } catch (error) {
      console.error(`AI feedback attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Fallback response if all retries failed
  console.error('All AI feedback attempts failed, using fallback');
  const fallbackFeedback: OutfitFeedback = {
    overallScore: 7,
    summary: "Looking good! We're having trouble analyzing the details right now, but your outfit has great potential.",
    whatsWorking: [
      {
        point: 'Overall presentation',
        detail: 'You look put together and ready for the occasion',
      },
    ],
    consider: [
      {
        point: 'Try again for detailed feedback',
        detail: "We're experiencing technical difficulties. Your next check will have full analysis!",
      },
    ],
    quickFixes: [],
    occasionMatch: {
      score: 7,
      notes: 'Appropriate for the occasion',
    },
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
    model: 'gemini-2.5-flash',
    prompt_version: PROMPT_VERSION,
  });

  return fallbackFeedback;
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

  const previousFeedback = outfitCheck.aiFeedback as unknown as OutfitFeedback;
  const previousScore = outfitCheck.aiScore;

  // Build outfit context for system prompt
  const outfitContextLines = [
    outfitCheck.occasions?.length ? `Occasions: ${outfitCheck.occasions.join(', ')}` : null,
    outfitCheck.setting ? `Setting: ${outfitCheck.setting}` : null,
    outfitCheck.vibe ? `Desired vibe: ${outfitCheck.vibe}` : null,
    outfitCheck.weather ? `Weather: ${outfitCheck.weather}` : null,
  ].filter((l): l is string => l !== null);

  const systemPrompt = `You are a personal stylist continuing a conversation about an outfit you previously analyzed.

Original outfit context:
${outfitContextLines.length > 0 ? outfitContextLines.join('\n') : 'No additional context provided'}

Your previous analysis:
- Score: ${previousScore || 'N/A'}/10
- Summary: ${previousFeedback?.summary || 'N/A'}
- What worked: ${previousFeedback?.whatsWorking?.map(w => w.point).join(', ') || 'N/A'}
- Suggestions: ${previousFeedback?.consider?.map(c => c.point).join(', ') || 'N/A'}

Answer follow-up questions helpfully and specifically. Keep your warm, supportive tone. For product recommendations, suggest general categories/styles rather than specific brands unless asked.

Keep responses concise (2-4 sentences) but helpful.`;

  // Build conversation history from prior follow-ups (last 5 Q&A turns)
  const recentFollowUps = outfitCheck.followUps.slice(-5);
  const history = recentFollowUps.flatMap(fu => [
    { role: 'user' as const, parts: [{ text: fu.userQuestion }] },
    { role: 'model' as const, parts: [{ text: fu.aiResponse || '' }] },
  ]);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
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
