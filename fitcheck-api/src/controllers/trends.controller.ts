import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const TrendQuerySchema = z.object({
  period: z.enum(['week', 'month']).optional().default('week'),
  limit: z.coerce.number().min(1).max(52).optional().default(12),
});

/**
 * GET /api/trends/colors
 * Get trending colors across all users
 */
export async function getTrendingColors(req: Request, res: Response) {
  try {
    const { period, limit } = TrendQuerySchema.parse(req.query);

    // Get StyleDNA records grouped by time period
    const styleDNAs = await prisma.styleDNA.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - (period === 'week' ? 12 : 52) * 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        outfitCheck: {
          select: {
            aiScore: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by period and count colors
    const periodGroups = new Map<string, Map<string, { count: number; avgScore: number; totalScore: number }>>();

    styleDNAs.forEach((dna) => {
      const date = new Date(dna.createdAt);
      const periodKey = period === 'week'
        ? `${date.getFullYear()}-W${getWeekNumber(date).toString().padStart(2, '0')}`
        : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!periodGroups.has(periodKey)) {
        periodGroups.set(periodKey, new Map());
      }

      const periodData = periodGroups.get(periodKey)!;

      dna.dominantColors.forEach((color) => {
        const colorData = periodData.get(color) || { count: 0, avgScore: 0, totalScore: 0 };
        colorData.count++;
        if (dna.outfitCheck.aiScore) {
          colorData.totalScore += dna.outfitCheck.aiScore;
          colorData.avgScore = colorData.totalScore / colorData.count;
        }
        periodData.set(color, colorData);
      });
    });

    // Convert to sorted array
    const trends = Array.from(periodGroups.entries())
      .slice(0, limit)
      .map(([period, colors]) => {
        const topColors = Array.from(colors.entries())
          .map(([color, data]) => ({
            color,
            count: data.count,
            avgScore: +data.avgScore.toFixed(2),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          period,
          topColors,
          totalOutfits: Array.from(colors.values()).reduce((sum, c) => sum + c.count, 0),
        };
      });

    res.json({
      period,
      data: trends,
      meta: {
        generated: new Date().toISOString(),
        totalRecords: styleDNAs.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid query parameters');
    }
    throw error;
  }
}

/**
 * GET /api/trends/archetypes
 * Get trending style archetypes across all users
 */
export async function getTrendingArchetypes(req: Request, res: Response) {
  try {
    const { period, limit } = TrendQuerySchema.parse(req.query);

    const styleDNAs = await prisma.styleDNA.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - (period === 'week' ? 12 : 52) * 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        outfitCheck: {
          select: {
            aiScore: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by period and count archetypes
    const periodGroups = new Map<string, Map<string, { count: number; avgScore: number; totalScore: number }>>();

    styleDNAs.forEach((dna) => {
      const date = new Date(dna.createdAt);
      const periodKey = period === 'week'
        ? `${date.getFullYear()}-W${getWeekNumber(date).toString().padStart(2, '0')}`
        : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!periodGroups.has(periodKey)) {
        periodGroups.set(periodKey, new Map());
      }

      const periodData = periodGroups.get(periodKey)!;

      dna.styleArchetypes.forEach((archetype) => {
        const archetypeData = periodData.get(archetype) || { count: 0, avgScore: 0, totalScore: 0 };
        archetypeData.count++;
        if (dna.outfitCheck.aiScore) {
          archetypeData.totalScore += dna.outfitCheck.aiScore;
          archetypeData.avgScore = archetypeData.totalScore / archetypeData.count;
        }
        periodData.set(archetype, archetypeData);
      });
    });

    // Convert to sorted array with trend calculation
    const periods = Array.from(periodGroups.entries()).slice(0, limit);

    const trends = periods.map(([period, archetypes], index) => {
      const topArchetypes = Array.from(archetypes.entries())
        .map(([archetype, data]) => {
          let trend = 0;

          // Calculate trend vs previous period
          if (index < periods.length - 1) {
            const prevPeriod = periods[index + 1][1];
            const prevData = prevPeriod.get(archetype);
            if (prevData) {
              trend = ((data.count - prevData.count) / prevData.count) * 100;
            } else {
              trend = 100; // New archetype
            }
          }

          return {
            archetype,
            count: data.count,
            avgScore: +data.avgScore.toFixed(2),
            trend: +trend.toFixed(1),
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        period,
        topArchetypes,
        totalOutfits: Array.from(archetypes.values()).reduce((sum, c) => sum + c.count, 0),
      };
    });

    res.json({
      period,
      data: trends,
      meta: {
        generated: new Date().toISOString(),
        totalRecords: styleDNAs.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid query parameters');
    }
    throw error;
  }
}

/**
 * GET /api/trends/summary
 * Get overall trend summary across all dimensions
 */
export async function getTrendSummary(req: Request, res: Response) {
  try {
    // Get last 30 days of data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentDNAs = await prisma.styleDNA.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        outfitCheck: {
          select: {
            aiScore: true,
          },
        },
      },
    });

    // Count everything
    const colorCounts = new Map<string, number>();
    const archetypeCounts = new Map<string, number>();
    const garmentCounts = new Map<string, number>();
    const harmonyCount = new Map<string, number>();

    recentDNAs.forEach((dna) => {
      dna.dominantColors.forEach((color) => {
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      });

      dna.styleArchetypes.forEach((archetype) => {
        archetypeCounts.set(archetype, (archetypeCounts.get(archetype) || 0) + 1);
      });

      dna.garments.forEach((garment) => {
        garmentCounts.set(garment, (garmentCounts.get(garment) || 0) + 1);
      });

      if (dna.colorHarmony) {
        harmonyCount.set(dna.colorHarmony, (harmonyCount.get(dna.colorHarmony) || 0) + 1);
      }
    });

    const summary = {
      period: 'last-30-days',
      topColors: Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([color, count]) => ({ color, count })),
      topArchetypes: Array.from(archetypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([archetype, count]) => ({ archetype, count })),
      topGarments: Array.from(garmentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([garment, count]) => ({ garment, count })),
      colorHarmonies: Array.from(harmonyCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([harmony, count]) => ({ harmony, count })),
      totalOutfits: recentDNAs.length,
      meta: {
        generated: new Date().toISOString(),
        periodStart: thirtyDaysAgo.toISOString(),
        periodEnd: new Date().toISOString(),
      },
    };

    res.json(summary);
  } catch (error) {
    throw error;
  }
}

// Helper function
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
