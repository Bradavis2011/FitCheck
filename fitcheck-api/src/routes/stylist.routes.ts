import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  applyStylist,
  getMyStylistProfile,
  updateMyStylistProfile,
  getStylists,
  getStylist,
  verifyStylist,
  unverifyStylist,
} from '../controllers/stylist.controller.js';

const router = Router();

router.use(authenticateToken);

// Public listings
router.get('/', asyncHandler(getStylists));
router.get('/me', asyncHandler(getMyStylistProfile));
router.post('/apply', asyncHandler(applyStylist));
router.put('/me', asyncHandler(updateMyStylistProfile));

// Individual stylist
router.get('/:id', asyncHandler(getStylist));

// Admin verification
router.post('/:id/verify', asyncHandler(verifyStylist));
router.post('/:id/unverify', asyncHandler(unverifyStylist));

export default router;
