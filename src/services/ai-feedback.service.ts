import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { OutfitFeedback, OutfitCheckInput } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a professional personal stylist with expertise in fashion design, color theory, and body proportions. Your goal is to help people look and feel their best through specific, actionable advice.

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
- Keep details concise (under 15 words each)
- Give exactly 2-3 items for whatsWorking and consider each
- Reference specific principles when relevant ("rule of thirds", "complementary colors", etc.)
- Be specific but brief

SCORING GUIDE:
- 1-4: Significant issues (rare - be constructive)
- 5-6: Works but has clear room for improvement
- 7-8: Good outfit, minor tweaks possible (most outfits)
- 9-10: Excellent, well-executed (reserve for standouts)`;

interface UserContext {
  stylePreferences?: any;
  bodyType?: string | null;
  colorSeason?: string | null;
  height?: string | null;
  lifestyle?: string[];
  fashionGoals?: string[];
  fitPreference?: string | null;
  budgetLevel?: string | null;
}

async function getCalibrationContext(): Promise<string | null> {
  try {
    // Find outfits with both AI and community scores
    const calibrationData = await prisma.outfitCheck.findMany({
      where: {
        aiScore: { not: null },
        communityScoreCount: { gte: 3 }, // At least 3 community votes
      },
      select: { aiScore: true, communityAvgScore: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    if (calibrationData.length < 10 || calibrationData.length === 0) return null;

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

function buildUserPrompt(input: OutfitCheckInput, user?: UserContext, feedbackHistory?: string[], calibrationContext?: string | null): string {
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

    // Physical attributes
    if (user.height) {
      parts.push(`- Height: ${user.height} (consider proportion guidelines)`);
    }

    if (user.bodyType) {
      parts.push(`- Body type: ${user.bodyType} (apply body balance guidelines)`);
    }

    if (user.colorSeason) {
      parts.push(`- Color season: ${user.colorSeason} (recommend flattering color tones)`);
    }

    // Preferences
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

    // Style preferences from JSON
    if (user.stylePreferences) {
      const prefs = user.stylePreferences;
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

  // Add feedback history insights
  if (feedbackHistory && feedbackHistory.length > 0) {
    parts.push('', 'Past Feedback Patterns:');
    feedbackHistory.forEach(insight => {
      parts.push(`- ${insight}`);
    });
  }

  // Add calibration context
  if (calibrationContext) {
    parts.push('', `Calibration note: ${calibrationContext}`);
  }

  parts.push('', 'Provide your analysis as JSON, using all context above to personalize recommendations.');

  return parts.join('\n');
}

// Helper to strip markdown code fences from JSON responses
function stripMarkdownFences(text: string): string {
  // Remove ```json and ``` markers if present
  return text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

// Get user's past feedback patterns to personalize advice
async function getStyleInsights(userId: string): Promise<string[]> {
  try {
    const insights: string[] = [];

    const styleDNAs = await prisma.styleDNA.findMany({
      where: { userId },
      include: { outfitCheck: { select: { aiScore: true, feedbackHelpful: true, occasions: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (styleDNAs.length < 3) return insights; // Need enough data

    // 1. Best scoring color combinations
    const byColorHarmony = new Map<string, number[]>();
    styleDNAs.forEach(dna => {
      if (dna.colorHarmony && dna.outfitCheck.aiScore) {
        const scores = byColorHarmony.get(dna.colorHarmony) || [];
        scores.push(dna.outfitCheck.aiScore);
        byColorHarmony.set(dna.colorHarmony, scores);
      }
    });
    const bestHarmony = [...byColorHarmony.entries()]
      .filter(([_, scores]) => scores.length > 0)
      .map(([harmony, scores]) => ({ harmony, avg: scores.reduce((a, b) => a + b) / scores.length, count: scores.length }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.avg - a.avg);
    if (bestHarmony.length > 0) {
      insights.push(`User's ${bestHarmony[0].harmony} color outfits score highest (avg ${bestHarmony[0].avg.toFixed(1)})`);
    }

    // 2. Strongest and weakest sub-scores
    const avgScores = {
      color: 0, proportion: 0, fit: 0, coherence: 0, count: 0,
    };
    styleDNAs.forEach(dna => {
      if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
        avgScores.color += dna.colorScore;
        avgScores.proportion += dna.proportionScore;
        avgScores.fit += dna.fitScore;
        avgScores.coherence += dna.coherenceScore;
        avgScores.count++;
      }
    });
    if (avgScores.count >= 3) {
      const n = avgScores.count;
      const dimensions = [
        { name: 'color coordination', avg: avgScores.color / n },
        { name: 'proportions', avg: avgScores.proportion / n },
        { name: 'fit', avg: avgScores.fit / n },
        { name: 'style coherence', avg: avgScores.coherence / n },
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

    // 4. Favorite colors (most frequently used that score well)
    const colorScores = new Map<string, { total: number; count: number }>();
    styleDNAs.forEach(dna => {
      if (dna.outfitCheck.aiScore) {
        dna.dominantColors.forEach(color => {
          const entry = colorScores.get(color) || { total: 0, count: 0 };
          entry.total += dna.outfitCheck.aiScore!;
          entry.count++;
          colorScores.set(color, entry);
        });
      }
    });
    const topColors = [...colorScores.entries()]
      .filter(([_, v]) => v.count >= 2)
      .map(([color, v]) => ({ color, avg: v.total / v.count, count: v.count }))
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

export async function analyzeOutfit(
  outfitCheckId: string,
  input: OutfitCheckInput,
  user?: UserContext
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

  // Get userId from outfit check to fetch feedback history
  let feedbackHistory: string[] = [];
  let calibrationContext: string | null = null;
  try {
    const outfitCheck = await prisma.outfitCheck.findUnique({
      where: { id: outfitCheckId },
      select: { userId: true },
    });

    if (outfitCheck) {
      feedbackHistory = await getStyleInsights(outfitCheck.userId);
      calibrationContext = await getCalibrationContext();
    }
  } catch (error) {
    console.error('Failed to load feedback history:', error);
    // Continue without history if this fails
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048, // Prevent truncation
          responseMimeType: 'application/json', // Force JSON format
          responseSchema: {
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
          }
        },
      });

      // Prepare image data for Gemini
      let imagePart;
      if (input.imageBase64) {
        // Base64 image data
        imagePart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: input.imageBase64,
          },
        };
      } else if (input.imageUrl) {
        // For URL-based images, we'd need to fetch and convert to base64
        // For now, throw error if imageBase64 is not provided
        throw new Error('Image must be provided as base64 data');
      } else {
        throw new Error('No image data provided');
      }

      const result = await model.generateContent([
        buildUserPrompt(input, user, feedbackHistory, calibrationContext),
        imagePart,
      ]);

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON response (strip any markdown fences first)
      const cleanContent = stripMarkdownFences(content);

      // Try to parse JSON - if it fails, log the raw content for debugging
      let feedback: OutfitFeedback;
      try {
        feedback = JSON.parse(cleanContent) as OutfitFeedback;
      } catch (parseError) {
        console.error('JSON parse error. Raw content:', cleanContent.substring(0, 500));
        throw new Error(`Invalid JSON from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validate response structure
      if (
        typeof feedback.overallScore !== 'number' ||
        !feedback.summary ||
        !Array.isArray(feedback.whatsWorking)
      ) {
        throw new Error('Invalid feedback structure');
      }

      // Update database with feedback
      await prisma.outfitCheck.update({
        where: { id: outfitCheckId },
        data: {
          aiFeedback: feedback as any,
          aiScore: feedback.overallScore,
          aiProcessedAt: new Date(),
        },
      });

      // Save Style DNA to separate table for querying
      if (feedback.styleDNA) {
        try {
          // Fetch userId from outfit check for StyleDNA record
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
          // Continue even if StyleDNA save fails
        }
      }

      return feedback;
    } catch (error) {
      console.error(`AI feedback attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // If all retries failed, return a fallback response
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
    },
  });

  return fallbackFeedback;
}

export async function handleFollowUpQuestion(
  outfitCheckId: string,
  question: string
): Promise<string> {
  // Get original outfit check and feedback
  const outfitCheck = await prisma.outfitCheck.findUnique({
    where: { id: outfitCheckId },
    include: { followUps: true },
  });

  if (!outfitCheck) {
    throw new Error('Outfit check not found');
  }

  const previousFeedback = outfitCheck.aiFeedback as unknown as OutfitFeedback;
  const previousScore = outfitCheck.aiScore;

  const systemPrompt = `You are continuing a conversation about an outfit you previously analyzed.

Previous analysis summary: ${previousFeedback?.summary || 'N/A'}
Score given: ${previousScore}/10

The user has a follow-up question. Answer helpfully and specifically, keeping your warm, supportive tone. If they ask for product recommendations, suggest general categories/styles rather than specific brands (unless they ask).

Keep responses concise (2-4 sentences) but helpful.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800, // Increased from 300 to allow full responses
      },
    });

    const result = await model.generateContent(question);
    const response = await result.response;
    const answer = response.text() || 'I apologize, but I could not generate a response. Please try again.';

    // Save follow-up to database
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
