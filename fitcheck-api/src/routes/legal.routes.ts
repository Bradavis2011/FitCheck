import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as legalController from '../controllers/legal.controller.js';

const router = Router();

router.get('/current-versions', asyncHandler(legalController.getCurrentVersions));
router.post('/accept', authenticateToken, asyncHandler(legalController.acceptLegalTerms));

export default router;
