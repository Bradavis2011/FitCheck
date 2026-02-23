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

export async function getOutfitMemory(
  userId: string,
  occasions: string[],
): Promise<OutfitMemory | null> {
  if (!occasions.length) return null;

  const match = await prisma.outfitCheck.findFirst({
    where: {
      userId,
      isDeleted: false,
      aiProcessedAt: { not: null },
      aiScore: { gte: 7.0 },
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
  const summary: string | null = feedback?.summary || null;

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
