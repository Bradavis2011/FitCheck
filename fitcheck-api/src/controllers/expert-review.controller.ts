import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { getTierLimits } from '../constants/tiers.js';

const RequestReviewSchema = z.object({
  outfitCheckId: z.string().uuid(),
  stylistId: z.string().uuid().optional(), // Optional: auto-assign if not provided
});

const SubmitReviewSchema = z.object({
  score: z.number().int().min(1).max(10),
  feedback: z.string().min(50, 'Feedback must be at least 50 characters').max(3000),
});

// Count how many expert reviews the user has used this calendar month
async function countMonthlyReviewsUsed(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return prisma.expertReview.count({
    where: {
      userId,
      requestedAt: { gte: startOfMonth },
      status: { not: 'cancelled' },
    },
  });
}

// POST /api/expert-reviews — Pro user requests a review
export async function requestReview(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const userTier = req.user!.tier;

  const limits = getTierLimits(userTier);
  if (limits.expertReviewsPerMonth === 0) {
    throw new AppError(403, 'Expert reviews require a Pro subscription.');
  }

  const usedThisMonth = await countMonthlyReviewsUsed(userId);
  if (usedThisMonth >= limits.expertReviewsPerMonth) {
    throw new AppError(429, `You have used all ${limits.expertReviewsPerMonth} expert reviews for this month.`);
  }

  const body = RequestReviewSchema.parse(req.body);

  // Verify outfit belongs to user
  const outfit = await prisma.outfitCheck.findUnique({
    where: { id: body.outfitCheckId },
    select: { id: true, userId: true, isDeleted: true },
  });

  if (!outfit || outfit.userId !== userId || outfit.isDeleted) {
    throw new AppError(404, 'Outfit not found');
  }

  // Prevent duplicate pending/in_progress requests for the same outfit
  const existing = await prisma.expertReview.findFirst({
    where: {
      outfitCheckId: body.outfitCheckId,
      status: { in: ['pending', 'in_progress'] },
    },
  });
  if (existing) {
    throw new AppError(409, 'A review is already in progress for this outfit');
  }

  // Determine which stylist to assign
  let stylistId = body.stylistId;

  if (!stylistId) {
    // Auto-assign: pick the verified stylist with the fewest pending reviews
    const stylist = await prisma.stylist.findFirst({
      where: { verified: true },
      orderBy: { reviewCount: 'asc' },
    });
    if (!stylist) {
      throw new AppError(503, 'No stylists are currently available. Please try again later.');
    }
    stylistId = stylist.id;
  } else {
    // Validate selected stylist is verified
    const stylist = await prisma.stylist.findUnique({ where: { id: stylistId } });
    if (!stylist || !stylist.verified) {
      throw new AppError(404, 'Stylist not found or not verified');
    }
  }

  const review = await prisma.expertReview.create({
    data: {
      outfitCheckId: body.outfitCheckId,
      userId,
      stylistId,
      status: 'pending',
    },
    include: {
      stylist: {
        include: {
          user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
        },
      },
    },
  });

  res.status(201).json({ review, reviewsUsedThisMonth: usedThisMonth + 1 });
}

// GET /api/expert-reviews/my-requests — reviews I've requested
export async function getMyReviews(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const reviews = await prisma.expertReview.findMany({
    where: { userId },
    include: {
      stylist: {
        include: {
          user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
        },
      },
      outfitCheck: {
        select: { id: true, thumbnailUrl: true, thumbnailData: true, occasions: true },
      },
    },
    orderBy: { requestedAt: 'desc' },
    take: 50,
  });

  const usedThisMonth = await countMonthlyReviewsUsed(userId);
  const limits = getTierLimits(req.user!.tier);

  res.json({
    reviews,
    usedThisMonth,
    monthlyLimit: limits.expertReviewsPerMonth,
  });
}

// GET /api/expert-reviews/my-queue — assigned to me as a stylist
export async function getStylistQueue(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const stylist = await prisma.stylist.findUnique({ where: { userId } });
  if (!stylist || !stylist.verified) {
    throw new AppError(403, 'You must be a verified stylist to access this');
  }

  const reviews = await prisma.expertReview.findMany({
    where: {
      stylistId: stylist.id,
      status: { in: ['pending', 'in_progress'] },
    },
    include: {
      outfitCheck: {
        select: {
          id: true,
          imageUrl: true,
          imageData: true,
          thumbnailUrl: true,
          thumbnailData: true,
          occasions: true,
          setting: true,
          weather: true,
          vibe: true,
          specificConcerns: true,
          aiFeedback: true,
          aiScore: true,
        },
      },
      user: { select: { id: true, username: true, name: true } },
    },
    orderBy: { requestedAt: 'asc' },
  });

  res.json({ reviews });
}

// POST /api/expert-reviews/:id/submit — stylist submits their review
export async function submitReview(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const stylist = await prisma.stylist.findUnique({ where: { userId } });
  if (!stylist || !stylist.verified) {
    throw new AppError(403, 'You must be a verified stylist to submit reviews');
  }

  const review = await prisma.expertReview.findUnique({ where: { id } });
  if (!review || review.stylistId !== stylist.id) {
    throw new AppError(404, 'Review not found');
  }
  if (review.status === 'completed') {
    throw new AppError(409, 'This review has already been submitted');
  }
  if (review.status === 'cancelled') {
    throw new AppError(409, 'This review has been cancelled');
  }

  const body = SubmitReviewSchema.parse(req.body);

  const [updatedReview] = await prisma.$transaction([
    prisma.expertReview.update({
      where: { id },
      data: {
        status: 'completed',
        score: body.score,
        feedback: body.feedback,
        completedAt: new Date(),
      },
    }),
    // Increment stylist's review count and recalculate rating
    prisma.stylist.update({
      where: { id: stylist.id },
      data: {
        reviewCount: { increment: 1 },
        // Simple running average: new_rating = (old_rating * old_count + new_score) / new_count
        rating: (stylist.rating * stylist.reviewCount + body.score) / (stylist.reviewCount + 1),
      },
    }),
  ]);

  res.json({ review: updatedReview });
}

// GET /api/expert-reviews/outfit/:outfitId — get completed review for an outfit
export async function getOutfitReview(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { outfitId } = req.params;

  // Verify ownership
  const outfit = await prisma.outfitCheck.findUnique({
    where: { id: outfitId },
    select: { userId: true },
  });
  if (!outfit || outfit.userId !== userId) {
    throw new AppError(404, 'Outfit not found');
  }

  const review = await prisma.expertReview.findFirst({
    where: { outfitCheckId: outfitId, status: 'completed' },
    include: {
      stylist: {
        include: {
          user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  res.json({ review: review || null });
}

// DELETE /api/expert-reviews/:id — cancel a pending review
export async function cancelReview(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const review = await prisma.expertReview.findUnique({ where: { id } });
  if (!review || review.userId !== userId) {
    throw new AppError(404, 'Review not found');
  }
  if (review.status !== 'pending') {
    throw new AppError(409, 'Only pending reviews can be cancelled');
  }

  await prisma.expertReview.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  res.json({ message: 'Review cancelled' });
}
