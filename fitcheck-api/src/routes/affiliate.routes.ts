import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as affiliateController from '../controllers/affiliate.controller.js';

const router = Router();

router.use(authenticateToken);

// GET /api/affiliate/recommendations?outfitId=xxx&placement=post_feedback_high&score=8.2
router.get('/recommendations', asyncHandler(affiliateController.getAffiliateRecommendations));

// POST /api/affiliate/click  { impressionId, productId }
router.post('/click', asyncHandler(affiliateController.recordAffiliateClick));

export default router;
