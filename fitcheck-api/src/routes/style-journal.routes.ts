import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { wardrobeAiLimiter } from '../middleware/rateLimiter.js';
import {
  listStyleJournal,
  getStyleArticle,
  generateStyleArticle,
} from '../controllers/style-journal.controller.js';

const router = Router();

router.use(authenticateToken);

// GET /api/style-journal — overview (all tiers)
router.get('/', asyncHandler(listStyleJournal));

// POST /api/style-journal/:type/generate — paid tier only, rate limited
router.post('/:type/generate', wardrobeAiLimiter, asyncHandler(generateStyleArticle));

// GET /api/style-journal/:type — full article (paid tier only)
router.get('/:type', asyncHandler(getStyleArticle));

export default router;
