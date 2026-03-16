import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { webCheck } from '../controllers/web-check.controller.js';
import { webCheckLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/web-check/check — unauthenticated, rate limited to 3/IP/24h
router.post('/check', webCheckLimiter, asyncHandler(webCheck));

export default router;
