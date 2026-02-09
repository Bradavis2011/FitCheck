import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.get('/stats', userController.getUserStats);

export default router;
