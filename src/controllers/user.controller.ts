import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(150, 'Bio must be at most 150 characters').optional(),
  isPublic: z.boolean().optional(),
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
        username: true,
        bio: true,
        isPublic: true,
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

    // If username is being updated, check for uniqueness
    if (data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId }, // Exclude current user
        },
      });

      if (existingUser) {
        throw new AppError(400, 'Username is already taken. Please choose a different one.');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        bio: true,
        isPublic: true,
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
      const firstError = error.errors[0];
      throw new AppError(400, firstError.message || 'Invalid request data');
    }
    throw error;
  }
}

export async function getUserStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        dailyChecksUsed: true,
      },
    });

    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    const outfitCount = await prisma.outfitCheck.count({
      where: { userId, isDeleted: false },
    });

    const favoriteCount = await prisma.outfitCheck.count({
      where: { userId, isFavorite: true, isDeleted: false },
    });

    // Calculate daily checks limit based on tier
    const dailyChecksLimit = user?.tier === 'free' ? 3 : 999;
    const dailyChecksUsed = user?.dailyChecksUsed || 0;
    const dailyChecksRemaining = Math.max(0, dailyChecksLimit - dailyChecksUsed);

    res.json({
      ...stats,
      totalOutfits: outfitCount,
      totalFavorites: favoriteCount,
      dailyChecksUsed,
      dailyChecksLimit,
      dailyChecksRemaining,
    });
  } catch (error) {
    throw error;
  }
}
