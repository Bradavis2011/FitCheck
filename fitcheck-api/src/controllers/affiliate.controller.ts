import { Request, Response } from 'express';
import { getRecommendations, trackAffiliateClick, getInlineMatches } from '../services/affiliate.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getAffiliateRecommendations(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const { outfitId, placement = 'post_feedback_high', score } = req.query as {
    outfitId?: string;
    placement?: string;
    score?: string;
  };

  const parsedScore = score ? parseFloat(score) : undefined;

  const result = await getRecommendations(userId, placement, outfitId, parsedScore);

  if (!result) {
    res.json({ recommendations: null });
    return;
  }

  res.json({ recommendations: result });
}

export async function getInlineProductMatches(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const { outfitId } = req.query as { outfitId?: string };
  if (!outfitId) throw new AppError(400, 'outfitId required');

  const result = await getInlineMatches(userId, outfitId);

  if (!result) {
    res.json({ inlineMatches: null });
    return;
  }

  res.json({ inlineMatches: result });
}

export async function recordAffiliateClick(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const { impressionId, productId } = req.body as { impressionId?: string; productId?: string };
  if (!impressionId || !productId) throw new AppError(400, 'impressionId and productId required');

  await trackAffiliateClick(impressionId, productId, userId);
  res.json({ ok: true });
}
