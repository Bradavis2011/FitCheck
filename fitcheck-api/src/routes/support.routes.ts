import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { askSupport } from '../controllers/support.controller.js';

const router = Router();

router.post('/question', authenticateToken, asyncHandler(askSupport));

export default router;
