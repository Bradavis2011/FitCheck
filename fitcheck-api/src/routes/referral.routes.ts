import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as referralController from '../controllers/referral.controller.js';
import { ClaimReferralSchema } from '../schemas/index.js';

const router = Router();

router.use(authenticateToken);

router.get('/link', asyncHandler(referralController.getReferralLink));
router.post('/claim', validateRequest({ body: ClaimReferralSchema }), asyncHandler(referralController.claimReferral));
router.get('/stats', asyncHandler(referralController.getReferralStats));

export default router;
