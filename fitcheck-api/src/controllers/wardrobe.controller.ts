import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const VALID_CATEGORIES = ['tops', 'bottoms', 'shoes', 'accessories', 'outerwear'] as const;

const CreateItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum(VALID_CATEGORIES),
  color: z.string().max(50).optional(),
  imageUrl: z.string().optional(),
});

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  color: z.string().max(50).optional(),
  imageUrl: z.string().optional().nullable(),
});

// GET /api/wardrobe?category=tops&source=ai-detected
export async function listWardrobeItems(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { category, source } = req.query;

  const where: { userId: string; category?: string; source?: string } = { userId };
  if (category && VALID_CATEGORIES.includes(category as any)) {
    where.category = category as string;
  }
  if (source === 'ai-detected' || source === 'manual') {
    where.source = source;
  }

  const items = await prisma.wardrobeItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { timesWorn: 'desc' }],
    include: { _count: { select: { outfitLinks: true } } },
  });

  res.json({ items });
}

// GET /api/wardrobe/progress
export async function getWardrobeProgress(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const UNLOCK_THRESHOLD = 10;

  const [outfitCheckCount, wardrobeItemCount, categoryCounts] = await Promise.all([
    prisma.outfitCheck.count({ where: { userId, isDeleted: false } }),
    prisma.wardrobeItem.count({ where: { userId } }),
    prisma.wardrobeItem.groupBy({
      by: ['category'],
      where: { userId },
      _count: { id: true },
    }),
  ]);

  const isUnlocked = outfitCheckCount >= UNLOCK_THRESHOLD;
  const progress = Math.min(outfitCheckCount, UNLOCK_THRESHOLD);

  const categoryCountsMap: Record<string, number> = {};
  for (const row of categoryCounts) {
    categoryCountsMap[row.category] = row._count.id;
  }

  res.json({
    outfitCheckCount,
    wardrobeItemCount,
    unlockThreshold: UNLOCK_THRESHOLD,
    isUnlocked,
    progress,
    categoryCounts: categoryCountsMap,
  });
}

// GET /api/wardrobe/:id/outfits
export async function getWardrobeItemOutfits(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const item = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!item) throw new AppError(404, 'Item not found');

  const links = await prisma.wardrobeItemOutfit.findMany({
    where: { wardrobeItemId: id },
    include: {
      outfitCheck: {
        select: {
          id: true,
          thumbnailUrl: true,
          thumbnailData: true,
          aiScore: true,
          createdAt: true,
          occasions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ outfits: links.map((l) => l.outfitCheck) });
}

// GET /api/wardrobe/:id
export async function getWardrobeItem(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const item = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!item) throw new AppError(404, 'Item not found');

  res.json({ item });
}

// POST /api/wardrobe
export async function createWardrobeItem(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const body = CreateItemSchema.parse(req.body);

  const item = await prisma.wardrobeItem.create({
    data: {
      userId,
      name: body.name,
      category: body.category,
      color: body.color ?? null,
      imageUrl: body.imageUrl ?? null,
    },
  });

  res.status(201).json({ item });
}

// PUT /api/wardrobe/:id
export async function updateWardrobeItem(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const body = UpdateItemSchema.parse(req.body);

  const existing = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Item not found');

  const item = await prisma.wardrobeItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
    },
  });

  res.json({ item });
}

// DELETE /api/wardrobe/:id
export async function deleteWardrobeItem(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Item not found');

  await prisma.wardrobeItem.delete({ where: { id } });

  res.json({ success: true });
}

// POST /api/wardrobe/:id/wear — log a wear, increment timesWorn, set lastWorn
export async function logWear(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.wardrobeItem.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Item not found');

  const item = await prisma.wardrobeItem.update({
    where: { id },
    data: {
      timesWorn: { increment: 1 },
      lastWorn: new Date(),
    },
  });

  res.json({ item });
}
