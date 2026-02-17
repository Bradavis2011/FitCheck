import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  requestReview,
  getMyReviews,
  getStylistQueue,
  submitReview,
  getOutfitReview,
  cancelReview,
} from '../controllers/expert-review.controller.js';

const router = Router();

router.use(authenticateToken);

// Requester endpoints
router.post('/', asyncHandler(requestReview));
router.get('/my-requests', asyncHandler(getMyReviews));
router.get('/outfit/:outfitId', asyncHandler(getOutfitReview));
router.delete('/:id', asyncHandler(cancelReview));

// Stylist endpoints
router.get('/my-queue', asyncHandler(getStylistQueue));
router.post('/:id/submit', asyncHandler(submitReview));

export default router;
