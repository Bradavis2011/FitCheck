import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
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
} from '../controllers/agent-admin.controller.js';

const router = Router();

// Token verify — no auth required (this IS the login endpoint)
router.post('/auth/verify', asyncHandler(verifyToken));

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

// Action approval/rejection (before /:name/toggle to avoid conflict)
router.post('/actions/:id/approve', asyncHandler(approveAgentAction));
router.post('/actions/:id/reject', asyncHandler(rejectAgentAction));

// Per-agent controls
router.get('/:name/actions', asyncHandler(getAgentActionLog));
router.post('/:name/toggle', asyncHandler(toggleAgent));

export default router;
