import { prisma } from '../utils/prisma.js';

export interface OutfitMemory {
  id: string;
  aiScore: number;
  occasion: string;
  thumbnailUrl: string | null;
  thumbnailData: string | null;
  summary: string | null;
  createdAt: string;
}

/**
 * Compute a per-user memory threshold = userAvgScore + 0.5, clamped to [6.0, 8.5].
 * Users with a low avg score (e.g. 5.8) always got null before; now they get their best outfit.
 * Users with a high avg score (e.g. 8.5) don't see mediocre memories.
 */
async function getMemoryThreshold(userId: string): Promise<number> {
  const agg = await prisma.outfitCheck.aggregate({
    where: { userId, isDeleted: false, aiProcessedAt: { not: null }, aiScore: { not: null } },
    _avg: { aiScore: true },
  });
  const avg = agg._avg.aiScore;
  if (!avg) return 7.0; // default before enough data
  return Math.max(6.0, Math.min(8.5, avg + 0.5));
}

export async function getOutfitMemory(
  userId: string,
  occasions: string[],
): Promise<OutfitMemory | null> {
  if (!occasions.length) return null;

  const threshold = await getMemoryThreshold(userId);

  const match = await prisma.outfitCheck.findFirst({
    where: {
      userId,
      isDeleted: false,
      aiProcessedAt: { not: null },
      aiScore: { gte: threshold },
      occasions: { hasSome: occasions },
    },
    orderBy: { aiScore: 'desc' },
    select: {
      id: true,
      aiScore: true,
      occasions: true,
      thumbnailUrl: true,
      thumbnailData: true,
      aiFeedback: true,
      createdAt: true,
    },
  });

  if (!match || !match.aiScore) return null;

  const matchingOccasion =
    occasions.find((o) => match.occasions.includes(o)) || match.occasions[0];
  const feedback = match.aiFeedback as any;
  // Support both v3.0 (editorialSummary) and legacy v2.0 (summary) formats
  const summary: string | null = feedback?.editorialSummary || feedback?.summary || null;

  return {
    id: match.id,
    aiScore: match.aiScore,
    occasion: matchingOccasion,
    thumbnailUrl: match.thumbnailUrl,
    thumbnailData: match.thumbnailData,
    summary,
    createdAt: match.createdAt.toISOString(),
  };
}
