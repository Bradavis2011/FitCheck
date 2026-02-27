import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { waitlistLimiter } from '../middleware/rateLimiter.js';
import { joinWaitlist, getWaitlistStatus } from '../controllers/waitlist.controller.js';

const router = Router();

// Public — no auth required; rate-limited to 5/minute
router.post('/', waitlistLimiter, asyncHandler(joinWaitlist));
router.get('/status', waitlistLimiter, asyncHandler(getWaitlistStatus));

export default router;
