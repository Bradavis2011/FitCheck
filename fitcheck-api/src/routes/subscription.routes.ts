import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

// Authenticated subscription endpoints
router.post('/subscription/sync', authenticateToken, asyncHandler(subscriptionController.syncSubscription));
router.get('/subscription/status', authenticateToken, asyncHandler(subscriptionController.getSubscriptionStatus));

export default router;
