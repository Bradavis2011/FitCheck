// @ts-nocheck
import { Response } from 'express';
import { z } from 'zod';
// sharp is lazy-loaded inside functions to prevent startup crash if native binary is incompatible
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { analyzeOutfit, handleFollowUpQuestion } from '../services/ai-feedback.service.js';
import { uploadBuffer } from '../services/s3.service.js';
import { getTierLimits } from '../constants/tiers.js';
import { getRecommendations as getOutfitRecommendations } from '../services/recommendation.service.js';
import * as gamificationService from '../services/gamification.service.js';
import { trackServerEvent } from '../lib/posthog.js';

const OutfitCheckSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  occasions: z.array(z.string()).min(1),
  setting: z.string().optional(),
  weather: z.string().optional(),
  vibe: z.string().optional(),
  specificConcerns: z.string().optional(),
  timezone: z.string().optional(),
  // Sharing: 'private' (just me), 'inner_circle', 'public'
  shareWith: z.enum(['private', 'inner_circle', 'public']).optional(),
}).refine(data => data.imageUrl || data.imageBase64, {
  message: 'Either imageUrl or imageBase64 must be provided',
});

async function generateThumbnail(base64Image: string): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  // Remove data:image prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Resize to 200px width, JPEG quality 60
  const thumbnail = await sharp(buffer)
    .resize(200, null, { fit: 'inside' })
    .jpeg({ quality: 60 })
    .toBuffer();

  return thumbnail;
}

async function resizeForAI(base64Image: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  // Remove data:image prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Resize to max 1024px on either dimension — Gemini doesn't need full resolution
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return resized.toString('base64');
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

// Soft-delete outfit checks whose expiresAt has passed (auto-delete feature)
async function purgeExpiredOutfits(userId: string): Promise<void> {
  try {
    await prisma.outfitCheck.updateMany({
      where: {
        userId,
        isDeleted: false,
        expiresAt: { lte: new Date() },
      },
      data: { isDeleted: true },
    });
  } catch (err) {
    console.error('Failed to purge expired outfits:', err);
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

    // Reset daily checks if needed — use user's local timezone so reset is at their midnight
    const tz = data.timezone || 'UTC';
    const toLocalDateStr = (d: Date) =>
      d.toLocaleDateString('en-CA', { timeZone: tz }); // 'en-CA' gives YYYY-MM-DD
    const today = toLocalDateStr(new Date());
    const resetDate = toLocalDateStr(new Date(user.dailyChecksResetAt));

    if (today !== resetDate) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          dailyChecksUsed: 0,
          dailyChecksResetAt: new Date(),
        },
      });
    }

    // Check daily limit based on tier, with give-to-get bonus
    const limits = getTierLimits(user.tier);
    let effectiveDailyLimit = limits.dailyChecks;
    if (effectiveDailyLimit !== Infinity) {
      // Give-to-get: +1 bonus check for every 3 community feedbacks given today
      const userStats = await prisma.userStats.findUnique({
        where: { userId },
        select: { dailyFeedbackCount: true, dailyGoalsResetAt: true },
      });
      if (userStats) {
        const todayStr = new Date().toDateString();
        const statsDay = userStats.dailyGoalsResetAt?.toDateString();
        if (todayStr === statsDay) {
          const bonusChecks = Math.floor((userStats.dailyFeedbackCount || 0) / 3);
          effectiveDailyLimit = limits.dailyChecks + bonusChecks;
        }
      }
    }
    if (effectiveDailyLimit !== Infinity && user.dailyChecksUsed >= effectiveDailyLimit) {
      throw new AppError(429, 'Daily limit reached. Give community feedback to earn bonus checks, or upgrade to Plus!');
    }

    // Generate UUID for the outfit (needed for S3 key)
    const { randomUUID } = await import('crypto');
    const outfitId = randomUUID();

    // Upload images to S3 if base64 provided
    let s3ImageUrl: string | null = null;
    let s3ThumbnailUrl: string | null = null;
    let thumbnailBase64Fallback: string | null = null;

    if (data.imageBase64) {
      // Always generate thumbnail buffer (used for S3 upload or DB fallback)
      let thumbnailBuffer: Buffer | null = null;
      try {
        thumbnailBuffer = await generateThumbnail(data.imageBase64);
      } catch (err) {
        console.error('Thumbnail generation failed:', err);
      }

      try {
        // Decode base64 to buffer for original image
        const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Upload original to S3
        const originalKey = `outfits/${userId}/${outfitId}/original.jpg`;
        s3ImageUrl = await uploadBuffer(imageBuffer, originalKey, 'image/jpeg');

        // Upload thumbnail to S3
        if (thumbnailBuffer) {
          const thumbnailKey = `outfits/${userId}/${outfitId}/thumbnail.jpg`;
          s3ThumbnailUrl = await uploadBuffer(thumbnailBuffer, thumbnailKey, 'image/jpeg');
        }
      } catch (error) {
        console.error('S3 upload failed, falling back to DB storage:', error);
        // Store thumbnail as base64 in DB so images still display
        if (thumbnailBuffer) {
          thumbnailBase64Fallback = thumbnailBuffer.toString('base64');
        }
      }
    }

    // Determine sharing visibility and apply user's privacy settings
    const shareWith = data.shareWith || 'private';
    const isPublic = shareWith === 'public' || shareWith === 'inner_circle';

    // Read user's privacy settings
    const privacySettings = (user.privacySettings as any) || {};
    const blurFaceDefault = privacySettings.blurFaceDefault ?? true;
    const autoDeleteSetting = privacySettings.autoDelete || 'never';
    const userVisibility = privacySettings.visibility || 'all';

    // Compute expiresAt from autoDelete setting
    let expiresAt: Date | null = null;
    if (autoDeleteSetting !== 'never') {
      const now = new Date();
      if (autoDeleteSetting === '24h') {
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (autoDeleteSetting === '7d') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (autoDeleteSetting === '30d') {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Outfit visibility: inner_circle shares use 'inner_circle',
    // public shares inherit the user's privacy visibility setting,
    // private shares default to 'all' (not public anyway)
    const outfitVisibility = shareWith === 'inner_circle' ? 'inner_circle' : (shareWith === 'public' ? userVisibility : 'all');

    // Create outfit check record
    // If S3 upload succeeded, use S3 URLs (imageData/thumbnailData will be null)
    // If S3 failed, fall back to base64 storage so images still display
    const outfitCheck = await prisma.outfitCheck.create({
      data: {
        id: outfitId,
        userId,
        imageUrl: s3ImageUrl || data.imageUrl || null,
        imageData: s3ImageUrl ? null : (data.imageBase64 || null),
        thumbnailUrl: s3ThumbnailUrl,
        thumbnailData: thumbnailBase64Fallback,
        occasions: data.occasions,
        setting: data.setting,
        weather: data.weather,
        vibe: data.vibe,
        specificConcerns: data.specificConcerns,
        isPublic,
        visibility: outfitVisibility,
        blurFace: blurFaceDefault,
        expiresAt,
      },
    });

    trackServerEvent(userId, 'outfit_check_created', {
      occasion: data.occasions[0],
      shareWith: shareWith,
    });

    // Notify inner circle members when sharing to inner circle
    if (shareWith === 'inner_circle') {
      try {
        const { createNotification } = await import('./notification.controller.js');
        const { pushService } = await import('../services/push.service.js');
        const poster = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true, name: true },
        });
        const posterName = poster?.username || poster?.name || 'Someone';
        const circleMembers = await prisma.innerCircleMember.findMany({
          where: { userId },
          select: { memberId: true },
        });
        for (const { memberId } of circleMembers) {
          await createNotification({
            userId: memberId,
            type: 'inner_circle',
            title: 'New outfit from your circle',
            body: `${posterName} shared a new outfit just for their inner circle`,
            linkType: 'outfit',
            linkId: outfitId,
          });
          await pushService.sendPushNotification(memberId, {
            title: 'New outfit from your circle',
            body: `${posterName} shared a new outfit just for their inner circle`,
            data: { type: 'inner_circle', outfitId },
          });
        }
      } catch (err) {
        // Non-fatal — outfit was created, notification is best-effort
        console.error('Inner circle notifications failed:', err);
      }
    }

    // Increment daily checks
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyChecksUsed: { increment: 1 },
      },
    });

    // Update user streak and points
    await updateUserStreakAndPoints(userId);

    // Check for outfit-submission badges (non-blocking)
    prisma.outfitCheck.count({ where: { userId, isDeleted: false } }).then((outfitCount) => {
      gamificationService.checkOutfitBadges(userId, outfitCount).catch((err) => {
        console.error('Outfit badge check failed:', err);
      });
    }).catch((err) => {
      console.error('Outfit count for badge check failed:', err);
    });

    // Resize image for AI analysis (reduces payload from ~5MB to ~200KB)
    let aiData = data;
    if (data.imageBase64) {
      try {
        const resizedBase64 = await resizeForAI(data.imageBase64);
        aiData = { ...data, imageBase64: resizedBase64 };
      } catch (err) {
        console.error('Image resize failed, using original:', err);
      }
    }

    // Trigger AI analysis asynchronously (pass user for personalization + priority tier)
    const tierLimits = getTierLimits(user.tier);
    analyzeOutfit(outfitCheck.id, aiData, user, tierLimits.hasPriorityProcessing).catch((error) => {
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

    // Purge any expired outfits for this user before listing
    await purgeExpiredOutfits(userId);

    // Get user tier for history gating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const tierLimits = getTierLimits(user?.tier || 'free');

    const where: any = {
      userId,
      isDeleted: false,
    };

    // Apply history gating for free tier
    if (tierLimits.historyDays !== Infinity) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - tierLimits.historyDays);
      where.createdAt = { gte: cutoffDate };
    }

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
        imageData: true,
        thumbnailUrl: true,
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

    // Limit follow-ups based on tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const limits = getTierLimits(user?.tier || 'free');
    if (outfitCheck.followUps.length >= limits.followUpsPerCheck) {
      throw new AppError(429, 'Follow-up limit reached. Upgrade to Plus for more questions!');
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

    // If making public, ensure user has a username and make their profile public too
    if (!outfitCheck.isPublic) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, isPublic: true },
      });

      if (!user?.username) {
        throw new AppError(400, 'You must set a username before sharing outfits publicly. Go to Profile > Edit Profile to set one.');
      }

      // Auto-make user profile public so outfits appear in the community feed
      if (!user.isPublic) {
        await prisma.user.update({
          where: { id: userId },
          data: { isPublic: true },
        });
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

export async function reanalyzeOutfit(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const outfitCheck = await prisma.outfitCheck.findFirst({
      where: { id, userId, isDeleted: false },
    });

    if (!outfitCheck) {
      throw new AppError(404, 'Outfit check not found');
    }

    if (!outfitCheck.imageData && !outfitCheck.imageUrl) {
      throw new AppError(400, 'No image data available for re-analysis');
    }

    // Reset the AI fields so the feedback screen polls again
    await prisma.outfitCheck.update({
      where: { id },
      data: {
        aiFeedback: null,
        aiScore: null,
        aiProcessedAt: null,
      },
    });

    // Re-trigger async analysis
    const analysisInput = {
      imageBase64: outfitCheck.imageData || undefined,
      imageUrl: outfitCheck.imageUrl || undefined,
      occasions: outfitCheck.occasions,
      setting: outfitCheck.setting || undefined,
      weather: outfitCheck.weather || undefined,
      vibe: outfitCheck.vibe || undefined,
      specificConcerns: outfitCheck.specificConcerns || undefined,
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    analyzeOutfit(id, analysisInput, user!).catch((error) => {
      console.error('Background re-analysis failed:', error);
    });

    res.json({ message: 'Re-analysis started' });
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

const RecommendationQuerySchema = z.object({
  occasion: z.string().optional(),
  weather: z.string().optional(),
  formality: z.coerce.number().min(1).max(5).optional(),
});

/**
 * GET /api/outfits/recommendations
 * Get personalized outfit recommendations based on StyleDNA
 */
export async function getRecommendations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { occasion, weather, formality } = RecommendationQuerySchema.parse(req.query);

    const recommendations = await getOutfitRecommendations(userId, {
      occasion,
      weather,
      formality,
    });

    res.json({ recommendations });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid query parameters');
    }
    throw error;
  }
}
