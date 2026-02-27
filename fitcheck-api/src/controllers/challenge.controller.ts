import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { isAdmin } from '../utils/admin.js';

const CreateChallengeSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  theme: z.string().min(1).max(50),
  prize: z.string().max(200).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const SubmitEntrySchema = z.object({
  outfitCheckId: z.string().uuid(),
});

// GET /api/challenges
// Query: status=active|upcoming|ended  (defaults to active)
export async function listChallenges(req: Request, res: Response) {
  const status = (req.query.status as string) || 'active';
  const validStatuses = ['active', 'upcoming', 'ended'];
  if (!validStatuses.includes(status)) {
    throw new AppError(400, 'Invalid status filter. Use active, upcoming, or ended.');
  }

  const challenges = await prisma.challenge.findMany({
    where: { status },
    orderBy: status === 'ended' ? { endsAt: 'desc' } : { startsAt: 'asc' },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  // Auto-transition status based on time (best-effort — a cron is the proper fix for production)
  const now = new Date();
  for (const c of challenges) {
    if (c.status === 'upcoming' && new Date(c.startsAt) <= now) {
      await prisma.challenge.update({ where: { id: c.id }, data: { status: 'active' } }).catch(() => {});
    } else if (c.status === 'active' && new Date(c.endsAt) <= now) {
      await prisma.challenge.update({ where: { id: c.id }, data: { status: 'ended' } }).catch(() => {});
    }
  }

  res.json({ challenges: challenges.map(c => ({
    ...c,
    submissionCount: c._count.submissions,
  })) });
}

// GET /api/challenges/active — convenience endpoint for the home/current tab
export async function getActiveChallenge(_req: Request, res: Response) {
  const now = new Date();

  // Also auto-transition upcoming → active
  await prisma.challenge.updateMany({
    where: { status: 'upcoming', startsAt: { lte: now } },
    data: { status: 'active' },
  });

  // And active → ended
  await prisma.challenge.updateMany({
    where: { status: 'active', endsAt: { lte: now } },
    data: { status: 'ended' },
  });

  const challenge = await prisma.challenge.findFirst({
    where: { status: 'active' },
    orderBy: { endsAt: 'asc' },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  if (!challenge) {
    res.json({ challenge: null });
    return;
  }

  res.json({ challenge: { ...challenge, submissionCount: challenge._count.submissions } });
}

// GET /api/challenges/:id
export async function getChallenge(req: Request, res: Response) {
  const { id } = req.params;

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });

  if (!challenge) {
    throw new AppError(404, 'Challenge not found');
  }

  res.json({ challenge: { ...challenge, submissionCount: challenge._count.submissions } });
}

// GET /api/challenges/:id/leaderboard?limit=10&offset=0
export async function getLeaderboard(req: Request, res: Response) {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const offset = Number(req.query.offset) || 0;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) throw new AppError(404, 'Challenge not found');

  const submissions = await prisma.challengeSubmission.findMany({
    where: { challengeId: id },
    orderBy: { votes: 'desc' },
    skip: offset,
    take: limit,
    include: {
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
      outfitCheck: {
        select: { id: true, thumbnailUrl: true, thumbnailData: true, aiScore: true },
      },
    },
  });

  const total = await prisma.challengeSubmission.count({ where: { challengeId: id } });

  res.json({ submissions, total, limit, offset });
}

// POST /api/challenges/:id/submit
export async function submitEntry(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id: challengeId } = req.params;
  const { outfitCheckId } = SubmitEntrySchema.parse(req.body);

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError(404, 'Challenge not found');
  if (challenge.status !== 'active') {
    throw new AppError(400, 'This challenge is not currently accepting submissions');
  }

  // Verify the outfit belongs to the user
  const outfit = await prisma.outfitCheck.findFirst({
    where: { id: outfitCheckId, userId, isDeleted: false },
  });
  if (!outfit) throw new AppError(404, 'Outfit not found or does not belong to you');

  // Check for duplicate submission (one per user per challenge)
  const existing = await prisma.challengeSubmission.findFirst({
    where: { challengeId, userId },
  });
  if (existing) throw new AppError(409, 'You have already submitted an entry for this challenge');

  const submission = await prisma.challengeSubmission.create({
    data: { challengeId, outfitCheckId, userId },
    include: {
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
      outfitCheck: { select: { id: true, thumbnailUrl: true, thumbnailData: true, aiScore: true } },
    },
  });

  res.status(201).json({ submission });
}

// POST /api/challenges/:id/submissions/:subId/vote
export async function voteForSubmission(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id: challengeId, subId } = req.params;

  const submission = await prisma.challengeSubmission.findFirst({
    where: { id: subId, challengeId },
  });
  if (!submission) throw new AppError(404, 'Submission not found');

  // Block voting on own submission
  if (submission.userId === userId) {
    throw new AppError(400, 'You cannot vote for your own submission');
  }

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (challenge?.status !== 'active') {
    throw new AppError(400, 'Voting is only allowed on active challenges');
  }

  // Check duplicate vote
  const existingVote = await prisma.challengeVote.findFirst({
    where: { submissionId: subId, userId },
  });
  if (existingVote) throw new AppError(409, 'You have already voted for this submission');

  // Record vote and increment counter atomically
  await prisma.$transaction([
    prisma.challengeVote.create({ data: { submissionId: subId, userId } }),
    prisma.challengeSubmission.update({ where: { id: subId }, data: { votes: { increment: 1 } } }),
  ]);

  const updated = await prisma.challengeSubmission.findUnique({ where: { id: subId } });
  res.json({ votes: updated!.votes });
}

// GET /api/challenges/:id/my-submission
export async function getMySubmission(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { id: challengeId } = req.params;

  const submission = await prisma.challengeSubmission.findFirst({
    where: { challengeId, userId },
    include: {
      outfitCheck: { select: { id: true, thumbnailUrl: true, thumbnailData: true, aiScore: true } },
    },
  });

  res.json({ submission: submission ?? null });
}

// POST /api/challenges  (admin only)
export async function createChallenge(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  if (!isAdmin(userId)) {
    throw new AppError(403, 'Admin access required');
  }

  const body = CreateChallengeSchema.parse(req.body);
  const now = new Date();
  const startsAt = new Date(body.startsAt);
  const status = startsAt <= now ? 'active' : 'upcoming';

  const challenge = await prisma.challenge.create({
    data: {
      title: body.title,
      description: body.description,
      theme: body.theme,
      prize: body.prize ?? null,
      startsAt,
      endsAt: new Date(body.endsAt),
      status,
    },
  });

  res.status(201).json({ challenge });
}

// POST /api/challenges/:id/end  (admin only)
export async function endChallenge(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  if (!isAdmin(userId)) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) throw new AppError(404, 'Challenge not found');
  if (challenge.status === 'ended') throw new AppError(400, 'Challenge is already ended');

  const updated = await prisma.challenge.update({
    where: { id },
    data: { status: 'ended', endsAt: new Date() },
  });

  res.json({ challenge: updated });
}
