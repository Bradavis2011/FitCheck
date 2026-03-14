import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getLearnContent,
  getLearnContentBySlug,
  getRelatedContent,
  getLatestTrend,
  getLearnTips,
  getLearnGuides,
} from '../controllers/learn.controller.js';

const router = Router();

// Public, read-only — no auth required
router.get('/content',         asyncHandler(getLearnContent));
router.get('/content/:slug',         asyncHandler(getLearnContentBySlug));
router.get('/content/:slug/related', asyncHandler(getRelatedContent));
router.get('/trends/latest',   asyncHandler(getLatestTrend));
router.get('/tips',            asyncHandler(getLearnTips));
router.get('/guides',          asyncHandler(getLearnGuides));

export default router;
