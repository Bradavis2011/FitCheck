import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getScorePage } from '../controllers/share.controller.js';

const router = Router();

// GET /s/:id — Public outfit score page (no auth)
// Serves branded HTML with OG tags + App Store download buttons
router.get('/:id', asyncHandler(getScorePage));

export default router;
