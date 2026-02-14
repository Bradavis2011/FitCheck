import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as trendsController from '../controllers/trends.controller.js';

const router = Router();

// Public trend endpoints (for B2B customers)
// In production, these should be behind API key auth
router.get('/colors', asyncHandler(trendsController.getTrendingColors));
router.get('/archetypes', asyncHandler(trendsController.getTrendingArchetypes));
router.get('/summary', asyncHandler(trendsController.getTrendSummary));

export default router;
