import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as referralController from '../controllers/referral.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/link', asyncHandler(referralController.getReferralLink));
router.post('/claim', asyncHandler(referralController.claimReferral));
router.get('/stats', asyncHandler(referralController.getReferralStats));

export default router;
