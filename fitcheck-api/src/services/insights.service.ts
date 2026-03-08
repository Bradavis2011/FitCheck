/**
 * Insights Service
 *
 * Merges agentic activity into a unified chronological feed per user:
 * - StyleNarrative (weekly AI observation)
 * - MilestoneMessage (achievement unlocks)
 * - EventFollowUp (pending responses)
 * - ArenaSession (deployed wins = "AI improved overnight")
 * - CritiqueReport (addressed critiques = "AI addressed a weakness")
 */

import { prisma } from '../utils/prisma.js';

export interface InsightItem {
  id: string;
  type: 'style_narrative' | 'milestone' | 'event_followup' | 'ai_improvement' | 'wardrobe_prescription';
  title: string;
  body: string;
  actionType: 'view' | 'respond' | 'dismiss' | null;
  actionRoute: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AgentActivity {
  outfitsAnalyzedOvernight: number;
  improvementsMade: number;
  insightsGenerated: number;
}

export interface InsightsPayload {
  insights: InsightItem[];
  agentActivity: AgentActivity;
}

export async function getUserInsights(
  userId: string,
  limit = 10,
  offset = 0
): Promise<InsightsPayload> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    narratives,
    milestones,
    followUps,
    arenaSessions,
    critiqueReports,
    prescriptions,
    piggybackCount,
    arenaDeployCount,
  ] = await Promise.all([
    // StyleNarrative — most recent first
    prisma.styleNarrative.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // MilestoneMessage — unread first, then recents
    prisma.milestoneMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // EventFollowUp — pending responses only
    prisma.eventFollowUp.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        outfitCheck: { select: { id: true, occasions: true } },
      },
    }),

    // ArenaSession — deployed wins in last 7 days
    prisma.arenaSession.findMany({
      where: {
        deployed: true,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // CritiqueReport — addressed in last 7 days
    prisma.critiqueReport.findMany({
      where: {
        addressed: true,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),

    // Piggyback judge count in last 24h (for agentActivity)
    prisma.outfitCheck.count({
      where: {
        judgeEvaluated: true,
        aiProcessedAt: { gte: oneDayAgo },
        isDeleted: false,
      },
    }),

    // WardrobePrescriptions — last 2 weeks
    prisma.wardrobePrescription.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    }),

    // Arena deploys in last 7 days (for agentActivity)
    prisma.arenaSession.count({
      where: {
        deployed: true,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const allItems: InsightItem[] = [];

  // Map StyleNarratives
  for (const n of narratives) {
    allItems.push({
      id: n.id,
      type: 'style_narrative',
      title: 'Your Style This Week',
      body: n.narrative,
      actionType: 'dismiss',
      actionRoute: null,
      metadata: { period: n.period },
      createdAt: n.createdAt.toISOString(),
    });
  }

  // Map MilestoneMessages
  for (const m of milestones) {
    allItems.push({
      id: m.id,
      type: 'milestone',
      title: formatMilestoneTitle(m.milestoneKey),
      body: m.message,
      actionType: 'view',
      actionRoute: '/archive',
      metadata: { milestoneKey: m.milestoneKey },
      createdAt: m.createdAt.toISOString(),
    });
  }

  // Map EventFollowUps
  for (const f of followUps) {
    const occasion = (f.outfitCheck?.occasions || [])[0] || 'your event';
    allItems.push({
      id: f.id,
      type: 'event_followup',
      title: `How did your ${occasion} outfit go?`,
      body: `You wore this outfit for ${occasion}. How did it land?`,
      actionType: 'respond',
      actionRoute: `/outfit/${f.outfitCheckId}`,
      metadata: {
        outfitId: f.outfitCheckId,
        followUpId: f.id,
        occasion,
        eventDate: f.followUpAt?.toISOString() || null,
      },
      createdAt: f.createdAt.toISOString(),
    });
  }

  // Map ArenaSession deploys → ai_improvement
  for (const a of arenaSessions) {
    const section = formatSectionName(a.challengerSectionKey);
    const winPct = a.winRate ? Math.round(a.winRate * 100) : 0;
    allItems.push({
      id: a.id,
      type: 'ai_improvement',
      title: 'Your AI improved overnight',
      body: `The ${section} section was upgraded — ${winPct}% win rate in testing. Your feedback makes the AI smarter.`,
      actionType: 'dismiss',
      actionRoute: null,
      metadata: {
        sectionKey: a.challengerSectionKey,
        winRate: a.winRate,
        improvementType: 'arena_deploy',
      },
      createdAt: a.createdAt.toISOString(),
    });
  }

  // Map CritiqueReports → ai_improvement
  for (const c of critiqueReports) {
    const weaknesses = Array.isArray(c.weaknesses) ? c.weaknesses as string[] : [];
    const topWeakness = weaknesses[0] || 'a detected weakness';
    allItems.push({
      id: c.id,
      type: 'ai_improvement',
      title: 'AI addressed a weakness',
      body: `Your stylist AI self-diagnosed and fixed: ${topWeakness}`,
      actionType: 'dismiss',
      actionRoute: null,
      metadata: {
        improvementType: 'critique_addressed',
        weaknessCount: weaknesses.length,
      },
      createdAt: c.createdAt.toISOString(),
    });
  }

  // Map WardrobePrescriptions
  for (const p of prescriptions) {
    const gaps = Array.isArray(p.gaps) ? p.gaps as Array<{ gapCategory: string; reasoning: string; products: any[] }> : [];
    const topGap = gaps[0];
    if (!topGap) continue;
    allItems.push({
      id: p.id,
      type: 'wardrobe_prescription',
      title: `Your AI picked ${p.totalItems} items for your wardrobe`,
      body: topGap.reasoning,
      actionType: 'view',
      actionRoute: '/insights',
      metadata: {
        weekPeriod: p.weekPeriod,
        gaps,
        totalItems: p.totalItems,
      },
      createdAt: p.createdAt.toISOString(),
    });
  }

  // Sort by createdAt desc, paginate
  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const paginated = allItems.slice(offset, offset + limit);

  const agentActivity: AgentActivity = {
    outfitsAnalyzedOvernight: piggybackCount,
    improvementsMade: arenaDeployCount,
    insightsGenerated: allItems.length,
  };

  return { insights: paginated, agentActivity };
}

function formatMilestoneTitle(key: string): string {
  const titles: Record<string, string> = {
    first_check: 'First outfit checked!',
    ten_checks: '10 outfit checks',
    twenty_five_checks: '25 outfit checks',
    fifty_checks: '50 outfit checks',
    first_favorite: 'First outfit saved',
    streak_7: '7-day streak',
    streak_30: '30-day streak',
    high_score: 'Personal best score',
    wardrobe_unlocked: 'AI Wardrobe unlocked',
  };
  return titles[key] || 'Achievement unlocked';
}

function formatSectionName(sectionKey: string): string {
  return sectionKey
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
