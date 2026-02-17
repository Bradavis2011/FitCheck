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

// GET /api/wardrobe?category=tops
export async function listWardrobeItems(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { category } = req.query;

  const where: { userId: string; category?: string } = { userId };
  if (category && VALID_CATEGORIES.includes(category as any)) {
    where.category = category as string;
  }

  const items = await prisma.wardrobeItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { timesWorn: 'desc' }],
  });

  res.json({ items });
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
