import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { analyzeOutfit, handleFollowUpQuestion } from '../services/ai-feedback.service.js';

const OutfitCheckSchema = z.object({
  imageUrl: z.string().url(),
  occasion: z.string().min(1),
  setting: z.string().optional(),
  weather: z.string().optional(),
  vibe: z.string().optional(),
  specificConcerns: z.string().optional(),
});

export async function submitOutfitCheck(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    // Validate request body
    const data = OutfitCheckSchema.parse(req.body);

    // Get user to check daily limit
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Reset daily checks if needed
    const today = new Date().toDateString();
    const resetDate = new Date(user.dailyChecksResetAt).toDateString();

    if (today !== resetDate) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          dailyChecksUsed: 0,
          dailyChecksResetAt: new Date(),
        },
      });
    }

    // Check daily limit for free tier
    if (user.tier === 'free' && user.dailyChecksUsed >= 3) {
      throw new AppError(429, 'Daily limit reached. Upgrade to Plus for unlimited checks!');
    }

    // Create outfit check record
    const outfitCheck = await prisma.outfitCheck.create({
      data: {
        userId,
        imageUrl: data.imageUrl,
        occasion: data.occasion,
        setting: data.setting,
        weather: data.weather,
        vibe: data.vibe,
        specificConcerns: data.specificConcerns,
      },
    });

    // Increment daily checks
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyChecksUsed: { increment: 1 },
      },
    });

    // Trigger AI analysis asynchronously
    analyzeOutfit(outfitCheck.id, data).catch((error) => {
      console.error('Background AI analysis failed:', error);
    });

    res.status(201).json({
      id: outfitCheck.id,
      message: 'Outfit check submitted. Analysis in progress...',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}

export async function getOutfitFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      include: {
        followUps: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    res.json(outfitCheck);
  } catch (error) {
    throw error;
  }
}

export async function listOutfitChecks(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { occasion, isFavorite, limit = '20', offset = '0' } = req.query;

    const where: any = {
      userId,
      isDeleted: false,
    };

    if (occasion) {
      where.occasion = occasion;
    }

    if (isFavorite === 'true') {
      where.isFavorite = true;
    }

    const outfits = await prisma.outfitCheck.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        imageUrl: true,
        occasion: true,
        aiScore: true,
        isFavorite: true,
        createdAt: true,
      },
    });

    const total = await prisma.outfitCheck.count({ where });

    res.json({
      outfits,
      total,
      hasMore: total > parseInt(offset as string) + outfits.length,
    });
  } catch (error) {
    throw error;
  }
}

export async function submitFollowUpQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      throw new AppError(400, 'Question is required');
    }

    // Verify outfit belongs to user
    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId },
      include: { followUps: true },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    // Limit follow-ups for free tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.tier === 'free' && outfitCheck.followUps.length >= 3) {
      throw new AppError(429, 'Follow-up limit reached. Upgrade to Plus for unlimited questions!');
    }

    const answer = await handleFollowUpQuestion(id, question);

    res.json({
      question,
      answer,
    });
  } catch (error) {
    throw error;
  }
}

export async function toggleFavorite(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    const updated = await prisma.outfitCheck.update({
      where: { id },
      data: { isFavorite: !outfitCheck.isFavorite },
    });

    res.json({ isFavorite: updated.isFavorite });
  } catch (error) {
    throw error;
  }
}

export async function rateFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { helpful, rating } = req.body;

    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    await prisma.outfitCheck.update({
      where: { id },
      data: {
        feedbackHelpful: helpful,
        feedbackRating: rating,
      },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}

export async function deleteOutfitCheck(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    await prisma.outfitCheck.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}
