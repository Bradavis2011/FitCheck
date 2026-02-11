import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/clerk-webhook', asyncHandler(authController.syncClerkUser));

export default router;
