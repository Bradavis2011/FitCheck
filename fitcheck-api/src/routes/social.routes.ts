import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  SearchUsersQuerySchema,
  CommunityFeedQuerySchema,
  LeaderboardQuerySchema,
} from '../schemas/index.js';
import {
  searchUsers,
  getUserProfile,
  getUserProfileByUsername,
  getCommunityFeed,
  getPublicOutfit,
  submitCommunityFeedback,
  getOutfitFeedback,
  getLeaderboard,
  reportContent,
  blockUser,
  unblockUser,
  getBlockedUsers,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getInnerCircle,
  addToInnerCircle,
  removeFromInnerCircle,
  getInnerCircleStatus,
} from '../controllers/social.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// User search and profiles
router.get('/users/search', validateRequest({ query: SearchUsersQuerySchema }), asyncHandler(searchUsers));
router.get('/users/username/:username', asyncHandler(getUserProfileByUsername));
router.get('/users/:id/profile', asyncHandler(getUserProfile));

// Community feed
router.get('/community/feed', validateRequest({ query: CommunityFeedQuerySchema }), asyncHandler(getCommunityFeed));

// Public outfit details
router.get('/outfits/:id', asyncHandler(getPublicOutfit));

// Community feedback
router.post('/community/feedback', asyncHandler(submitCommunityFeedback));
router.get('/outfits/:id/feedback', asyncHandler(getOutfitFeedback));

// Leaderboard
router.get('/leaderboard', validateRequest({ query: LeaderboardQuerySchema }), asyncHandler(getLeaderboard));

// Moderation
router.post('/report', asyncHandler(reportContent));
router.post('/users/:username/block', asyncHandler(blockUser));
router.delete('/users/:username/block', asyncHandler(unblockUser));
router.get('/blocked-users', asyncHandler(getBlockedUsers));

// Following
router.post('/users/:username/follow', asyncHandler(followUser));
router.delete('/users/:username/follow', asyncHandler(unfollowUser));
router.get('/users/:username/followers', asyncHandler(getFollowers));
router.get('/users/:username/following', asyncHandler(getFollowing));

// Inner Circle
router.get('/inner-circle', asyncHandler(getInnerCircle));
router.post('/users/:username/inner-circle', asyncHandler(addToInnerCircle));
router.delete('/users/:username/inner-circle', asyncHandler(removeFromInnerCircle));
router.get('/users/:username/inner-circle/status', asyncHandler(getInnerCircleStatus));

export default router;
