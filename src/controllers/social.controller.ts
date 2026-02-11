import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

// Search for public users
export async function searchUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      throw new AppError(400, 'Search query must be at least 2 characters');
    }

    const users = await prisma.user.findMany({
      where: {
        isPublic: true,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        profileImageUrl: true,
        bio: true,
      },
      take: 20,
    });

    res.json({ users });
  } catch (error) {
    throw error;
  }
}

// Get public user profile
export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id, isPublic: true },
      select: {
        id: true,
        username: true,
        name: true,
        profileImageUrl: true,
        bio: true,
        createdAt: true,
        outfitChecks: {
          where: { isPublic: true, isDeleted: false },
          select: {
            id: true,
            thumbnailData: true,
            occasions: true,
            aiScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found or profile is private');
    }

    res.json({
      ...user,
      outfitCount: user.outfitChecks.length,
    });
  } catch (error) {
    throw error;
  }
}

// Get community feed (public outfits)
export async function getCommunityFeed(req: AuthenticatedRequest, res: Response) {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const outfits = await prisma.outfitCheck.findMany({
      where: {
        isPublic: true,
        isDeleted: false,
        user: { isPublic: true },
      },
      select: {
        id: true,
        thumbnailData: true,
        occasions: true,
        aiScore: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: {
            communityFeedback: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.outfitCheck.count({
      where: {
        isPublic: true,
        isDeleted: false,
        user: { isPublic: true },
      },
    });

    res.json({
      outfits,
      total,
      hasMore: total > parseInt(offset as string) + outfits.length,
    });
  } catch (error) {
    throw error;
  }
}

// Submit community feedback
const FeedbackSchema = z.object({
  outfitId: z.string(),
  score: z.number().int().min(1).max(10),
  comment: z.string().min(1).max(500),
});

export async function submitCommunityFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const data = FeedbackSchema.parse(req.body);

    // Verify outfit is public
    const outfit = await prisma.outfitCheck.findFirst({
      where: {
        id: data.outfitId,
        isPublic: true,
        isDeleted: false,
      },
    });

    if (!outfit) {
      throw new AppError(404, 'Outfit not found or not public');
    }

    // Prevent feedback on own outfits
    if (outfit.userId === userId) {
      throw new AppError(400, 'Cannot give feedback on your own outfit');
    }

    // Create or update feedback
    const feedback = await prisma.communityFeedback.upsert({
      where: {
        outfitId_userId: {
          outfitId: data.outfitId,
          userId,
        },
      },
      create: {
        outfitId: data.outfitId,
        userId,
        score: data.score,
        comment: data.comment,
      },
      update: {
        score: data.score,
        comment: data.comment,
      },
    });

    res.json(feedback);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid feedback data');
    }
    throw error;
  }
}

// Get community feedback for an outfit
export async function getOutfitFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Verify outfit is public
    const outfit = await prisma.outfitCheck.findFirst({
      where: {
        id,
        isPublic: true,
        isDeleted: false,
      },
    });

    if (!outfit) {
      throw new AppError(404, 'Outfit not found or not public');
    }

    const feedback = await prisma.communityFeedback.findMany({
      where: { outfitId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedback });
  } catch (error) {
    throw error;
  }
}
