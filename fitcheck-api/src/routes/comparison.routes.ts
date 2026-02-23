import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  createComparison,
  analyzeComparison,
  getComparisonFeed,
  voteOnComparison,
  deleteComparison,
} from '../controllers/comparison.controller.js';

const router = Router();

router.use(authenticateToken);

router.post('/', asyncHandler(createComparison));
router.post('/analyze', asyncHandler(analyzeComparison));
router.get('/feed', asyncHandler(getComparisonFeed));
router.post('/:id/vote', asyncHandler(voteOnComparison));
router.delete('/:id', asyncHandler(deleteComparison));

export default router;
