import { Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const REFERRAL_BASE_URL = process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite';
const MAX_BONUS_CHECKS = 3;

function generateReferralCode(): string {
  return randomBytes(4).toString('hex'); // 8-char hex
}

export async function getReferralLink(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;

  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (!user) throw new AppError(404, 'User not found');

  if (!user.referralCode) {
    const code = generateReferralCode();
    user = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: { referralCode: true },
    });
  }

  res.json({
    code: user.referralCode,
    link: `${REFERRAL_BASE_URL}/${user.referralCode}`,
  });
}

export async function claimReferral(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { referralCode } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referredById: true },
  });

  if (!user) throw new AppError(404, 'User not found');

  // Idempotent — already claimed
  if (user.referredById) {
    res.json({ ok: true, alreadyClaimed: true });
    return;
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true },
  });

  if (!referrer) throw new AppError(404, 'Invalid referral code');
  if (referrer.id === userId) throw new AppError(400, 'Cannot use your own referral code');

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrer.id },
  });

  res.json({ ok: true });
}

export async function getReferralStats(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;

  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
      bonusDailyChecks: true,
      referredUsers: { select: { id: true } },
    },
  });

  if (!user) throw new AppError(404, 'User not found');

  // Auto-generate code if missing
  if (!user.referralCode) {
    const code = generateReferralCode();
    await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    user = { ...user, referralCode: code };
  }

  const referralCount = user.referredUsers.length;
  const bonusChecks = Math.min(MAX_BONUS_CHECKS, user.bonusDailyChecks);

  res.json({
    referralCode: user.referralCode,
    link: `${REFERRAL_BASE_URL}/${user.referralCode}`,
    referralCount,
    bonusDailyChecks: bonusChecks,
    maxBonusChecks: MAX_BONUS_CHECKS,
  });
}
