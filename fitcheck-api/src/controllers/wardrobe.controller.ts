import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { suggestOutfitFromWardrobe, analyzeVirtualOutfit } from '../services/wardrobe-intelligence.service.js';

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

// Feature thresholds: how many outfit checks unlock each feature
const FEATURE_THRESHOLDS = {
  manual_wardrobe: 0,       // Day 1 — add/edit/delete/view
  outfit_builder: 0,        // Day 1 — requires 3+ items in wardrobe
  ai_item_sync: 1,          // First check auto-populates wardrobe
  virtual_analysis: 3,      // Text AI feedback on outfit combos
  ai_outfit_suggestions: 5, // Gemini proposes combos
} as const;

// GET /api/wardrobe/progress
export async function getWardrobeProgress(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const [outfitCheckCount, wardrobeItemCount, categoryCounts] = await Promise.all([
    prisma.outfitCheck.count({ where: { userId, isDeleted: false } }),
    prisma.wardrobeItem.count({ where: { userId } }),
    prisma.wardrobeItem.groupBy({
      by: ['category'],
      where: { userId },
      _count: { id: true },
    }),
  ]);

  const categoryCountsMap: Record<string, number> = {};
  for (const row of categoryCounts) {
    categoryCountsMap[row.category] = row._count.id;
  }

  // Build feature unlock map
  const features: Record<string, { unlocked: boolean; threshold: number }> = {};
  for (const [key, threshold] of Object.entries(FEATURE_THRESHOLDS)) {
    features[key] = { unlocked: outfitCheckCount >= threshold, threshold };
  }

  // Next milestone: the lowest threshold the user hasn't reached yet
  const nextMilestone = Object.values(FEATURE_THRESHOLDS)
    .filter((t) => t > outfitCheckCount)
    .sort((a, b) => a - b)[0] ?? null;

  // Backward-compat: isUnlocked = ai_item_sync unlocked (1+ checks)
  const isUnlocked = outfitCheckCount >= FEATURE_THRESHOLDS.ai_item_sync;

  res.json({
    outfitCheckCount,
    wardrobeItemCount,
    // Legacy fields — kept for backward compat
    unlockThreshold: FEATURE_THRESHOLDS.ai_item_sync,
    isUnlocked,
    progress: Math.min(outfitCheckCount, FEATURE_THRESHOLDS.ai_item_sync),
    categoryCounts: categoryCountsMap,
    // New fields
    features,
    nextMilestone,
  });
}

// POST /api/wardrobe/suggest-outfit
export async function suggestOutfit(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  // Threshold check: 5 outfit checks required
  const checkCount = await prisma.outfitCheck.count({ where: { userId, isDeleted: false } });
  if (checkCount < FEATURE_THRESHOLDS.ai_outfit_suggestions) {
    throw new AppError(403, `Complete ${FEATURE_THRESHOLDS.ai_outfit_suggestions} outfit checks to unlock AI outfit suggestions. You have ${checkCount}.`);
  }

  const { occasion, weather, vibe } = req.body as { occasion?: string; weather?: string; vibe?: string };
  const context = { occasion, weather, vibe };

  const suggestion = await suggestOutfitFromWardrobe(userId, context);
  res.json(suggestion);
}

// POST /api/wardrobe/analyze-outfit
export async function analyzeOutfit(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  // Threshold check: 3 outfit checks required
  const checkCount = await prisma.outfitCheck.count({ where: { userId, isDeleted: false } });
  if (checkCount < FEATURE_THRESHOLDS.virtual_analysis) {
    throw new AppError(403, `Complete ${FEATURE_THRESHOLDS.virtual_analysis} outfit checks to unlock virtual outfit analysis. You have ${checkCount}.`);
  }

  const BodySchema = z.object({
    itemIds: z.array(z.string().uuid()).min(2).max(6),
    occasion: z.string().optional(),
    weather: z.string().optional(),
    vibe: z.string().optional(),
  });
  const body = BodySchema.parse(req.body);

  const result = await analyzeVirtualOutfit(userId, body.itemIds, {
    occasion: body.occasion,
    weather: body.weather,
    vibe: body.vibe,
  });
  res.json(result);
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

// GET /api/wardrobe/daily-look — Plus/Pro: AI outfit suggestion from wardrobe + weather
export async function getDailyLook(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, city: true },
  });

  if (!user || user.tier === 'free') {
    res.json({ available: false, reason: 'upgrade' });
    return;
  }

  const itemCount = await prisma.wardrobeItem.count({ where: { userId } });
  if (itemCount < 5) {
    res.json({ available: false, reason: 'insufficient_wardrobe', itemCount });
    return;
  }

  let weather = null;
  if (user.city) {
    try {
      const { getWeatherForCity } = await import('../services/weather.service.js');
      weather = await getWeatherForCity(user.city);
    } catch {
      // non-fatal
    }
  }

  const context = weather
    ? { weather: weather.promptText || `${weather.condition}, ${weather.tempFahrenheit}°F` }
    : undefined;

  const suggestion = await suggestOutfitFromWardrobe(userId, context);
  res.json({ available: true, suggestion, weather });
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
