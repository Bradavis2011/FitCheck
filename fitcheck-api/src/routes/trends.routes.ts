import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import * as trendsController from '../controllers/trends.controller.js';

const router = Router();

// Trends endpoints: authenticated + Pro tier required
router.use(authenticateToken);
router.get('/colors', asyncHandler(trendsController.getTrendingColors));
router.get('/archetypes', asyncHandler(trendsController.getTrendingArchetypes));
router.get('/summary', asyncHandler(trendsController.getTrendSummary));

export default router;
