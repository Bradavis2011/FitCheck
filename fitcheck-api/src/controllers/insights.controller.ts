import { Request, Response } from 'express';
import { getUserInsights } from '../services/insights.service.js';

export async function getInsights(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10), 50);
  const offset = parseInt(String(req.query.offset || '0'), 10);

  const payload = await getUserInsights(userId, limit, offset);
  res.json(payload);
}
