import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  listAgents,
  agentSummary,
  getQueue,
  getAgentActionLog,
  toggleAgent,
  approveAgentAction,
  rejectAgentAction,
  killAll,
} from '../controllers/agent-admin.controller.js';

const router = Router();

// All routes require authentication (admin check happens inside each handler)
router.use(authenticateToken);

// Dashboard overview
router.get('/', asyncHandler(listAgents));
router.get('/summary', asyncHandler(agentSummary));

// Pending approval queue
router.get('/queue', asyncHandler(getQueue));

// Global kill switch
router.post('/kill-all', asyncHandler(killAll));

// Per-agent controls
router.get('/:name/actions', asyncHandler(getAgentActionLog));
router.post('/:name/toggle', asyncHandler(toggleAgent));

// Action approval/rejection
router.post('/actions/:id/approve', asyncHandler(approveAgentAction));
router.post('/actions/:id/reject', asyncHandler(rejectAgentAction));

export default router;
