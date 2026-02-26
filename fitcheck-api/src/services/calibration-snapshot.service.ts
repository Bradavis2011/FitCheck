import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

function computePearsonCorrelation(pairs: { x: number; y: number }[]): number | null {
  const n = pairs.length;
  if (n < 2) return null;

  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;
  return numerator / denominator;
}

function getWeekPeriod(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Weekly cron: compute and store a calibration snapshot with Pearson correlation
export async function runCalibrationSnapshot(): Promise<void> {
  const period = getWeekPeriod();

  try {
    // Fetch outfits that have both AI and community scores
    const data = await prisma.outfitCheck.findMany({
      where: {
        aiScore: { not: null },
        communityScoreCount: { gte: 3 },
      },
      select: { aiScore: true, communityAvgScore: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    const pairs = data
      .filter((d): d is { aiScore: number; communityAvgScore: number } =>
        d.aiScore !== null && d.communityAvgScore !== null
      )
      .map(d => ({ x: d.aiScore, y: d.communityAvgScore }));

    if (pairs.length < 10) {
      console.log(`[CalibrationSnapshot] Not enough data (${pairs.length} samples) — skipping`);
      return;
    }

    const avgAiScore = pairs.reduce((s, p) => s + p.x, 0) / pairs.length;
    const avgCommunity = pairs.reduce((s, p) => s + p.y, 0) / pairs.length;
    const delta = avgAiScore - avgCommunity;
    const correlation = computePearsonCorrelation(pairs);

    await prisma.calibrationSnapshot.upsert({
      where: { period },
      create: {
        period,
        sampleSize: pairs.length,
        avgAiScore,
        avgCommunity,
        delta,
        correlation,
      },
      update: {
        sampleSize: pairs.length,
        avgAiScore,
        avgCommunity,
        delta,
        correlation,
      },
    });

    console.log(
      `✅ [CalibrationSnapshot] Saved for ${period}: delta=${delta.toFixed(2)}, r=${correlation?.toFixed(3) ?? 'N/A'}, n=${pairs.length}`
    );

    // Publish calibration drift to Intelligence Bus if significant drift detected
    if (Math.abs(delta) > 0.5) {
      publishToIntelligenceBus('calibration-snapshot', 'calibration_drift', {
        period,
        delta,
        avgAiScore,
        avgCommunity,
        correlation,
        sampleSize: pairs.length,
      }).catch(() => {});
    }
  } catch (error) {
    console.error('[CalibrationSnapshot] Failed:', error);
  }
}
