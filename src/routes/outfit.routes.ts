import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as outfitController from '../controllers/outfit.controller.js';

const router = Router();

// All outfit routes require authentication
router.use(authenticateToken);

// Submit outfit for feedback
router.post('/check', outfitController.submitOutfitCheck);

// Get outfit feedback by ID
router.get('/:id', outfitController.getOutfitFeedback);

// List user's outfit checks
router.get('/', outfitController.listOutfitChecks);

// Follow-up question
router.post('/:id/followup', outfitController.submitFollowUpQuestion);

// Rate feedback
router.put('/:id/rate', outfitController.rateFeedback);

// Toggle favorite
router.put('/:id/favorite', outfitController.toggleFavorite);

// Delete outfit check
router.delete('/:id', outfitController.deleteOutfitCheck);

export default router;
