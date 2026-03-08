import { Request, Response } from 'express';
import { getUserInsights } from '../services/insights.service.js';
import { prisma } from '../utils/prisma.js';

export async function getInsights(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10), 50);
  const offset = parseInt(String(req.query.offset || '0'), 10);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
  const tier = user?.tier || 'free';

  const payload = await getUserInsights(userId, limit, offset, tier);
  res.json(payload);
}
