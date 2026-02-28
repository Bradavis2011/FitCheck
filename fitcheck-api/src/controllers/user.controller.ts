import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { getTierLimits } from '../constants/tiers.js';
import { isAdmin } from '../utils/admin.js';
import { getWeekNumber } from '../utils/date.js';

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(150, 'Bio must be at most 150 characters').optional(),
  isPublic: z.boolean().optional(),
  profileImageUrl: z.string().optional(), // accepts https URLs and data: URIs
  stylePreferences: z.record(z.any()).optional(),
  bodyType: z.string().optional(),
  colorSeason: z.string().optional(),
  privacySettings: z.object({
    blurFaceDefault: z.boolean().optional(),
    visibility: z.enum(['all', 'followers', 'trusted']).optional(),
    autoDelete: z.enum(['never', '24h', '7d', '30d']).optional(),
  }).optional(),
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
        privacySettings: true,
        tier: true,
        subscriptionExpiresAt: true,
        dailyChecksUsed: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // A7: include top StyleDNA archetype for home screen personalization
    const styleDNA = await prisma.styleDNA.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { styleArchetypes: true },
    }).catch(() => null);
    const topArchetype: string | null = styleDNA?.styleArchetypes?.[0] ?? null;

    res.json({ ...user, topArchetype });
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
        privacySettings: true,
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
    const tz = (req.query.timezone as string) || 'UTC';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        dailyChecksUsed: true,
        dailyChecksResetAt: true,
      },
    });

    const [stats, outfitCount, favoriteCount] = await Promise.all([
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.outfitCheck.count({ where: { userId, isDeleted: false } }),
      prisma.outfitCheck.count({ where: { userId, isFavorite: true, isDeleted: false } }),
    ]);

    // Admin accounts are always unlimited
    if (isAdmin(userId)) {
      res.json({
        ...stats,
        totalOutfits: outfitCount,
        totalFavorites: favoriteCount,
        dailyChecksUsed: 0,
        dailyChecksLimit: 999,
        dailyChecksRemaining: 999,
      });
      return;
    }

    // Apply same reset logic as outfit submission — so the UI updates at midnight
    // without requiring the user to submit first.
    const toLocalDateStr = (d: Date) =>
      d.toLocaleDateString('en-CA', { timeZone: tz }); // 'en-CA' → YYYY-MM-DD
    const today = toLocalDateStr(new Date());
    const resetDate = toLocalDateStr(new Date(user?.dailyChecksResetAt ?? new Date()));

    let dailyChecksUsed = user?.dailyChecksUsed || 0;
    if (today !== resetDate) {
      await prisma.user.update({
        where: { id: userId },
        data: { dailyChecksUsed: 0, dailyChecksResetAt: new Date() },
      });
      dailyChecksUsed = 0;
    }

    const limits = getTierLimits(user?.tier || 'free');
    const dailyChecksLimit = limits.dailyChecks === Infinity ? 999 : limits.dailyChecks;
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

    // Pro only: advanced analytics
    if (!req.user || req.user.tier !== 'pro') {
      throw new AppError(403, 'Style analytics requires a Pro subscription.');
    }

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

    // Pro only: advanced analytics
    if (!req.user || req.user.tier !== 'pro') {
      throw new AppError(403, 'Style analytics requires a Pro subscription.');
    }

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

// POST /api/user/attribution - Store first-touch UTM attribution (set-once)
export async function setAttribution(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const schema = z.object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(200).optional(),
      content: z.string().max(200).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid attribution data' });
      return;
    }

    // Only set if not already set — first-touch attribution wins
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { attribution: true } });
    if (!user) throw new AppError(404, 'User not found');

    if (user.attribution !== null) {
      res.json({ set: false, reason: 'already_set' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { attribution: parsed.data as unknown as Prisma.InputJsonValue },
    });

    res.json({ set: true });
  } catch (error) {
    throw error;
  }
}

// GET /api/user/badges - Get all achievements with earned/locked state
export async function getBadges(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const stats = await prisma.userStats.findUnique({ where: { userId } });
    const earnedSet = new Set(stats?.badges ?? []);

    // Return all defined badges with earned status — never hide locked achievements
    const allBadges = Object.entries(gamificationService.BADGE_METADATA).map(([id, meta]) => ({
      id,
      ...meta,
      earned: earnedSet.has(id),
    }));

    res.json({
      badges: allBadges,
      earnedCount: earnedSet.size,
      totalCount: allBadges.length,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * A6: Smart context defaults — returns user's most frequent occasions and vibes
 * so the context screen can pre-select them on the next outfit check.
 */
export async function getContextPreferences(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;

  const checks = await prisma.outfitCheck.findMany({
    where: { userId, isDeleted: false },
    select: { occasions: true, vibe: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Count occasion frequency
  const occasionCount = new Map<string, number>();
  for (const c of checks) {
    for (const o of c.occasions) {
      occasionCount.set(o, (occasionCount.get(o) || 0) + 1);
    }
  }
  const topOccasions = [...occasionCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([o]) => o);

  // Count vibe frequency (stored as comma-separated string)
  const vibeCount = new Map<string, number>();
  for (const c of checks) {
    if (!c.vibe) continue;
    for (const v of c.vibe.split(',').map(s => s.trim()).filter(Boolean)) {
      vibeCount.set(v, (vibeCount.get(v) || 0) + 1);
    }
  }
  const topVibes = [...vibeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([v]) => v);

  res.json({ topOccasions, topVibes });
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    // Delete reports filed by this user (reporter relation has no cascade)
    await prisma.report.deleteMany({ where: { reporterId: userId } });

    // Delete user — cascade handles outfitChecks, followUps, styleDNA,
    // userStats, communityFeedback, notifications, pushTokens, etc.
    await prisma.user.delete({ where: { id: userId } });

    // Attempt Clerk deletion (best-effort — don't fail the response)
    try {
      const { createClerkClient } = await import('@clerk/express');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      await clerk.users.deleteUser(userId);
    } catch (clerkError) {
      console.error('Failed to delete Clerk user (non-fatal):', clerkError);
    }

    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    throw error;
  }
}
