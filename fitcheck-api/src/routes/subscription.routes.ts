import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as subscriptionController from '../controllers/subscription.controller.js';
import { SyncSubscriptionSchema } from '../schemas/index.js';

const router = Router();

// Authenticated subscription endpoints
router.post('/subscription/sync', authenticateToken, validateRequest({ body: SyncSubscriptionSchema }), asyncHandler(subscriptionController.syncSubscription));
router.get('/subscription/status', authenticateToken, asyncHandler(subscriptionController.getSubscriptionStatus));

export default router;
