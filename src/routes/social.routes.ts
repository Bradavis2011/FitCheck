import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  searchUsers,
  getUserProfile,
  getCommunityFeed,
  submitCommunityFeedback,
  getOutfitFeedback,
} from '../controllers/social.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// User search and profiles
router.get('/users/search', asyncHandler(searchUsers));
router.get('/users/:id/profile', asyncHandler(getUserProfile));

// Community feed
router.get('/community/feed', asyncHandler(getCommunityFeed));

// Community feedback
router.post('/community/feedback', asyncHandler(submitCommunityFeedback));
router.get('/outfits/:id/feedback', asyncHandler(getOutfitFeedback));

export default router;
