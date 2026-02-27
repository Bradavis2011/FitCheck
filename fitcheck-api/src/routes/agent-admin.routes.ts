import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { adminAuthLimiter } from '../middleware/rateLimiter.js';
import {
  verifyToken,
  listAgents,
  agentSummary,
  getQueue,
  getAllActionLog,
  getAgentActionLog,
  toggleAgent,
  approveAgentAction,
  rejectAgentAction,
  killAll,
  triggerAgent,
  updateSocialPost,
} from '../controllers/agent-admin.controller.js';

const router = Router();

// Token verify — no auth required (this IS the login endpoint); rate-limited to 5/5min
router.post('/auth/verify', adminAuthLimiter, asyncHandler(verifyToken));

// All routes below require authentication (admin check inside each handler)
router.use(authenticateToken);

// Dashboard overview
router.get('/', asyncHandler(listAgents));
router.get('/summary', asyncHandler(agentSummary));

// Pending approval queue
router.get('/queue', asyncHandler(getQueue));

// Full action log (must be before /:name/actions to avoid param conflict)
router.get('/actions', asyncHandler(getAllActionLog));

// Global kill switch
router.post('/kill-all', asyncHandler(killAll));

// Social post content editing (before posting)
router.patch('/social-posts/:postId', asyncHandler(updateSocialPost));

// Action approval/rejection (before /:name/toggle to avoid conflict)
router.post('/actions/:id/approve', asyncHandler(approveAgentAction));
router.post('/actions/:id/reject', asyncHandler(rejectAgentAction));

// Per-agent controls
router.get('/:name/actions', asyncHandler(getAgentActionLog));
router.post('/:name/toggle', asyncHandler(toggleAgent));
router.post('/:name/trigger', asyncHandler(triggerAgent));

export default router;
