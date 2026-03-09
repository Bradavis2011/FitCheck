import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { getHomeContext } from '../controllers/home.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/context', asyncHandler(getHomeContext));

export default router;
