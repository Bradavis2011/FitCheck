import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getAgentDashboard,
  getAgentActions,
  getAllActions,
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

// POST /api/admin/agents/auth/verify — validate dashboard token (no auth required)
export async function verifyToken(req: Request, res: Response) {
  const { token } = req.body || {};
  const adminToken = process.env.ADMIN_DASHBOARD_TOKEN;

  if (!adminToken) {
    res.status(503).json({ error: 'ADMIN_DASHBOARD_TOKEN not configured on server' });
    return;
  }
  if (!token || token !== adminToken) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  res.json({ ok: true });
}

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

// GET /api/admin/agents/actions — paginated full action log with optional filters
export async function getAllActionLog(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const Schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    agent: z.string().optional(),
    status: z.string().optional(),
    riskLevel: z.string().optional(),
  });
  const params = Schema.parse(req.query);
  const result = await getAllActions(params.page, params.limit, {
    agent: params.agent,
    status: params.status,
    riskLevel: params.riskLevel,
  });
  res.json(result);
}

// POST /api/admin/agents/kill-all — global kill switch
export async function killAll(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  await killAllAgents();
  res.json({ ok: true, message: 'All operator agents disabled' });
}
