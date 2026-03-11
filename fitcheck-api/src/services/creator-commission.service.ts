/**
 * Creator Commission Service — Affiliate commission accrual + earnings queries
 *
 * Accrual is triggered two ways:
 *  1. Hooked from subscription.service.ts after every INITIAL_PURCHASE / RENEWAL event
 *  2. Daily cron catch-up for any events missed during downtime
 *
 * Commission math:
 *   grossRevenue  = tier price (Plus=$4.99, Pro=$9.99)
 *   netRevenue    = grossRevenue * 0.70  (after Apple/Google 30% cut)
 *   commission    = netRevenue * creator.commissionRate  (default 30%)
 */

import { prisma } from '../utils/prisma.js';

// Tier → monthly price (USD)
const TIER_PRICE: Record<string, number> = {
  plus: 4.99,
  pro: 9.99,
};

// Determine gross revenue from product ID or tier
function getGrossRevenue(productId: string | null, tier: string): number {
  if (productId) {
    const lower = productId.toLowerCase();
    if (lower.includes('pro')) return TIER_PRICE.pro;
    if (lower.includes('plus')) return TIER_PRICE.plus;
  }
  return TIER_PRICE[tier] ?? 4.99;
}

/**
 * Accrue a commission for a single subscription event.
 * Called from subscription.service.ts after processing INITIAL_PURCHASE or RENEWAL.
 * Idempotent — deduped by (referredUserId, eventType, period).
 */
export async function accrueCommissionForUser(
  userId: string,
  eventType: string,
  productId: string | null,
): Promise<void> {
  // Only accrue on purchase / renewal
  if (!['INITIAL_PURCHASE', 'RENEWAL'].includes(eventType)) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true, tier: true },
    });

    if (!user?.referredById) return; // Not a referred user

    // Find the referrer's linked Creator record
    const referrerUser = await prisma.user.findUnique({
      where: { id: user.referredById },
      select: { creatorProfile: { select: { id: true, commissionRate: true } } },
    });

    const creator = referrerUser?.creatorProfile;
    if (!creator) return; // Referrer is not a linked Creator

    const period = new Date().toISOString().slice(0, 7); // '2026-03'
    const grossRevenue = getGrossRevenue(productId, user.tier);
    const netRevenue = grossRevenue * 0.70;
    const commissionAmount = netRevenue * creator.commissionRate;
    const normalizedEventType = eventType.toLowerCase(); // 'initial_purchase' or 'renewal'

    await prisma.$transaction(async (tx) => {
      // Use create + P2002 catch for true idempotency — upsert always returns the record
      // so `if (commission)` would always increment, doubling on duplicate webhooks.
      let isNew = false;
      try {
        await tx.creatorCommission.create({
          data: {
            creatorId: creator.id,
            referredUserId: userId,
            eventType: normalizedEventType,
            grossRevenue,
            netRevenue,
            commissionAmount,
            status: 'accrued',
            period,
          },
        });
        isNew = true;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
        // P2002 = unique constraint violation = already exists — skip (dedup)
      }

      if (isNew) {
        await tx.creator.update({
          where: { id: creator.id },
          data: {
            totalEarned: { increment: commissionAmount },
            pendingPayout: { increment: commissionAmount },
          },
        });
      }
    });

    console.log(`[CreatorCommission] Accrued $${commissionAmount.toFixed(2)} for creator ${creator.id} (user ${userId}, ${normalizedEventType})`);
  } catch (err) {
    // Never crash subscription processing
    console.error('[CreatorCommission] Accrual failed (non-fatal):', err);
  }
}

/**
 * Daily catch-up: re-process yesterday's subscription events in case the hook was missed.
 */
export async function accrueCommissions(): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      eventType: { in: ['INITIAL_PURCHASE', 'RENEWAL'] },
      processedAt: { gte: yesterday, lt: today },
    },
    select: { userId: true, eventType: true, productId: true },
  });

  console.log(`[CreatorCommission] Catch-up: ${events.length} events to process`);

  for (const event of events) {
    await accrueCommissionForUser(event.userId, event.eventType, event.productId);
  }
}

// ─── Earnings Query ────────────────────────────────────────────────────────────

export interface CreatorEarnings {
  totalEarned: number;
  pendingPayout: number;
  referredUsers: number;
  paidUsers: number;
  commissionRate: number;
  recentCommissions: Array<{ period: string; amount: number; status: string }>;
}

export async function getCreatorEarnings(creatorId: string): Promise<CreatorEarnings | null> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: {
      totalEarned: true,
      pendingPayout: true,
      commissionRate: true,
      referralCode: true,
    },
  });

  if (!creator) return null;

  // Count referred users via the Creator's referral code
  const referredUsers = creator.referralCode
    ? await prisma.user.count({
        where: {
          referredBy: { referralCode: creator.referralCode },
        },
      })
    : 0;

  // Count paid users (at least one commission)
  const paidUsersResult = await prisma.creatorCommission.findMany({
    where: { creatorId, status: { not: 'clawed_back' } },
    distinct: ['referredUserId'],
    select: { referredUserId: true },
  });

  const recentCommissions = await prisma.creatorCommission.groupBy({
    by: ['period', 'status'],
    where: { creatorId },
    _sum: { commissionAmount: true },
    orderBy: { period: 'desc' },
    take: 6,
  });

  return {
    totalEarned: creator.totalEarned,
    pendingPayout: creator.pendingPayout,
    referredUsers,
    paidUsers: paidUsersResult.length,
    commissionRate: creator.commissionRate,
    recentCommissions: recentCommissions.map(c => ({
      period: c.period,
      amount: c._sum.commissionAmount ?? 0,
      status: c.status,
    })),
  };
}

// ─── Creator Dashboard ─────────────────────────────────────────────────────────

export interface CreatorDashboard extends CreatorEarnings {
  referralLink: string;
  installCount: number;
  contentIdeas: string[];
}

export async function getCreatorDashboard(creatorId: string): Promise<CreatorDashboard | null> {
  const [creator, earnings] = await Promise.all([
    prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        referralCode: true,
        totalInstalls: true,
      },
    }),
    getCreatorEarnings(creatorId),
  ]);

  if (!creator || !earnings) return null;

  const baseUrl = process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite';
  const referralLink = creator.referralCode
    ? `${baseUrl}/${creator.referralCode}`
    : baseUrl;

  // Pull latest creator_hook SocialPost entries for content ideas
  const recentHooks = await prisma.socialPost.findMany({
    where: {
      platform: { in: ['tiktok', 'instagram'] },
      contentType: 'creator_hook',
      status: { in: ['draft', 'posted'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { content: true },
  }).catch(() => []);

  return {
    ...earnings,
    referralLink,
    installCount: creator.totalInstalls,
    contentIdeas: recentHooks.map(h => h.content || '').filter(Boolean),
  };
}
