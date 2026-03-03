import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { wardrobeAiLimiter } from '../middleware/rateLimiter.js';
import {
  listWardrobeItems,
  getWardrobeItem,
  createWardrobeItem,
  updateWardrobeItem,
  deleteWardrobeItem,
  logWear,
  getWardrobeProgress,
  getWardrobeItemOutfits,
  suggestOutfit,
  analyzeOutfit,
} from '../controllers/wardrobe.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(listWardrobeItems));
router.get('/progress', asyncHandler(getWardrobeProgress));
router.post('/', asyncHandler(createWardrobeItem));
// AI wardrobe routes — before /:id to avoid route collision
router.post('/suggest-outfit', wardrobeAiLimiter, asyncHandler(suggestOutfit));
router.post('/analyze-outfit', wardrobeAiLimiter, asyncHandler(analyzeOutfit));
router.get('/:id', asyncHandler(getWardrobeItem));
router.get('/:id/outfits', asyncHandler(getWardrobeItemOutfits));
router.put('/:id', asyncHandler(updateWardrobeItem));
router.delete('/:id', asyncHandler(deleteWardrobeItem));
router.post('/:id/wear', asyncHandler(logWear));

export default router;
