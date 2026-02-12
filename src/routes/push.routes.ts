import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { registerPushToken, unregisterPushToken } from '../controllers/push.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Register a push token
router.post('/register', asyncHandler(registerPushToken));

// Unregister a push token
router.delete('/register', asyncHandler(unregisterPushToken));

export default router;
