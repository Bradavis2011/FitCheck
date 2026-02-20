import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { joinWaitlist, getWaitlistStatus } from '../controllers/waitlist.controller.js';

const router = Router();

// Public — no auth required
router.post('/', asyncHandler(joinWaitlist));
router.get('/status', asyncHandler(getWaitlistStatus));

export default router;
