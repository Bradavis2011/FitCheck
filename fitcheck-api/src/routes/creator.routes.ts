import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  listCreators,
  addCreator,
  updateCreator,
  addCreatorPost,
  updateCreatorPost,
  flagPostViral,
} from '../controllers/creator.controller.js';

const router = Router();

// All routes require authentication (requireAdmin called inside each handler)
router.use(authenticateToken);

// Creator CRUD
router.get('/', asyncHandler(listCreators));
router.post('/', asyncHandler(addCreator));
router.patch('/:id', asyncHandler(updateCreator));

// Creator post management
router.post('/:id/posts', asyncHandler(addCreatorPost));
router.patch('/:id/posts/:postId', asyncHandler(updateCreatorPost));
router.post('/:id/posts/:postId/flag-viral', asyncHandler(flagPostViral));

export default router;
