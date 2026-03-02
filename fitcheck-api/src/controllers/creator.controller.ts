import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAdmin } from '../utils/admin.js';
import { replicateViralHook } from '../services/creator-manager.service.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateCreatorSchema = z.object({
  name: z.string().min(1).max(100),
  handle: z.string().min(1).max(100),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  followers: z.number().int().min(0).optional(),
  email: z.string().email().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tier: z.enum(['nano', 'micro', 'macro']).optional(),
});

const UpdateCreatorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  handle: z.string().min(1).max(100).optional(),
  status: z.enum(['prospect', 'contacted', 'accepted', 'active', 'paused', 'cut']).optional(),
  followers: z.number().int().min(0).optional(),
  email: z.string().email().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tier: z.enum(['nano', 'micro', 'macro']).optional(),
  totalViews: z.number().int().min(0).optional(),
  totalPosts: z.number().int().min(0).optional(),
  contactedAt: z.string().datetime().optional().nullable(),
  acceptedAt: z.string().datetime().optional().nullable(),
  lastPostDate: z.string().datetime().optional().nullable(),
});

const CreatePostSchema = z.object({
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  externalUrl: z.string().url().optional().nullable(),
  hookUsed: z.string().max(200).optional().nullable(),
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  postedAt: z.string().datetime().optional().nullable(),
});

const UpdatePostSchema = z.object({
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  hookUsed: z.string().max(200).optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
  postedAt: z.string().datetime().optional().nullable(),
});

// ─── Creator CRUD ─────────────────────────────────────────────────────────────

// GET /api/admin/creators
export async function listCreators(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { status, platform, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [creators, total] = await Promise.all([
    prisma.creator.findMany({
      where,
      orderBy: [{ status: 'asc' }, { totalViews: 'desc' }],
      skip,
      take: limitNum,
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    prisma.creator.count({ where }),
  ]);

  res.json({ creators, total, page: pageNum, limit: limitNum });
}

// POST /api/admin/creators
export async function addCreator(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const parsed = CreateCreatorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, handle, platform, followers, email, notes, tier } = parsed.data;

  const creator = await prisma.creator.create({
    data: {
      name,
      handle: handle.replace(/^@/, ''),
      platform,
      followers: followers ?? 0,
      email: email ?? null,
      notes: notes ?? null,
      tier: tier ?? 'nano',
    },
  });

  res.status(201).json({ creator });
}

// PATCH /api/admin/creators/:id
export async function updateCreator(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const parsed = UpdateCreatorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const existing = await prisma.creator.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Creator not found' });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Handle status transitions — set timestamps automatically
  if (parsed.data.status === 'contacted' && !existing.contactedAt) {
    updateData.contactedAt = new Date();
  }
  if (parsed.data.status === 'accepted' && !existing.acceptedAt) {
    updateData.acceptedAt = new Date();
  }

  // Convert datetime strings to Date objects
  if (typeof updateData.contactedAt === 'string') updateData.contactedAt = new Date(updateData.contactedAt);
  if (typeof updateData.acceptedAt === 'string') updateData.acceptedAt = new Date(updateData.acceptedAt);
  if (typeof updateData.lastPostDate === 'string') updateData.lastPostDate = new Date(updateData.lastPostDate);

  const creator = await prisma.creator.update({ where: { id }, data: updateData });
  res.json({ creator });
}

// ─── Creator Post Management ──────────────────────────────────────────────────

// POST /api/admin/creators/:id/posts
export async function addCreatorPost(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const parsed = CreatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const creator = await prisma.creator.findUnique({ where: { id } });
  if (!creator) {
    res.status(404).json({ error: 'Creator not found' });
    return;
  }

  const post = await prisma.creatorPost.create({
    data: {
      creatorId: id,
      platform: parsed.data.platform,
      externalUrl: parsed.data.externalUrl ?? null,
      hookUsed: parsed.data.hookUsed ?? null,
      views: parsed.data.views ?? 0,
      likes: parsed.data.likes ?? 0,
      shares: parsed.data.shares ?? 0,
      comments: parsed.data.comments ?? 0,
      postedAt: parsed.data.postedAt ? new Date(parsed.data.postedAt) : null,
    },
  });

  // Update creator's aggregate totals
  await prisma.creator.update({
    where: { id },
    data: {
      totalPosts: { increment: 1 },
      totalViews: { increment: post.views },
      lastPostDate: new Date(),
    },
  });

  res.status(201).json({ post });
}

// PATCH /api/admin/creators/:id/posts/:postId
export async function updateCreatorPost(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id, postId } = req.params;
  const parsed = UpdatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const existing = await prisma.creatorPost.findFirst({ where: { id: postId, creatorId: id } });
  if (!existing) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof updateData.postedAt === 'string') updateData.postedAt = new Date(updateData.postedAt);

  const post = await prisma.creatorPost.update({ where: { id: postId }, data: updateData });

  // If views were updated, refresh creator's totalViews
  if (parsed.data.views !== undefined) {
    const viewsDelta = (parsed.data.views ?? 0) - existing.views;
    if (viewsDelta !== 0) {
      await prisma.creator.update({
        where: { id },
        data: { totalViews: { increment: viewsDelta } },
      });
    }
  }

  res.json({ post });
}

// POST /api/admin/creators/:id/posts/:postId/flag-viral
export async function flagPostViral(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id, postId } = req.params;

  const post = await prisma.creatorPost.findFirst({ where: { id: postId, creatorId: id } });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  // Fire-and-forget viral replication (the response returns immediately)
  replicateViralHook(id, postId).catch(err => {
    console.error('[CreatorController] Viral replication failed:', err);
  });

  res.json({
    message: 'Viral replication triggered — Gemini will analyze and distribute variations to all active creators',
    postId,
  });
}
