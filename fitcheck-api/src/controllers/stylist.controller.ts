import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

const StylistApplicationSchema = z.object({
  bio: z.string().min(20, 'Bio must be at least 20 characters').max(1000),
  specialties: z.array(z.string()).min(1, 'Select at least one specialty').max(10),
  instagramUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

// POST /api/stylists/apply
export async function applyStylist(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const existing = await prisma.stylist.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError(409, 'You have already applied to become a stylist');
  }

  const body = StylistApplicationSchema.parse(req.body);

  const stylist = await prisma.stylist.create({
    data: {
      userId,
      bio: body.bio,
      specialties: body.specialties,
      instagramUrl: body.instagramUrl || null,
    },
  });

  res.status(201).json({ stylist });
}

// GET /api/stylists/me
export async function getMyStylistProfile(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const stylist = await prisma.stylist.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
    },
  });

  if (!stylist) {
    throw new AppError(404, 'You have not applied to become a stylist yet');
  }

  res.json({ stylist });
}

// PUT /api/stylists/me
export async function updateMyStylistProfile(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const existing = await prisma.stylist.findUnique({ where: { userId } });
  if (!existing) {
    throw new AppError(404, 'Stylist profile not found');
  }

  const body = StylistApplicationSchema.partial().parse(req.body);

  const stylist = await prisma.stylist.update({
    where: { userId },
    data: {
      ...(body.bio !== undefined && { bio: body.bio }),
      ...(body.specialties !== undefined && { specialties: body.specialties }),
      ...(body.instagramUrl !== undefined && { instagramUrl: body.instagramUrl || null }),
    },
  });

  res.json({ stylist });
}

// GET /api/stylists — list verified stylists
export async function getStylists(req: AuthenticatedRequest, res: Response) {
  const { specialty, limit = '20', offset = '0' } = req.query;

  const stylists = await prisma.stylist.findMany({
    where: {
      verified: true,
      ...(specialty && typeof specialty === 'string'
        ? { specialties: { has: specialty } }
        : {}),
    },
    include: {
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
    },
    orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    take: Math.min(Number(limit) || 20, 50),
    skip: Number(offset) || 0,
  });

  res.json({ stylists });
}

// GET /api/stylists/:id
export async function getStylist(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  const stylist = await prisma.stylist.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
    },
  });

  if (!stylist || !stylist.verified) {
    throw new AppError(404, 'Stylist not found');
  }

  res.json({ stylist });
}

// POST /api/stylists/:id/verify — admin only
export async function verifyStylist(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  if (!ADMIN_USER_IDS.includes(userId)) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;

  const stylist = await prisma.stylist.update({
    where: { id },
    data: { verified: true },
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
  });

  res.json({ stylist });
}

// POST /api/stylists/:id/unverify — admin only
export async function unverifyStylist(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  if (!ADMIN_USER_IDS.includes(userId)) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;

  const stylist = await prisma.stylist.update({
    where: { id },
    data: { verified: false },
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
  });

  res.json({ stylist });
}
