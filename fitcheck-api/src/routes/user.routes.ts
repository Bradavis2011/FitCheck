import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

router.get('/profile', asyncHandler(userController.getProfile));
router.put('/profile', asyncHandler(userController.updateProfile));
router.get('/stats', asyncHandler(userController.getUserStats));
router.get('/style-profile', asyncHandler(userController.getStyleProfile));
router.get('/style-evolution', asyncHandler(userController.getStyleEvolution));

// Account management
router.delete('/account', asyncHandler(userController.deleteAccount));
router.delete('/history', asyncHandler(userController.clearHistory));

// Gamification endpoints
router.get('/leaderboard/:type', asyncHandler(userController.getLeaderboard));
router.get('/daily-goals', asyncHandler(userController.getDailyGoals));
router.get('/badges', asyncHandler(userController.getBadges));

export default router;
