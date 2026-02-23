import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { canSendRelationshipNotification } from './event-followup.service.js';
import { createNotification } from '../controllers/notification.controller.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getIsoWeekPeriod(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getTopN(arr: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

export async function runStyleNarrativeAgent(): Promise<void> {
  const period = getIsoWeekPeriod(new Date());
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const activeUsers = await prisma.outfitCheck.groupBy({
    by: ['userId'],
    where: {
      isDeleted: false,
      aiProcessedAt: { not: null },
      createdAt: { gte: fourteenDaysAgo },
    },
    _count: { id: true },
  });

  const eligible = activeUsers.filter((u) => (u._count.id ?? 0) >= 3);
  console.log(`[StyleNarrative] Processing ${eligible.length} users for period ${period}`);

  for (const { userId, _count } of eligible) {
    try {
      const existing = await prisma.styleNarrative.findUnique({
        where: { userId_period: { userId, period } },
      });
      if (existing) continue;

      await executeOrQueue(
        'style-narrative',
        'generate_narrative',
        'medium',
        { userId, period, outfitCount: _count.id },
        async (payload) => {
          await generateAndSendNarrative(
            payload.userId as string,
            payload.period as string,
            payload.outfitCount as number,
          );
          return { generated: true };
        },
      );
    } catch (err) {
      console.error(`[StyleNarrative] Failed for user ${userId}:`, err);
    }
  }
}

async function generateAndSendNarrative(
  userId: string,
  period: string,
  outfitCount: number,
): Promise<void> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const recentDNA = await prisma.styleDNA.findMany({
    where: { userId, createdAt: { gte: fourteenDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      dominantColors: true,
      styleArchetypes: true,
      colorHarmony: true,
      formalityLevel: true,
      outfitCheck: {
        select: { aiScore: true, occasions: true },
      },
    },
  });

  if (!recentDNA.length) return;

  const allColors = recentDNA.flatMap((d) => d.dominantColors);
  const allArchetypes = recentDNA.flatMap((d) => d.styleArchetypes);
  const allOccasions = recentDNA.flatMap((d) => d.outfitCheck.occasions);
  const scores = recentDNA.map((d) => d.outfitCheck.aiScore).filter(Boolean) as number[];
  const avgScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  const topColors = getTopN(allColors, 3);
  const topArchetypes = getTopN(allArchetypes, 2);
  const topOccasions = getTopN(allOccasions, 2);

  const prompt = `You are analyzing a user's style data from the past 2 weeks. Write a 1-2 sentence personal style observation.

Rules:
- Warm but honest, specific not generic
- Reference actual patterns in the data
- No generic phrases like "your style is unique" or "you have great taste"
- Address the user as "you"
- 1-2 sentences max

Data:
- ${outfitCount} outfits checked
- Top colors: ${topColors.join(', ') || 'varied'}
- Style archetypes: ${topArchetypes.join(', ') || 'mixed'}
- Occasions: ${topOccasions.join(', ') || 'varied'}
- Average score: ${avgScore ? avgScore.toFixed(1) : 'N/A'}/10

Write ONLY the observation. Example: "You've been gravitating toward navy and earth tones lately — it's creating a quietly confident look." or "Lots of smart-casual lately, and your scores show it's working."`;

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  const narrative = result.response.text().trim().replace(/^["']|["']$/g, '');

  if (!narrative || narrative.length < 10) return;

  try {
    await prisma.styleNarrative.create({
      data: { userId, narrative, period, outfitCount },
    });
  } catch (err: any) {
    // Unique constraint: already generated for this period
    if (err?.code === 'P2002') return;
    throw err;
  }

  if (!(await canSendRelationshipNotification(userId))) return;

  await createNotification({
    userId,
    type: 'style_narrative',
    title: 'Your style this week',
    body: narrative.length > 120 ? narrative.slice(0, 117) + '...' : narrative,
  });

  console.log(`[StyleNarrative] Generated for ${userId}: ${narrative.slice(0, 60)}...`);
}
