import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getAgentDashboard,
  getAgentActions,
  getPendingQueue,
  approveAction,
  rejectAction,
  killAgent,
  enableAgent,
  killAllAgents,
  getDashboardSummary,
  processApprovedActions,
} from '../services/agent-manager.service.js';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

function requireAdmin(req: AuthenticatedRequest): void {
  const userId = req.userId;
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    throw new AppError(403, 'Admin access required');
  }
}

// GET /api/admin/agents — dashboard: all agent configs + recent actions + pending count
export async function listAgents(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const dashboard = await getAgentDashboard();
  res.json(dashboard);
}

// GET /api/admin/agents/summary — compact stats for the dashboard header
export async function agentSummary(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const summary = await getDashboardSummary();
  res.json(summary);
}

// GET /api/admin/agents/queue — pending approval queue
export async function getQueue(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const PageSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });
  const { page, limit } = PageSchema.parse(req.query);
  const result = await getPendingQueue(page, limit);
  res.json(result);
}

// GET /api/admin/agents/:name/actions — paginated action log for a specific agent
export async function getAgentActionLog(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { name } = req.params;
  const PageSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });
  const { page, limit } = PageSchema.parse(req.query);
  const result = await getAgentActions(name, page, limit);
  res.json(result);
}

// POST /api/admin/agents/:name/toggle — enable or disable an agent
export async function toggleAgent(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { name } = req.params;
  const BodySchema = z.object({ enabled: z.boolean() });
  const { enabled } = BodySchema.parse(req.body);

  if (enabled) {
    await enableAgent(name);
  } else {
    await killAgent(name);
  }

  res.json({ ok: true, agent: name, enabled });
}

// POST /api/admin/agents/actions/:id/approve — approve a queued action (executes on next cron tick)
export async function approveAgentAction(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const userId = req.userId!;
  await approveAction(id, userId);

  // Immediately trigger execution rather than waiting for cron
  try {
    await processApprovedActions();
  } catch (err) {
    // Don't fail the response if execution itself fails — it's logged in the action row
    console.error('[AgentAdmin] processApprovedActions after approve failed:', err);
  }

  res.json({ ok: true, actionId: id, status: 'approved_and_processing' });
}

// POST /api/admin/agents/actions/:id/reject — reject a queued action
export async function rejectAgentAction(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const userId = req.userId!;
  await rejectAction(id, userId);
  res.json({ ok: true, actionId: id, status: 'rejected' });
}

// POST /api/admin/agents/kill-all — global kill switch
export async function killAll(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  await killAllAgents();
  res.json({ ok: true, message: 'All operator agents disabled' });
}
