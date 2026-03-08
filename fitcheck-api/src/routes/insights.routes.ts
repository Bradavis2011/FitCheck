import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { getInsights } from '../controllers/insights.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(getInsights));

export default router;
