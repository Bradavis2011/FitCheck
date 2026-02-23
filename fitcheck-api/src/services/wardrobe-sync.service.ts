import { prisma } from '../utils/prisma.js';

// Category keyword lookup — order matters: more specific substrings first
const CATEGORY_MAP: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['sneaker', 'heel', 'boot', 'loafer', 'sandal', 'flat', 'pump', 'oxford', 'mule', 'clog', 'slipper', 'wedge', 'espadrille', 'shoe', 'footwear', 'trainer'], category: 'shoes' },
  { keywords: ['blazer', 'jacket', 'coat', 'parka', 'trench', 'cardigan', 'hoodie', 'vest', 'puffer', 'windbreaker', 'overcoat', 'raincoat', 'anorak', 'cape', 'poncho', 'peacoat'], category: 'outerwear' },
  { keywords: ['trouser', 'pant', 'jeans', 'denim', 'shorts', 'skirt', 'chino', 'legging', 'jogger', 'sweatpant', 'cargo', 'slacks', 'culotte', 'palazzo'], category: 'bottoms' },
  { keywords: ['bag', 'handbag', 'purse', 'clutch', 'tote', 'backpack', 'satchel', 'crossbody', 'wallet', 'belt', 'hat', 'cap', 'beanie', 'scarf', 'tie', 'bow tie', 'watch', 'bracelet', 'necklace', 'earring', 'ring', 'sunglasses', 'glasses', 'glove', 'sock', 'stocking', 'jewelry', 'accessory'], category: 'accessories' },
  { keywords: ['shirt', 'blouse', 'top', 'tee', 't-shirt', 'tank', 'cami', 'crop', 'polo', 'sweater', 'pullover', 'turtleneck', 'henley', 'tunic', 'bodysuit', 'bralette', 'wrap'], category: 'tops' },
];

// Common color prefixes to strip when computing base name
const COLOR_WORDS = new Set([
  'black', 'white', 'gray', 'grey', 'navy', 'blue', 'red', 'green', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'beige', 'tan', 'cream', 'ivory', 'olive', 'teal', 'coral',
  'burgundy', 'maroon', 'mustard', 'lavender', 'mint', 'camel', 'khaki', 'charcoal',
  'cobalt', 'indigo', 'sage', 'blush', 'mauve', 'nude', 'taupe', 'rust', 'gold', 'silver',
  'light', 'dark', 'bright', 'deep', 'pale', 'pastel',
]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/grey/g, 'gray');
}

function resolveCategory(normalized: string): string | null {
  for (const { keywords, category } of CATEGORY_MAP) {
    for (const kw of keywords) {
      if (normalized === kw) return category; // exact word match
    }
  }
  // Substring match
  for (const { keywords, category } of CATEGORY_MAP) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) return category;
    }
  }
  return null;
}

function extractColorAndBase(normalized: string): { color: string | null; baseName: string } {
  const words = normalized.split(' ');
  const colorWords: string[] = [];
  const baseWords: string[] = [];
  let foundNonColor = false;

  for (const word of words) {
    if (!foundNonColor && COLOR_WORDS.has(word)) {
      colorWords.push(word);
    } else {
      foundNonColor = true;
      baseWords.push(word);
    }
  }

  return {
    color: colorWords.length > 0 ? colorWords.join(' ') : null,
    baseName: baseWords.join(' ') || normalized,
  };
}

export async function syncGarmentsToWardrobe(
  userId: string,
  outfitCheckId: string,
  garments: string[],
  _dominantColors: string[]
): Promise<void> {
  if (!garments || garments.length === 0) return;

  for (const garment of garments) {
    try {
      const normalized = normalizeName(garment);
      if (!normalized) continue;

      const category = resolveCategory(normalized);
      if (!category) {
        console.log(`[WardrobeSync] Skipping uncategorizable garment: "${garment}"`);
        continue;
      }

      const { color, baseName } = extractColorAndBase(normalized);

      // 1. Try exact normalizedName match
      let existing = await prisma.wardrobeItem.findFirst({
        where: { userId, normalizedName: normalized },
      });

      // 2. Fuzzy match: same category + same baseName
      if (!existing) {
        const candidates = await prisma.wardrobeItem.findMany({
          where: { userId, category },
        });
        existing = candidates.find((c) => {
          if (!c.normalizedName) return false;
          const { baseName: candidateBase } = extractColorAndBase(c.normalizedName);
          return candidateBase === baseName;
        }) ?? null;
      }

      let wardrobeItemId: string;

      if (existing) {
        wardrobeItemId = existing.id;
      } else {
        // Create new item
        const newItem = await prisma.wardrobeItem.create({
          data: {
            userId,
            name: garment.trim(),
            category,
            color,
            source: 'ai-detected',
            normalizedName: normalized,
          },
        });
        wardrobeItemId = newItem.id;
      }

      // Create link (upsert by unique constraint)
      await prisma.wardrobeItemOutfit.upsert({
        where: {
          wardrobeItemId_outfitCheckId: { wardrobeItemId, outfitCheckId },
        },
        create: { wardrobeItemId, outfitCheckId, detectedName: garment.trim() },
        update: {},
      });

      // Recalculate timesWorn from link count
      const linkCount = await prisma.wardrobeItemOutfit.count({ where: { wardrobeItemId } });
      await prisma.wardrobeItem.update({
        where: { id: wardrobeItemId },
        data: { timesWorn: linkCount, lastWorn: new Date() },
      });
    } catch (err) {
      console.error(`[WardrobeSync] Error processing garment "${garment}":`, err);
      // Non-fatal: continue with next garment
    }
  }
}
