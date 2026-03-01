import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { submitFeedback } from '../controllers/feedback.controller.js';

const router = Router();

router.post('/', authenticateToken, asyncHandler(submitFeedback));

export default router;
