import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { getYourWeek } from '../controllers/week.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(getYourWeek));

export default router;
