import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  addOutfitToEvent,
  removeOutfitFromEvent,
  compareOutfits,
} from '../controllers/event.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(listEvents));
router.post('/', asyncHandler(createEvent));
router.get('/:id', asyncHandler(getEvent));
router.put('/:id', asyncHandler(updateEvent));
router.delete('/:id', asyncHandler(deleteEvent));

router.post('/:id/outfits', asyncHandler(addOutfitToEvent));
router.delete('/:id/outfits/:outfitCheckId', asyncHandler(removeOutfitFromEvent));

router.post('/:id/compare', asyncHandler(compareOutfits));

export default router;
