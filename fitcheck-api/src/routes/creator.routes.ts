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
import { getCreatorEarnings, getCreatorDashboard } from '../services/creator-commission.service.js';

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

// Phase 1: Affiliate earnings endpoints
router.get('/:id/earnings', asyncHandler(async (req, res) => {
  const earnings = await getCreatorEarnings(req.params.id);
  if (!earnings) { res.status(404).json({ error: 'Creator not found' }); return; }
  res.json(earnings);
}));

router.get('/:id/dashboard', asyncHandler(async (req, res) => {
  const dashboard = await getCreatorDashboard(req.params.id);
  if (!dashboard) { res.status(404).json({ error: 'Creator not found' }); return; }
  res.json(dashboard);
}));

export default router;
