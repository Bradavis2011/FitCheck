import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { isAdmin } from '../utils/admin.js';
import {
  getJournalOverview,
  getArticle,
  generateArticle,
  ArticleType,
} from '../services/style-journal.service.js';

const VALID_TYPES: ArticleType[] = [
  'wardrobe_snapshot',
  'color_story',
  'capsule_builder',
  'monthly_report',
  'occasion_playbook',
];

function validateType(type: string): ArticleType {
  if (!VALID_TYPES.includes(type as ArticleType)) {
    throw new AppError(400, `Invalid article type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return type as ArticleType;
}

// GET /api/style-journal — overview for all tiers
export async function listStyleJournal(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const overview = await getJournalOverview(userId);
  res.json({ articles: overview });
}

// GET /api/style-journal/:type — full article (paid tier only)
export async function getStyleArticle(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const tier = req.user!.tier ?? 'free';
  const type = validateType(req.params.type);

  if (tier === 'free' && !isAdmin(userId)) {
    throw new AppError(403, 'Style Journal articles require a Plus or Pro subscription.');
  }

  const article = await getArticle(userId, type);
  if (!article) {
    throw new AppError(404, 'No article generated yet. Generate one first.');
  }

  res.json({ article });
}

// POST /api/style-journal/:type/generate — paid tier only
export async function generateStyleArticle(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const tier = req.user!.tier ?? 'free';
  const type = validateType(req.params.type);

  if (tier === 'free' && !isAdmin(userId)) {
    throw new AppError(403, 'Style Journal articles require a Plus or Pro subscription.');
  }

  const article = await generateArticle(userId, type);
  res.json({ article });
}
