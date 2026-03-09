import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendMessage, getChatHistory, getChatStatus } from '../controllers/stylist-chat.controller.js';

const router = Router();

router.use(authenticateToken);

router.post('/', asyncHandler(sendMessage));
router.get('/', asyncHandler(getChatHistory));
router.get('/status', asyncHandler(getChatStatus));

export default router;
