import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as outfitController from '../controllers/outfit.controller.js';
import {
  FollowUpQuestionSchema,
  RateFeedbackSchema,
  RespondToFollowUpSchema,
  ListOutfitChecksQuerySchema,
} from '../schemas/index.js';

const router = Router();

// All outfit routes require authentication
router.use(authenticateToken);

// Submit outfit for feedback
router.post('/check', asyncHandler(outfitController.submitOutfitCheck));

// Get personalized recommendations (must be before /:id to avoid conflicts)
router.get('/recommendations', asyncHandler(outfitController.getRecommendations));

// Outfit memory: best past outfit for given occasions
router.get('/memory', asyncHandler(outfitController.getOutfitMemoryHandler));

// Post-event follow-up response
router.post('/follow-up/:followUpId/respond', validateRequest({ body: RespondToFollowUpSchema }), asyncHandler(outfitController.respondToFollowUp));

// Get outfit feedback by ID
router.get('/:id', asyncHandler(outfitController.getOutfitFeedback));

// List user's outfit checks
router.get('/', validateRequest({ query: ListOutfitChecksQuerySchema }), asyncHandler(outfitController.listOutfitChecks));

// Follow-up question
router.post('/:id/followup', validateRequest({ body: FollowUpQuestionSchema }), asyncHandler(outfitController.submitFollowUpQuestion));

// Rate feedback
router.put('/:id/rate', validateRequest({ body: RateFeedbackSchema }), asyncHandler(outfitController.rateFeedback));

// Toggle favorite
router.put('/:id/favorite', asyncHandler(outfitController.toggleFavorite));

// Toggle public visibility
router.put('/:id/public', asyncHandler(outfitController.togglePublic));

// Re-analyze outfit (retry failed/fallback analysis)
router.post('/:id/reanalyze', asyncHandler(outfitController.reanalyzeOutfit));

// Delete outfit check
router.delete('/:id', asyncHandler(outfitController.deleteOutfitCheck));

export default router;
