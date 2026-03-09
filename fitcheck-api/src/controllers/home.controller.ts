import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

// GET /api/home/context — consolidated home screen data in one request
export async function getHomeContext(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const [user, latestNarrative, upcomingEvents, wardrobeCount, recentPromptVersions] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }),
      prisma.styleNarrative.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { narrative: true, createdAt: true },
      }),
      prisma.outfitCheck.findMany({
        where: { userId, isDeleted: false, eventDate: { gt: new Date() } },
        orderBy: { eventDate: 'asc' },
        take: 3,
        select: { occasions: true, eventDate: true, setting: true, aiScore: true },
      }),
      prisma.wardrobeItem.count({ where: { userId } }),
      // Agent activity: count of distinct prompt versions improved in last 7 days
      prisma.promptVersion.findMany({
        where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { id: true },
        take: 50,
      }),
    ]);

  const tier = user?.tier || 'free';
  const hasWardrobeData = wardrobeCount >= 5 && tier !== 'free';

  // Count AI improvements this week (proxy: unique prompt version updates)
  const improvementsMade = recentPromptVersions.length;

  res.json({
    agentActivity: { improvementsMade },
    latestNarrative: latestNarrative
      ? { text: latestNarrative.narrative, createdAt: latestNarrative.createdAt.toISOString() }
      : null,
    upcomingEvents: upcomingEvents.map((e) => ({
      occasion: e.occasions[0] || 'event',
      eventDate: e.eventDate!.toISOString(),
      setting: e.setting ?? null,
    })),
    hasWardrobeData,
  });
}
