import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  stylePreferences: z.record(z.any()).optional(),
  bodyType: z.string().optional(),
  colorSeason: z.string().optional(),
});

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        stylePreferences: true,
        bodyType: true,
        colorSeason: true,
        tier: true,
        subscriptionExpiresAt: true,
        dailyChecksUsed: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json(user);
  } catch (error) {
    throw error;
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const data = UpdateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        stylePreferences: true,
        bodyType: true,
        colorSeason: true,
        tier: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}

export async function getUserStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    const outfitCount = await prisma.outfitCheck.count({
      where: { userId, isDeleted: false },
    });

    const favoriteCount = await prisma.outfitCheck.count({
      where: { userId, isFavorite: true, isDeleted: false },
    });

    res.json({
      ...stats,
      totalOutfits: outfitCount,
      totalFavorites: favoriteCount,
    });
  } catch (error) {
    throw error;
  }
}
