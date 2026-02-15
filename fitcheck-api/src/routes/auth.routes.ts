import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import express from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Clerk webhook endpoint
// Note: Uses express.raw() middleware to preserve raw body for signature verification
router.post(
  '/clerk-webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(authController.handleClerkWebhook)
);

export default router;
