import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { pushService } from './push.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Trend Data ───────────────────────────────────────────────────────────────

async function getTrendData(): Promise<{ topStyles: string[]; colorTrends: string[] }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentDNA = await prisma.styleDNA.findMany({
    where: { createdAt: { gte: weekAgo } },
    select: { styleArchetypes: true, dominantColors: true },
    take: 200,
  });

  const archetypeCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();

  for (const dna of recentDNA) {
    for (const a of dna.styleArchetypes) archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
    for (const c of dna.dominantColors) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  }

  const topStyles = [...archetypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  const colorTrends = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  return { topStyles, colorTrends };
}

// ─── Weekly: Auto-Create Style Challenge ──────────────────────────────────────

export async function runCommunityManagerWeekly(): Promise<void> {
  console.log('[CommunityManager] Weekly run — generating challenge...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[CommunityManager] GEMINI_API_KEY not set — skipping challenge generation');
    return;
  }

  try {
    const trends = await getTrendData();
    const trendSummary = [
      trends.topStyles.length > 0 ? `Top styles: ${trends.topStyles.join(', ')}` : null,
      trends.colorTrends.length > 0 ? `Trending colors: ${trends.colorTrends.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('. ') || 'Mixed styles and colors';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const prompt = `Generate a 7-day fashion challenge for the "Or This?" app community.
Based on trending styles this week: ${trendSummary}.
Return JSON only (no markdown): { "title": string (max 60 chars), "description": string (max 200 chars, inspiring + clear), "theme": string (1-3 words), "prize": string (e.g. "Featured on our community feed") }`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[CommunityManager] Could not parse Gemini response for challenge');
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { title?: string; description?: string; theme?: string; prize?: string };
    const { title, description, theme, prize } = parsed;

    if (!title || !description || !theme) {
      console.error('[CommunityManager] Missing required fields in challenge response');
      return;
    }

    const content = `${title} — ${description}`;

    await executeOrQueue(
      'community-manager',
      'create_challenge',
      'medium',
      { title, description, theme, prize: prize || 'Featured on our community feed' } as Record<string, unknown>,
      async (payload) => {
        const p = payload as { title: string; description: string; theme: string; prize: string };
        const now = new Date();

        // Next Monday 00:00 UTC
        const nextMonday = new Date(now);
        nextMonday.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7));
        nextMonday.setUTCHours(0, 0, 0, 0);
        const endsAt = new Date(nextMonday.getTime() + 7 * 24 * 60 * 60 * 1000);

        const challenge = await prisma.challenge.create({
          data: {
            title: p.title,
            description: p.description,
            theme: p.theme,
            prize: p.prize,
            status: 'upcoming',
            startsAt: nextMonday,
            endsAt,
          },
        });

        return { challengeId: challenge.id, title: p.title, startsAt: nextMonday };
      },
      content,
    );

    console.log('[CommunityManager] Challenge queued for brand review');
  } catch (err) {
    console.error('[CommunityManager] Weekly challenge generation failed:', err);
  }
}

// ─── Daily: Highlight Top Outfits ─────────────────────────────────────────────

async function highlightTopOutfits(): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const topOutfits = await prisma.outfitCheck.findMany({
    where: {
      isPublic: true,
      isDeleted: false,
      aiScore: { not: null },
      createdAt: { gte: oneDayAgo },
    },
    orderBy: { aiScore: 'desc' },
    take: 3,
    include: { user: { select: { id: true, username: true, name: true } } },
  });

  for (const outfit of topOutfits) {
    if (!outfit.aiScore) continue;

    const displayName = outfit.user.username || outfit.user.name || 'a community member';
    const scoreStr = outfit.aiScore.toFixed(1);

    // Find followers of the outfit owner
    const followers = await prisma.follow.findMany({
      where: { followingId: outfit.userId },
      select: { followerId: true },
    });

    for (const { followerId } of followers) {
      // Limit: 5 community notifications per follower per day
      const todayNotifCount = await prisma.notification.count({
        where: {
          userId: followerId,
          type: 'community_highlight',
          createdAt: { gte: todayStart },
        },
      });
      if (todayNotifCount >= 5) continue;

      const payload = {
        followerId,
        outfitId: outfit.id,
        ownerId: outfit.userId,
        displayName,
        score: scoreStr,
      };

      await executeOrQueue(
        'community-manager',
        'highlight_outfit',
        'low',
        payload as unknown as Record<string, unknown>,
        async (p) => {
          const data = p as typeof payload;
          await pushService.sendPushNotification(data.followerId, {
            title: `Trending now 🔥`,
            body: `${data.displayName}'s outfit scored ${data.score}/10`,
            data: { type: 'community_highlight', outfitId: data.outfitId },
          });

          await prisma.notification.create({
            data: {
              userId: data.followerId,
              type: 'community_highlight',
              title: 'Trending now 🔥',
              body: `${data.displayName}'s outfit scored ${data.score}/10`,
              linkType: 'outfit',
              linkId: data.outfitId,
            },
          });

          return { sent: true };
        },
      );
    }
  }

  console.log(`[CommunityManager] Highlighted ${topOutfits.length} top outfit(s) to their followers`);
}

// ─── Daily: Welcome First Public Outfit ──────────────────────────────────────

async function welcomeNewPublicMembers(): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find users who made their first public outfit in the last 24h
  const newPublicOutfits = await prisma.outfitCheck.findMany({
    where: {
      isPublic: true,
      isDeleted: false,
      createdAt: { gte: oneDayAgo },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  let welcomedCount = 0;

  for (const { userId } of newPublicOutfits) {
    // Check if they had ANY public outfit before the last 24h
    const priorPublic = await prisma.outfitCheck.findFirst({
      where: {
        userId,
        isPublic: true,
        isDeleted: false,
        createdAt: { lt: oneDayAgo },
      },
    });
    if (priorPublic) continue; // Not their first public outfit

    // Check if we already sent a welcome notification
    const alreadyWelcomed = await prisma.notification.findFirst({
      where: { userId, type: 'welcome_public' },
    });
    if (alreadyWelcomed) continue;

    const payload = { userId };

    await executeOrQueue(
      'community-manager',
      'welcome_public',
      'low',
      payload as unknown as Record<string, unknown>,
      async (p) => {
        const data = p as typeof payload;
        await pushService.sendPushNotification(data.userId, {
          title: '🎉 Welcome to the community!',
          body: 'Your style is now public. The community can see your outfit!',
          data: { type: 'welcome_public' },
        });

        await prisma.notification.create({
          data: {
            userId: data.userId,
            type: 'welcome_public',
            title: '🎉 Welcome to the community!',
            body: 'Your style is now public. The community can see and rate your outfit!',
          },
        });

        return { welcomed: true };
      },
    );

    welcomedCount++;
  }

  console.log(`[CommunityManager] Welcomed ${welcomedCount} new public member(s)`);
}

// ─── Main Entry Points ────────────────────────────────────────────────────────

export async function runCommunityManagerDaily(): Promise<void> {
  console.log('[CommunityManager] Daily run starting...');
  await highlightTopOutfits();
  await welcomeNewPublicMembers();
  console.log('[CommunityManager] Daily run complete');
}
