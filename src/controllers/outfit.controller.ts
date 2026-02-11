import { Response } from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { analyzeOutfit, handleFollowUpQuestion } from '../services/ai-feedback.service.js';

const OutfitCheckSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  occasions: z.array(z.string()).min(1),
  setting: z.string().optional(),
  weather: z.string().optional(),
  vibe: z.string().optional(),
  specificConcerns: z.string().optional(),
}).refine(data => data.imageUrl || data.imageBase64, {
  message: 'Either imageUrl or imageBase64 must be provided',
});

async function generateThumbnail(base64Image: string): Promise<string> {
  try {
    // Remove data:image prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Resize to 200px width, JPEG quality 60
    const thumbnail = await sharp(buffer)
      .resize(200, null, { fit: 'inside' })
      .jpeg({ quality: 60 })
      .toBuffer();

    return `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return base64Image; // Fallback to original
  }
}

async function updateUserStreakAndPoints(userId: string): Promise<void> {
  try {
    // Get all outfit checks for this user, ordered by creation date
    const outfitChecks = await prisma.outfitCheck.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (outfitChecks.length === 0) {
      return;
    }

    // Calculate streak: count consecutive calendar days with at least 1 outfit check
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group checks by date
    const checksByDate = new Map<string, number>();
    for (const check of outfitChecks) {
      const dateKey = new Date(check.createdAt).toDateString();
      checksByDate.set(dateKey, (checksByDate.get(dateKey) || 0) + 1);
    }

    // Count consecutive days backwards from today
    let checkDate = new Date(today);
    while (true) {
      const dateKey = checkDate.toDateString();
      if (checksByDate.has(dateKey)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate points: +10 per outfit submission, +5 bonus if streak >= 3
    let pointsToAdd = 10;
    if (currentStreak >= 3) {
      pointsToAdd += 5;
    }

    // Get or create user stats
    const existingStats = await prisma.userStats.findUnique({
      where: { userId },
    });

    const newPoints = (existingStats?.points || 0) + pointsToAdd;
    const newLevel = Math.min(50, Math.floor(newPoints / 100) + 1);
    const newLongestStreak = Math.max(existingStats?.longestStreak || 0, currentStreak);

    // Upsert user stats
    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak,
        longestStreak: currentStreak,
        points: pointsToAdd,
        level: newLevel,
      },
      update: {
        currentStreak,
        longestStreak: newLongestStreak,
        points: newPoints,
        level: newLevel,
      },
    });
  } catch (error) {
    console.error('Failed to update user streak and points:', error);
  }
}

export async function submitOutfitCheck(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    // Validate request body
    const data = OutfitCheckSchema.parse(req.body);

    // Get user to check daily limit
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Reset daily checks if needed
    const today = new Date().toDateString();
    const resetDate = new Date(user.dailyChecksResetAt).toDateString();

    if (today !== resetDate) {
      user = await prisma.user.update({
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

    // Generate thumbnail if base64 image provided
    let thumbnailData: string | null = null;
    if (data.imageBase64) {
      thumbnailData = await generateThumbnail(data.imageBase64);
    }

    // Create outfit check record
    const outfitCheck = await prisma.outfitCheck.create({
      data: {
        userId,
        imageUrl: data.imageUrl || null,
        imageData: data.imageBase64 || null,
        thumbnailData,
        occasions: data.occasions,
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

    // Update user streak and points
    await updateUserStreakAndPoints(userId);

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
      where.occasions = { has: occasion };
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
        thumbnailData: true,
        occasions: true,
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

export async function togglePublic(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Verify the outfit belongs to this user
    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId, isDeleted: false },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    // If making public, ensure user has set up their public profile
    if (!outfitCheck.isPublic) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, isPublic: true },
      });

      if (!user?.username) {
        throw new AppError(400, 'You must set a username before sharing outfits publicly. Go to Profile > Edit Profile to set one.');
      }
    }

    const updated = await prisma.outfitCheck.update({
      where: { id },
      data: { isPublic: !outfitCheck.isPublic },
    });

    res.json({ isPublic: updated.isPublic });
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

    // Update user stats: increment feedback counts and add points
    const existingStats = await prisma.userStats.findUnique({
      where: { userId },
    });

    const newPoints = (existingStats?.points || 0) + 5;
    const newLevel = Math.min(50, Math.floor(newPoints / 100) + 1);

    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        totalFeedbackGiven: 1,
        totalHelpfulVotes: helpful ? 1 : 0,
        points: 5,
        level: 1,
      },
      update: {
        totalFeedbackGiven: { increment: 1 },
        totalHelpfulVotes: helpful ? { increment: 1 } : undefined,
        points: newPoints,
        level: newLevel,
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
