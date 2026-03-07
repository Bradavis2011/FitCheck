import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });
}

export interface OutfitSuggestionItem {
  wardrobeItemId: string;
  name: string;
  category: string;
  color: string | null;
  role: string; // e.g. "anchor", "complement", "accent"
}

export interface OutfitSuggestion {
  items: OutfitSuggestionItem[];
  reasoning: string;
  styleNotes: string[];
  missingPieces?: string[];
}

export interface VirtualOutfitAnalysis {
  overallScore: number;
  editorialSummary: string;
  whatsRight: string[];
  couldImprove: string[];
  quickSwaps: Array<{ current: string; swap: string; reason: string }>;
}

export async function suggestOutfitFromWardrobe(
  userId: string,
  context?: { occasion?: string; weather?: string; vibe?: string }
): Promise<OutfitSuggestion> {
  const [wardrobeItems, styleDnaEntries] = await Promise.all([
    prisma.wardrobeItem.findMany({
      where: { userId },
      orderBy: [{ timesWorn: 'desc' }],
    }),
    prisma.styleDNA.findMany({
      where: { outfitCheck: { userId, isDeleted: false } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        styleArchetypes: true,
        dominantColors: true,
        formalityLevel: true,
        colorHarmony: true,
      },
    }),
  ]);

  if (wardrobeItems.length < 3) {
    // Fallback: text suggestions without IDs
    return {
      items: [],
      reasoning: 'Add at least 3 items to your wardrobe to get AI outfit suggestions.',
      styleNotes: [
        'Start with a neutral top (white, black, or grey)',
        'Add a versatile bottom that pairs with multiple tops',
        'Choose shoes that work for your most common occasions',
      ],
      missingPieces: ['More wardrobe items needed'],
    };
  }

  const contextStr = [
    context?.occasion ? `Occasion: ${context.occasion}` : null,
    context?.weather ? `Weather: ${context.weather}` : null,
    context?.vibe ? `Vibe: ${context.vibe}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const styleSummary = styleDnaEntries.length > 0
    ? `User's style archetypes: ${[...new Set(styleDnaEntries.flatMap((s) => s.styleArchetypes))].slice(0, 5).join(', ')}`
    : 'No style history yet.';

  const itemList = wardrobeItems
    .map((i) => `ID:${i.id} | ${i.name} | ${i.category} | color: ${i.color ?? 'unknown'} | worn: ${i.timesWorn}x`)
    .join('\n');

  const prompt = `You are an AI fashion stylist. Select 2-4 items from this wardrobe to build an outfit.

${contextStr ? `CONTEXT:\n${contextStr}\n` : ''}
STYLE PROFILE:
${styleSummary}

WARDROBE ITEMS (one per line):
${itemList}

Return a JSON object with this exact structure:
{
  "selectedIds": ["<wardrobeItemId>", ...],
  "roles": { "<wardrobeItemId>": "<anchor|complement|accent>" },
  "reasoning": "<2-3 sentence editorial explanation>",
  "styleNotes": ["<tip 1>", "<tip 2>"],
  "missingPieces": ["<optional item that would complete this look>"]
}

Rules:
- Only use IDs from the wardrobe list above
- Select 2-4 items across different categories when possible
- missingPieces is optional — only include if genuinely useful
- Keep reasoning concise and editorial (Vogue-desk voice)`;

  let parsed: {
    selectedIds: string[];
    roles: Record<string, string>;
    reasoning: string;
    styleNotes: string[];
    missingPieces?: string[];
  };

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[WardrobeAI] suggestOutfit failed:', err);
    // Return first 3 items as a basic fallback
    const fallbackItems = wardrobeItems.slice(0, 3);
    return {
      items: fallbackItems.map((i, idx) => ({
        wardrobeItemId: i.id,
        name: i.name,
        category: i.category,
        color: i.color,
        role: idx === 0 ? 'anchor' : 'complement',
      })),
      reasoning: 'Here are some items from your wardrobe to start with.',
      styleNotes: ['Try different combinations to find what works for you'],
    };
  }

  // Validate returned IDs against actual wardrobe — drop hallucinated IDs
  const validIdSet = new Set(wardrobeItems.map((i) => i.id));
  const validIds = (parsed.selectedIds ?? []).filter((id) => validIdSet.has(id));

  const itemMap = new Map(wardrobeItems.map((i) => [i.id, i]));
  const items: OutfitSuggestionItem[] = validIds.map((id) => {
    const item = itemMap.get(id)!;
    return {
      wardrobeItemId: id,
      name: item.name,
      category: item.category,
      color: item.color,
      role: parsed.roles?.[id] ?? 'complement',
    };
  });

  return {
    items,
    reasoning: parsed.reasoning ?? '',
    styleNotes: Array.isArray(parsed.styleNotes) ? parsed.styleNotes : [],
    missingPieces: Array.isArray(parsed.missingPieces) && parsed.missingPieces.length > 0
      ? parsed.missingPieces
      : undefined,
  };
}

export async function analyzeVirtualOutfit(
  userId: string,
  itemIds: string[],
  context?: { occasion?: string; weather?: string; vibe?: string }
): Promise<VirtualOutfitAnalysis> {
  // Validate items belong to user
  const items = await prisma.wardrobeItem.findMany({
    where: { id: { in: itemIds }, userId },
  });

  if (items.length < 2) {
    throw new Error('At least 2 valid wardrobe items required for virtual analysis');
  }

  // Fetch full wardrobe for swap suggestions
  const allItems = await prisma.wardrobeItem.findMany({ where: { userId } });

  const contextStr = [
    context?.occasion ? `Occasion: ${context.occasion}` : null,
    context?.weather ? `Weather: ${context.weather}` : null,
    context?.vibe ? `Vibe: ${context.vibe}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const outfitList = items
    .map((i) => `- ${i.name} (${i.category}, color: ${i.color ?? 'unknown'})`)
    .join('\n');

  // Potential swaps: items NOT in current selection, grouped by category
  const selectedCategories = new Set(items.map((i) => i.category));
  const swapCandidates = allItems
    .filter((i) => !itemIds.includes(i.id) && selectedCategories.has(i.category))
    .slice(0, 10)
    .map((i) => `ID:${i.id} | ${i.name} | ${i.category} | ${i.color ?? 'no color'}`)
    .join('\n');

  const prompt = `You are an AI fashion editor analyzing a virtual outfit (text-only — no photo).

OUTFIT ITEMS:
${outfitList}

${contextStr ? `CONTEXT:\n${contextStr}\n` : ''}
${swapCandidates ? `WARDROBE ALTERNATIVES FOR SWAPS:\n${swapCandidates}\n` : ''}
Analyze this outfit focusing on color coordination, style coherence, and occasion appropriateness.

IMPORTANT: This is a text-only analysis. Score between 5-8 only — never 9 or 10 (those require a photo).
Tell the user: scores reflect wardrobe data only; take a photo for precise visual analysis.

Return a JSON object with this exact structure:
{
  "overallScore": <number 5-8>,
  "editorialSummary": "<2-3 sentence editorial summary in Vogue voice, mention it's based on wardrobe data>",
  "whatsRight": ["<observation>", ...],
  "couldImprove": ["<suggestion>", ...],
  "quickSwaps": [
    { "current": "<item name>", "swap": "<swap item name from wardrobe>", "reason": "<why>" }
  ]
}

Rules:
- whatsRight: 2-4 items
- couldImprove: 1-3 items
- quickSwaps: 0-2 items using only items from the WARDROBE ALTERNATIVES list
- If no good swaps, return empty array for quickSwaps`;

  let parsed: VirtualOutfitAnalysis;

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[WardrobeAI] analyzeVirtualOutfit failed:', err);
    throw new Error('AI analysis temporarily unavailable. Please try again.');
  }

  // Clamp score to 5-8
  const clampedScore = Math.min(8, Math.max(5, parsed.overallScore ?? 6));

  return {
    overallScore: clampedScore,
    editorialSummary: parsed.editorialSummary ?? 'Analysis complete.',
    whatsRight: Array.isArray(parsed.whatsRight) ? parsed.whatsRight : [],
    couldImprove: Array.isArray(parsed.couldImprove) ? parsed.couldImprove : [],
    quickSwaps: Array.isArray(parsed.quickSwaps) ? parsed.quickSwaps : [],
  };
}
