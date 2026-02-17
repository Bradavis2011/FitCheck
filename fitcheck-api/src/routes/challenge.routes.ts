import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  listChallenges,
  getActiveChallenge,
  getChallenge,
  getLeaderboard,
  submitEntry,
  voteForSubmission,
  getMySubmission,
  createChallenge,
  endChallenge,
} from '../controllers/challenge.controller.js';

const router = Router();

// Public-ish reads (still require auth token to track votes etc.)
router.use(authenticateToken);

router.get('/', asyncHandler(listChallenges));
router.get('/active', asyncHandler(getActiveChallenge));
router.get('/:id', asyncHandler(getChallenge));
router.get('/:id/leaderboard', asyncHandler(getLeaderboard));
router.get('/:id/my-submission', asyncHandler(getMySubmission));

// Write actions
router.post('/:id/submit', asyncHandler(submitEntry));
router.post('/:id/submissions/:subId/vote', asyncHandler(voteForSubmission));

// Admin
router.post('/', asyncHandler(createChallenge));
router.post('/:id/end', asyncHandler(endChallenge));

export default router;
