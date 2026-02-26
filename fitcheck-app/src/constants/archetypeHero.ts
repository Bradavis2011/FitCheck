/**
 * A7: StyleDNA archetype hero copy variants.
 * Maps top style archetype → personalized home screen hero prompt + subtitle.
 * ~8 cohorts derived from the most common styleArchetypes in StyleDNA.
 */

export interface HeroCopy {
  prompt: string;
  sub: string;
}

export const archetypeHeroMap: Record<string, HeroCopy> = {
  Minimalist: {
    prompt: 'Precision is\nyour signature.',
    sub: 'Clean lines. Quiet confidence.',
  },
  Classic: {
    prompt: 'Timeless is\nyour default.',
    sub: 'Effortless polish, every time.',
  },
  Streetwear: {
    prompt: 'Make noise\ntoday.',
    sub: 'Bold looks. No apologies.',
  },
  Maximalist: {
    prompt: 'More is more.\nAlways.',
    sub: 'Your style speaks loudest.',
  },
  Romantic: {
    prompt: 'Soft power\nsuits you.',
    sub: 'Feminine, on your own terms.',
  },
  Bohemian: {
    prompt: 'Free-spirited\nand styled.',
    sub: 'Rules are just suggestions.',
  },
  Preppy: {
    prompt: 'Polished and\nput-together.',
    sub: 'The details tell the story.',
  },
  Edgy: {
    prompt: 'Unexpected\nis your vibe.',
    sub: 'Fashion as self-expression.',
  },
};

export const DEFAULT_HERO: HeroCopy = {
  prompt: 'What are you\nwearing today?',
  sub: 'No sugarcoating. Honest AI feedback.',
};

export function getHeroCopy(topArchetype?: string | null): HeroCopy {
  if (!topArchetype) return DEFAULT_HERO;
  // Try exact match, then case-insensitive prefix match
  if (archetypeHeroMap[topArchetype]) return archetypeHeroMap[topArchetype];
  const key = Object.keys(archetypeHeroMap).find(
    k => topArchetype.toLowerCase().includes(k.toLowerCase())
  );
  return key ? archetypeHeroMap[key] : DEFAULT_HERO;
}
