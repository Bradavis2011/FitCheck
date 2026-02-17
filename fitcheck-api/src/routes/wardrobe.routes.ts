import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  listWardrobeItems,
  getWardrobeItem,
  createWardrobeItem,
  updateWardrobeItem,
  deleteWardrobeItem,
  logWear,
} from '../controllers/wardrobe.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(listWardrobeItems));
router.post('/', asyncHandler(createWardrobeItem));
router.get('/:id', asyncHandler(getWardrobeItem));
router.put('/:id', asyncHandler(updateWardrobeItem));
router.delete('/:id', asyncHandler(deleteWardrobeItem));
router.post('/:id/wear', asyncHandler(logWear));

export default router;
