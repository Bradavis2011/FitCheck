/**
 * Onboarding Optimizer Service
 *
 * Tracks the user onboarding funnel drop-off across four steps:
 *   1. Signed up (any user)
 *   2. Completed profile (username set)
 *   3. Took first outfit check
 *   4. Hooked (3+ outfit checks)
 *
 * Publishes drop-off metrics to the Intelligence Bus for the growth
 * dashboard and founder brief to surface activation bottlenecks.
 */

import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelCohort {
  step1_signedUp: number;
  step2_profileComplete: number;
  step3_firstOutfitCheck: number;
  step4_hooked: number;
}

interface DropOffRates {
  step1to2: number | null;
  step2to3: number | null;
  step3to4: number | null;
}

interface OnboardingMetrics {
  cohort7d: FunnelCohort;
  cohort30d: FunnelCohort;
  dropOffRates: {
    '7d': DropOffRates;
    '30d': DropOffRates;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDropOff(from: number, to: number): number | null {
  if (from === 0) return null;
  return parseFloat(((1 - to / from) * 100).toFixed(1));
}

async function getFunnelForCohort(since: Date): Promise<FunnelCohort> {
  // Step 1: all users who signed up in the window
  const step1Users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, username: true },
  });

  const userIds = step1Users.map(u => u.id);
  const step1 = userIds.length;

  if (step1 === 0) {
    return { step1_signedUp: 0, step2_profileComplete: 0, step3_firstOutfitCheck: 0, step4_hooked: 0 };
  }

  // Step 2: users in cohort who have set a username (profile complete)
  const step2 = step1Users.filter(u => u.username != null && u.username.trim() !== '').length;

  // Steps 3 & 4: aggregate outfit check counts per user in cohort
  const outfitCounts = await prisma.outfitCheck.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      isDeleted: false,
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>(
    outfitCounts.map(row => [row.userId, row._count.id])
  );

  let step3 = 0; // at least 1 outfit check
  let step4 = 0; // 3+ outfit checks

  for (const uid of userIds) {
    const count = countMap.get(uid) ?? 0;
    if (count >= 1) step3++;
    if (count >= 3) step4++;
  }

  return {
    step1_signedUp: step1,
    step2_profileComplete: step2,
    step3_firstOutfitCheck: step3,
    step4_hooked: step4,
  };
}

// ─── Core Runner ──────────────────────────────────────────────────────────────

export async function runOnboardingOptimizer(): Promise<void> {
  console.log('[OnboardingOptimizer] Running onboarding funnel analysis...');

  const now = Date.now();
  const ago7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [cohort7d, cohort30d] = await Promise.all([
    getFunnelForCohort(ago7d),
    getFunnelForCohort(ago30d),
  ]);

  const dropOffRates7d: DropOffRates = {
    step1to2: calcDropOff(cohort7d.step1_signedUp, cohort7d.step2_profileComplete),
    step2to3: calcDropOff(cohort7d.step2_profileComplete, cohort7d.step3_firstOutfitCheck),
    step3to4: calcDropOff(cohort7d.step3_firstOutfitCheck, cohort7d.step4_hooked),
  };

  const dropOffRates30d: DropOffRates = {
    step1to2: calcDropOff(cohort30d.step1_signedUp, cohort30d.step2_profileComplete),
    step2to3: calcDropOff(cohort30d.step2_profileComplete, cohort30d.step3_firstOutfitCheck),
    step3to4: calcDropOff(cohort30d.step3_firstOutfitCheck, cohort30d.step4_hooked),
  };

  const metrics: OnboardingMetrics = {
    cohort7d,
    cohort30d,
    dropOffRates: { '7d': dropOffRates7d, '30d': dropOffRates30d },
  };

  console.log(
    '[OnboardingOptimizer] 7d funnel:',
    `signups=${cohort7d.step1_signedUp}`,
    `profile=${cohort7d.step2_profileComplete}`,
    `firstCheck=${cohort7d.step3_firstOutfitCheck}`,
    `hooked=${cohort7d.step4_hooked}`
  );

  try {
    await publishToIntelligenceBus(
      'onboarding-optimizer',
      'onboarding_metrics',
      metrics as unknown as Record<string, unknown>
    );
    console.log('[OnboardingOptimizer] Published onboarding_metrics to bus');
  } catch (err) {
    console.error('[OnboardingOptimizer] Failed to publish to bus:', err);
  }
}

// ─── Summary for Founder Brief ────────────────────────────────────────────────

export async function getOnboardingSummary(): Promise<{ day7Completion: number }> {
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const cohort = await getFunnelForCohort(ago7d);

    const day7Completion =
      cohort.step1_signedUp > 0
        ? parseFloat(((cohort.step3_firstOutfitCheck / cohort.step1_signedUp) * 100).toFixed(1))
        : 0;

    return { day7Completion };
  } catch (err) {
    console.error('[OnboardingOptimizer] getOnboardingSummary failed:', err);
    return { day7Completion: 0 };
  }
}
