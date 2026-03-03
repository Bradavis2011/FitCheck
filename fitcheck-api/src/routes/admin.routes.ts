import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { getLiveMetrics, getMetricsHistory, triggerReport, getContentDigest } from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require auth
router.use(authenticateToken);

router.get('/metrics', asyncHandler(getLiveMetrics));
router.get('/metrics/history', asyncHandler(getMetricsHistory));
router.post('/reports/send', asyncHandler(triggerReport));
router.get('/content-digest', asyncHandler(getContentDigest));

export default router;
