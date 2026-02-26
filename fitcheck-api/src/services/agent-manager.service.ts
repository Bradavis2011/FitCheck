import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { checkContent } from './brand-guard.service.js';
import { postToTwitter } from './twitter.service.js';

// Helper: cast unknown objects to Prisma's JSON value type
function toJson(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

const RISK_LEVELS: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

type Executor = (payload: Record<string, unknown>) => Promise<unknown>;

// Module-level executor registry: "${agent}:${actionType}" → executor fn
const executorRegistry = new Map<string, Executor>();

/** Register an executor so processApprovedActions can run it after a server restart. */
export function registerExecutor(agent: string, actionType: string, fn: Executor): void {
  executorRegistry.set(`${agent}:${actionType}`, fn);
}

// ─── Config Helpers ───────────────────────────────────────────────────────────

interface AgentConfigResolved {
  enabled: boolean;
  maxPerDay: number;
  maxPerHour: number;
  autoApproveRisk: RiskLevel;
}

async function getConfig(agent: string): Promise<AgentConfigResolved> {
  let config = await prisma.agentConfig.findUnique({ where: { agent } });
  if (!config) {
    config = await prisma.agentConfig.create({
      data: {
        agent,
        enabled: true,
        maxActionsPerDay: 50,
        maxActionsPerHour: 10,
        autoApproveRisk: 'medium',
      },
    });
  }
  return {
    enabled: config.enabled,
    maxPerDay: config.maxActionsPerDay,
    maxPerHour: config.maxActionsPerHour,
    autoApproveRisk: (config.autoApproveRisk as RiskLevel) || 'medium',
  };
}

async function checkRateLimit(
  agent: string,
  maxPerHour: number,
  maxPerDay: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [hourCount, dayCount] = await Promise.all([
    prisma.agentAction.count({
      where: { agent, createdAt: { gte: oneHourAgo }, status: { not: 'rejected' } },
    }),
    prisma.agentAction.count({
      where: { agent, createdAt: { gte: oneDayAgo }, status: { not: 'rejected' } },
    }),
  ]);

  if (hourCount >= maxPerHour) {
    return { allowed: false, reason: `hourly_limit_exceeded (${hourCount}/${maxPerHour})` };
  }
  if (dayCount >= maxPerDay) {
    return { allowed: false, reason: `daily_limit_exceeded (${dayCount}/${maxPerDay})` };
  }
  return { allowed: true };
}

// ─── Core: executeOrQueue ─────────────────────────────────────────────────────

export interface ExecuteResult {
  status: 'executed' | 'queued' | 'rejected';
  actionId: string;
  reason?: string;
}

/**
 * Central chokepoint for all agent actions.
 *
 * @param agent        - Agent name (e.g. "lifecycle-email")
 * @param actionType   - Action type (e.g. "send_email")
 * @param riskLevel    - "low" | "medium" | "high"
 * @param payload      - Action-specific data stored in DB
 * @param executeFn    - Async function that performs the action
 * @param contentToCheck - Optional text to run through brand guard (medium+ risk)
 */
export async function executeOrQueue(
  agent: string,
  actionType: string,
  riskLevel: RiskLevel,
  payload: Record<string, unknown>,
  executeFn: Executor,
  contentToCheck?: string,
): Promise<ExecuteResult> {
  // Register executor for later use by processApprovedActions
  executorRegistry.set(`${agent}:${actionType}`, executeFn);

  // ── Kill switch check ──
  const config = await getConfig(agent);
  if (!config.enabled) {
    console.log(`[AgentManager] Agent "${agent}" is disabled — skipping ${actionType}`);
    return { status: 'rejected', actionId: '', reason: 'agent_disabled' };
  }

  // ── Rate limit check ──
  const rateCheck = await checkRateLimit(agent, config.maxPerHour, config.maxPerDay);
  if (!rateCheck.allowed) {
    console.log(`[AgentManager] Rate limit for ${agent}:${actionType} — ${rateCheck.reason}`);
    const action = await prisma.agentAction.create({
      data: {
        agent,
        actionType,
        riskLevel,
        status: 'rejected',
        payload: toJson(payload),
        result: toJson({ reason: rateCheck.reason }),
      },
    });
    return { status: 'rejected', actionId: action.id, reason: rateCheck.reason };
  }

  const riskVal = RISK_LEVELS[riskLevel] ?? 0;
  const autoApproveVal = RISK_LEVELS[config.autoApproveRisk] ?? 1;

  // ── Queue for manual approval if risk > autoApproveRisk ──
  if (riskVal > autoApproveVal) {
    const action = await prisma.agentAction.create({
      data: { agent, actionType, riskLevel, status: 'pending', payload: toJson(payload) },
    });
    console.log(`[AgentManager] Queued ${agent}:${actionType} (risk=${riskLevel}) → action ${action.id}`);
    return { status: 'queued', actionId: action.id };
  }

  // ── Brand guard for medium+ risk content ──
  if (riskVal >= RISK_LEVELS.medium && contentToCheck) {
    const guard = await checkContent(contentToCheck, `${agent}/${actionType}`);
    if (!guard.approved) {
      const action = await prisma.agentAction.create({
        data: {
          agent,
          actionType,
          riskLevel,
          status: 'rejected',
          payload: toJson(payload),
          result: toJson({ reason: 'brand_guard_failed', issues: guard.issues }),
        },
      });
      console.log(`[AgentManager] Brand guard rejected ${agent}:${actionType}: ${guard.issues.join(', ')}`);
      return {
        status: 'rejected',
        actionId: action.id,
        reason: `brand_guard: ${guard.issues.join(', ')}`,
      };
    }
  }

  // ── Auto-execute ──
  const action = await prisma.agentAction.create({
    data: { agent, actionType, riskLevel, status: 'pending', payload: toJson(payload) },
  });

  try {
    const result = await executeFn(payload);
    await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: 'executed',
        result: toJson((result as Record<string, unknown>) ?? {}),
        executedAt: new Date(),
      },
    });
    console.log(`[AgentManager] Executed ${agent}:${actionType} → action ${action.id}`);
    return { status: 'executed', actionId: action.id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: 'failed', result: toJson({ error: errMsg }) },
    });
    console.error(`[AgentManager] Failed ${agent}:${actionType}:`, err);
    throw err;
  }
}

// ─── Built-in Executor Registration ──────────────────────────────────────────
// Register known high-risk executors directly here so processApprovedActions
// always has them available, regardless of cron init order.

executorRegistry.set('social-media-manager:post_social', async (payload) => {
  const p = payload as { socialPostId: string; platform: string };
  if (p.platform === 'twitter') {
    return await postToTwitter(p.socialPostId);
  }
  console.log(`[AgentManager] Platform "${p.platform}" requires manual posting`);
  return { posted: false, note: 'manual_posting_required' };
});

// ─── Process Approved Actions (cron every 5 min) ──────────────────────────────

export async function processApprovedActions(): Promise<void> {
  const approved = await prisma.agentAction.findMany({
    where: { status: 'approved' },
    orderBy: { reviewedAt: 'asc' },
    take: 50,
  });

  if (approved.length === 0) return;

  console.log(`[AgentManager] Processing ${approved.length} approved action(s)...`);

  for (const action of approved) {
    const key = `${action.agent}:${action.actionType}`;

    const executor = executorRegistry.get(key);

    if (!executor) {
      await prisma.agentAction.update({
        where: { id: action.id },
        data: { status: 'failed', result: toJson({ error: `No executor registered for ${key}` }) },
      });
      console.warn(`[AgentManager] No executor registered for ${key} — cannot execute action ${action.id}`);
      continue;
    }

    try {
      const result = await executor(action.payload as Record<string, unknown>);
      await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: 'executed',
          result: toJson((result as Record<string, unknown>) ?? {}),
          executedAt: new Date(),
        },
      });
      console.log(`[AgentManager] Executed approved action ${action.id} (${key})`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.agentAction.update({
        where: { id: action.id },
        data: { status: 'failed', result: toJson({ error: errMsg }) },
      });
      console.error(`[AgentManager] Failed to execute approved action ${action.id} (${key}):`, err);
    }
  }
}

// ─── Dashboard Data ───────────────────────────────────────────────────────────

export async function getAgentDashboard() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [configs, recentActions, pendingCount, todayStats] = await Promise.all([
    prisma.agentConfig.findMany({ orderBy: { agent: 'asc' } }),
    prisma.agentAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.agentAction.count({ where: { status: 'pending' } }),
    prisma.agentAction.groupBy({
      by: ['agent', 'status'],
      where: { createdAt: { gte: oneDayAgo } },
      _count: { id: true },
    }),
  ]);

  // Build per-agent stats
  const agentStats: Record<string, Record<string, number>> = {};
  for (const row of todayStats) {
    if (!agentStats[row.agent]) agentStats[row.agent] = {};
    agentStats[row.agent][row.status] = row._count.id;
  }

  return { configs, recentActions, pendingCount, agentStats };
}

export async function getAgentActions(agent: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [actions, total] = await Promise.all([
    prisma.agentAction.findMany({
      where: { agent },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.agentAction.count({ where: { agent } }),
  ]);
  return { actions, total, page, limit };
}

export async function getPendingQueue(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [actions, total] = await Promise.all([
    prisma.agentAction.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.agentAction.count({ where: { status: 'pending' } }),
  ]);
  return { actions, total, page, limit };
}

export async function approveAction(actionId: string, reviewedBy: string): Promise<void> {
  await prisma.agentAction.update({
    where: { id: actionId },
    data: { status: 'approved', reviewedBy, reviewedAt: new Date() },
  });
}

export async function rejectAction(actionId: string, reviewedBy: string): Promise<void> {
  await prisma.agentAction.update({
    where: { id: actionId },
    data: { status: 'rejected', reviewedBy, reviewedAt: new Date() },
  });
}

// ─── Kill Switch / Toggle ─────────────────────────────────────────────────────

export async function killAgent(agentName: string): Promise<void> {
  await prisma.agentConfig.upsert({
    where: { agent: agentName },
    update: { enabled: false },
    create: { agent: agentName, enabled: false },
  });
  console.log(`[AgentManager] Killed agent: ${agentName}`);
}

export async function enableAgent(agentName: string): Promise<void> {
  await prisma.agentConfig.upsert({
    where: { agent: agentName },
    update: { enabled: true },
    create: { agent: agentName, enabled: true },
  });
  console.log(`[AgentManager] Enabled agent: ${agentName}`);
}

const ALL_AGENT_NAMES = [
  'lifecycle-email',
  'conversion-intelligence',
  'community-manager',
  'social-media-manager',
  'appstore-manager',
  'outreach-agent',
  'event-followup',
  'style-narrative',
  'milestone-scanner',
  // Ops Learning Loops
  'ops-learning',
  'nudge',
  // RSI Learning System (B2-B5)
  'followup-learning',
  'milestone-learning',
  'comparison-learning',
  'brand-guard-calibration',
  // Self-Improving StyleDNA Engine
  'piggyback-judge',
  'critic-agent',
  'surgeon',
  'followup-critic',
  'followup-surgeon',
  'arena',
  'learning-memory',
];

export async function killAllAgents(): Promise<void> {
  await Promise.all(
    ALL_AGENT_NAMES.map(agent =>
      prisma.agentConfig.upsert({
        where: { agent },
        update: { enabled: false },
        create: { agent, enabled: false },
      }),
    ),
  );
  console.log('[AgentManager] All operator agents killed');
}

export async function getAllActions(
  page = 1,
  limit = 50,
  filters?: { agent?: string; status?: string; riskLevel?: string },
) {
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (filters?.agent) where.agent = filters.agent;
  if (filters?.status) where.status = filters.status;
  if (filters?.riskLevel) where.riskLevel = filters.riskLevel;

  const [actions, total] = await Promise.all([
    prisma.agentAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.agentAction.count({ where }),
  ]);

  return { actions, total, page, limit };
}

export async function getDashboardSummary() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalToday, pendingCount, failedToday, executedToday] = await Promise.all([
    prisma.agentAction.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.agentAction.count({ where: { status: 'pending' } }),
    prisma.agentAction.count({ where: { status: 'failed', createdAt: { gte: oneDayAgo } } }),
    prisma.agentAction.count({ where: { status: 'executed', createdAt: { gte: oneDayAgo } } }),
  ]);

  return { totalToday, pendingCount, failedToday, executedToday };
}
