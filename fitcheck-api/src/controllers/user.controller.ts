import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { getTierLimits } from '../constants/tiers.js';

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
    const limits = getTierLimits(user?.tier || 'free');
    const dailyChecksLimit = limits.dailyChecks === Infinity ? 999 : limits.dailyChecks;
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

// GET /api/user/style-profile - Aggregated Style DNA
export async function getStyleProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const styleDNAs = await prisma.styleDNA.findMany({
      where: { userId },
      include: { outfitCheck: { select: { aiScore: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (styleDNAs.length === 0) {
      return res.json({
        message: 'No style data yet. Submit some outfits to see your style profile!',
        topColors: [],
        dominantArchetypes: [],
        averageScores: null,
        totalOutfits: 0,
      });
    }

    // Top colors (by frequency + score)
    const colorScores = new Map<string, { total: number; count: number }>();
    styleDNAs.forEach(dna => {
      if (dna.outfitCheck.aiScore) {
        dna.dominantColors.forEach(color => {
          const entry = colorScores.get(color) || { total: 0, count: 0 };
          entry.total += dna.outfitCheck.aiScore!;
          entry.count++;
          colorScores.set(color, entry);
        });
      }
    });
    const topColors = [...colorScores.entries()]
      .map(([color, v]) => ({ color, avgScore: v.total / v.count, appearances: v.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    // Dominant style archetypes
    const archetypeCounts = new Map<string, number>();
    styleDNAs.forEach(dna => {
      dna.styleArchetypes.forEach(a => {
        archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
      });
    });
    const dominantArchetypes = [...archetypeCounts.entries()]
      .map(([archetype, count]) => ({ archetype, count, percentage: (count / styleDNAs.length) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average sub-scores
    const avgScores = {
      color: 0, proportion: 0, fit: 0, coherence: 0, count: 0,
    };
    styleDNAs.forEach(dna => {
      if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
        avgScores.color += dna.colorScore;
        avgScores.proportion += dna.proportionScore;
        avgScores.fit += dna.fitScore;
        avgScores.coherence += dna.coherenceScore;
        avgScores.count++;
      }
    });

    const averageScores = avgScores.count > 0 ? {
      colorCoordination: +(avgScores.color / avgScores.count).toFixed(2),
      proportions: +(avgScores.proportion / avgScores.count).toFixed(2),
      fit: +(avgScores.fit / avgScores.count).toFixed(2),
      styleCoherence: +(avgScores.coherence / avgScores.count).toFixed(2),
    } : null;

    res.json({
      topColors,
      dominantArchetypes,
      averageScores,
      totalOutfits: styleDNAs.length,
    });
  } catch (error) {
    throw error;
  }
  return;
}

// GET /api/user/style-evolution - Style trends over time
export async function getStyleEvolution(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const styleDNAs = await prisma.styleDNA.findMany({
      where: { userId },
      include: { outfitCheck: { select: { aiScore: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (styleDNAs.length === 0) {
      return res.json({
        message: 'No style data yet. Submit some outfits to track your evolution!',
        weeklyData: [],
      });
    }

    // Group by week (YYYY-Www format)
    const weeklyGroups = new Map<string, {
      scores: { color: number; proportion: number; fit: number; coherence: number; overall: number }[];
    }>();

    styleDNAs.forEach(dna => {
      const date = new Date(dna.outfitCheck.createdAt);
      const year = date.getFullYear();
      const weekNum = getWeekNumber(date);
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

      const group = weeklyGroups.get(weekKey) || { scores: [] };
      if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore && dna.outfitCheck.aiScore) {
        group.scores.push({
          color: dna.colorScore,
          proportion: dna.proportionScore,
          fit: dna.fitScore,
          coherence: dna.coherenceScore,
          overall: dna.outfitCheck.aiScore,
        });
      }
      weeklyGroups.set(weekKey, group);
    });

    // Calculate weekly averages (filter out weeks with no scores)
    const weeklyData = [...weeklyGroups.entries()]
      .filter(([_, data]) => data.scores.length > 0)
      .map(([week, data]) => {
        const n = data.scores.length;
        return {
          week,
          outfitCount: n,
          avgColorScore: +(data.scores.reduce((sum, s) => sum + s.color, 0) / n).toFixed(2),
          avgProportionScore: +(data.scores.reduce((sum, s) => sum + s.proportion, 0) / n).toFixed(2),
          avgFitScore: +(data.scores.reduce((sum, s) => sum + s.fit, 0) / n).toFixed(2),
          avgCoherenceScore: +(data.scores.reduce((sum, s) => sum + s.coherence, 0) / n).toFixed(2),
          avgOverallScore: +(data.scores.reduce((sum, s) => sum + s.overall, 0) / n).toFixed(2),
        };
      });

    res.json({ weeklyData });
  } catch (error) {
    throw error;
  }
  return;
}

// Helper: Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ========== GAMIFICATION ENDPOINTS ==========

// Import gamification service
import * as gamificationService from '../services/gamification.service.js';

// GET /api/user/leaderboard/:type - Get leaderboard (weekly, monthly, alltime)
export async function getLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { type } = req.params as { type: 'weekly' | 'monthly' | 'alltime' };

    if (!['weekly', 'monthly', 'alltime'].includes(type)) {
      throw new AppError(400, 'Invalid leaderboard type. Must be weekly, monthly, or alltime');
    }

    const leaderboard = await gamificationService.getLeaderboard(type, 50);
    const userRank = await gamificationService.getUserRank(userId, type);

    res.json({
      type,
      leaderboard,
      userRank,
    });
  } catch (error) {
    throw error;
  }
}

// GET /api/user/daily-goals - Get daily goals progress
export async function getDailyGoals(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const progress = await gamificationService.getDailyGoalsProgress(userId);

    res.json(progress);
  } catch (error) {
    throw error;
  }
}

// GET /api/user/badges - Get user's badges with metadata
export async function getBadges(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      return res.json({ badges: [] });
    }

    const badgesWithMetadata = stats.badges.map((badgeId) => ({
      id: badgeId,
      ...gamificationService.BADGE_METADATA[badgeId],
    }));

    res.json({
      badges: badgesWithMetadata,
      totalBadges: stats.badges.length,
    });
  } catch (error) {
    throw error;
  }
}

export async function clearHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const result = await prisma.outfitCheck.updateMany({
      where: { userId, isDeleted: false },
      data: { isDeleted: true },
    });

    res.json({ success: true, deletedCount: result.count });
  } catch (error) {
    throw error;
  }
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    // Delete user — cascade handles related records via schema onDelete: Cascade
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}
