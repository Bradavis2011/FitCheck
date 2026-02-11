import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as outfitController from '../controllers/outfit.controller.js';

const router = Router();

// All outfit routes require authentication
router.use(authenticateToken);

// Submit outfit for feedback
router.post('/check', asyncHandler(outfitController.submitOutfitCheck));

// Get outfit feedback by ID
router.get('/:id', asyncHandler(outfitController.getOutfitFeedback));

// List user's outfit checks
router.get('/', asyncHandler(outfitController.listOutfitChecks));

// Follow-up question
router.post('/:id/followup', asyncHandler(outfitController.submitFollowUpQuestion));

// Rate feedback
router.put('/:id/rate', asyncHandler(outfitController.rateFeedback));

// Toggle favorite
router.put('/:id/favorite', asyncHandler(outfitController.toggleFavorite));

// Delete outfit check
router.delete('/:id', asyncHandler(outfitController.deleteOutfitCheck));

export default router;
