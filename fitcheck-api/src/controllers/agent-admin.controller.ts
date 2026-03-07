import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
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
  getAgentHealth,
} from '../services/agent-manager.service.js';
import { safeTokenEqual } from '../utils/crypto.js';
import { requireAdmin } from '../utils/admin.js';

// POST /api/admin/agents/auth/verify — validate dashboard token (no auth required)
export async function verifyToken(req: Request, res: Response) {
  const { token } = req.body || {};
  const adminToken = process.env.ADMIN_DASHBOARD_TOKEN;

  if (!adminToken || !token || !safeTokenEqual(token, adminToken)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ ok: true });
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

// PATCH /api/admin/agents/social-posts/:postId — edit content/hashtags before posting
export async function updateSocialPost(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { postId } = req.params;
  const Schema = z.object({
    content:  z.string().min(1).max(2000),
    hashtags: z.array(z.string()).optional(),
  });
  const { content, hashtags } = Schema.parse(req.body);

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) throw new AppError(404, 'Social post not found');
  if (post.status !== 'pending') throw new AppError(409, 'Post is no longer pending');

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      content,
      ...(hashtags !== undefined && { hashtags }),
    },
  });

  res.json({ ok: true, postId });
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

// GET /api/admin/agents/health — per-agent health status (lastRunAt, lastError, green/yellow/red)
export async function getHealthStatus(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const health = await getAgentHealth();
  res.json({ health });
}

// POST /api/admin/agents/kill-all — global kill switch
export async function killAll(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  await killAllAgents();
  res.json({ ok: true, message: 'All operator agents disabled' });
}

// POST /api/admin/agents/:name/trigger — manually trigger an agent run now
// Body: { force?: boolean } — pass force:true to bypass day-of-week guard on social-media-manager
export async function triggerAgent(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { name } = req.params;
  const force = req.body?.force === true;

  const agentMap: Record<string, () => Promise<void>> = {
    // ── Content & Social ──────────────────────────────────────────────────────
    'content-factory': async () => {
      const { runLearningContentAgent } = await import('../services/learning-content.service.js');
      await runLearningContentAgent();
    },
    'content-calendar': async () => {
      const { runContentCalendar } = await import('../services/content-calendar.service.js');
      await runContentCalendar();
    },
    'social-media-manager': async () => {
      const { runSocialMediaManager } = await import('../services/social-media-manager.service.js');
      await runSocialMediaManager({ force });
    },
    'outreach-agent': async () => {
      const { runOutreachAgent } = await import('../services/outreach-agent.service.js');
      await runOutreachAgent();
    },
    // ── Growth & Analytics ────────────────────────────────────────────────────
    'growth-dashboard': async () => {
      const { runGrowthDashboard } = await import('../services/growth-dashboard.service.js');
      await runGrowthDashboard();
    },
    'viral-monitor': async () => {
      const { runViralMonitor } = await import('../services/viral-monitor.service.js');
      await runViralMonitor();
    },
    'beta-recruiter': async () => {
      const { runBetaRecruiter } = await import('../services/beta-recruiter.service.js');
      await runBetaRecruiter();
    },
    // ── Revenue & Quality ─────────────────────────────────────────────────────
    'revenue-cost': async () => {
      const { runRevenueCostTracker } = await import('../services/revenue-cost.service.js');
      await runRevenueCostTracker();
    },
    'ai-quality-monitor': async () => {
      const { runAiQualityMonitor } = await import('../services/ai-quality-monitor.service.js');
      await runAiQualityMonitor();
    },
    // ── Community & App Store ─────────────────────────────────────────────────
    'community-manager-daily': async () => {
      const { runCommunityManagerDaily } = await import('../services/community-manager.service.js');
      await runCommunityManagerDaily();
    },
    'community-manager-weekly': async () => {
      const { runCommunityManagerWeekly } = await import('../services/community-manager.service.js');
      await runCommunityManagerWeekly();
    },
    'appstore-manager': async () => {
      const { runAppStoreManager } = await import('../services/appstore-manager.service.js');
      await runAppStoreManager();
    },
    'appstore-weekly': async () => {
      const { runAppStoreWeeklySummary } = await import('../services/appstore-manager.service.js');
      await runAppStoreWeeklySummary();
    },
    // ── AI & Intelligence ─────────────────────────────────────────────────────
    'fashion-trends': async () => {
      const { runFashionTrendCron } = await import('../services/fashion-trends.service.js');
      await runFashionTrendCron();
    },
    'calibration-snapshot': async () => {
      const { runCalibrationSnapshot } = await import('../services/calibration-snapshot.service.js');
      await runCalibrationSnapshot();
    },
    // ── Lifecycle & Conversion ─────────────────────────────────────────────────
    'lifecycle-email': async () => {
      const { runLifecycleEmail } = await import('../services/lifecycle-email.service.js');
      await runLifecycleEmail();
    },
    'conversion-intelligence': async () => {
      const { runConversionIntelligence } = await import('../services/conversion-intelligence.service.js');
      await runConversionIntelligence();
    },
    // ── Founder Summary ───────────────────────────────────────────────────────
    'founder-brief': async () => {
      const { runFounderBrief } = await import('../services/founder-brief.service.js');
      await runFounderBrief();
    },
    // ── Security & Quality ────────────────────────────────────────────────────
    'security-auditor': async () => {
      const { runSecurityAudit } = await import('../services/security-auditor.service.js');
      await runSecurityAudit();
    },
    'code-reviewer': async () => {
      const { runCodeReview } = await import('../services/code-reviewer.service.js');
      await runCodeReview();
    },
    // ── Creator Program ──────────────────────────────────────────────────
    'creator-hooks': async () => {
      const { generateCreatorHooks } = await import('../services/social-content-engine.service.js');
      await generateCreatorHooks();
    },
    'creator-hook-distribution': async () => {
      const { runCreatorHookDistribution } = await import('../services/creator-manager.service.js');
      await runCreatorHookDistribution();
    },
    'creator-performance-digest': async () => {
      const { runCreatorPerformanceDigest } = await import('../services/creator-manager.service.js');
      await runCreatorPerformanceDigest();
    },
    // ── Growth Intern ─────────────────────────────────────────────────────
    'creator-scout': async () => {
      const { runCreatorScout } = await import('../services/creator-scout.service.js');
      await runCreatorScout();
    },
    'creator-outreach': async () => {
      const { runEmailOutreach } = await import('../services/creator-outreach.service.js');
      await runEmailOutreach();
    },
    'email-follow-up': async () => {
      const { runEmailFollowUp } = await import('../services/creator-outreach.service.js');
      await runEmailFollowUp();
    },
    'reddit-scout': async () => {
      const { runRedditDiscovery } = await import('../services/reddit-scout.service.js');
      await runRedditDiscovery();
    },
    'growth-intern': async () => {
      const { runMorningBrief } = await import('../services/growth-intern.service.js');
      await runMorningBrief();
    },
  };

  const agentFn = agentMap[name];
  if (!agentFn) {
    res.status(404).json({
      error: `Unknown agent: "${name}"`,
      supported: Object.keys(agentMap),
    });
    return;
  }

  // Fire and forget — agents can run for several seconds/minutes
  agentFn().catch(err => console.error(`[AgentAdmin] Triggered agent "${name}" failed:`, err));

  res.json({ ok: true, agent: name, message: `Agent "${name}" triggered — running in background` });
}

// GET /api/admin/agents/growth — growth pipeline + Reddit threads + email stats
export async function getGrowthPipeline(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);

  const [prospects, redditThreads, pipelineStats] = await Promise.all([
    prisma.creatorProspect.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.redditThread.findMany({
      orderBy: [{ status: 'asc' }, { relevanceScore: 'desc' }],
      take: 100,
    }),
    prisma.creatorProspect.groupBy({
      by: ['status', 'outreachMethod'],
      _count: { id: true },
    }),
  ]);

  // Email performance stats
  const emailStats = {
    total: prospects.filter(p => p.outreachMethod === 'email').length,
    contacted: prospects.filter(p => p.outreachMethod === 'email' && p.contactedAt).length,
    opened: prospects.filter(p => p.emailOpenedAt).length,
    clicked: prospects.filter(p => p.emailClickedAt).length,
    responded: prospects.filter(p => p.status === 'responded').length,
    onboarded: prospects.filter(p => p.status === 'onboarded').length,
  };

  res.json({ prospects, redditThreads, pipelineStats, emailStats });
}

// PATCH /api/admin/agents/growth/prospects/:id — update prospect status/notes
export async function updateProspect(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const Schema = z.object({
    status: z.string().optional(),
    notes: z.string().optional(),
  });
  const data = Schema.parse(req.body);
  const prospect = await prisma.creatorProspect.update({ where: { id }, data });
  res.json({ ok: true, prospect });
}

// PATCH /api/admin/agents/growth/threads/:id — update thread status
export async function updateRedditThread(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const Schema = z.object({
    status: z.string().optional(),
    suggestedResponse: z.string().optional(),
  });
  const data = Schema.parse(req.body);
  const thread = await prisma.redditThread.update({ where: { id }, data });
  res.json({ ok: true, thread });
}

// PATCH /api/admin/agents/growth/dm-contacted/:id — mark DM prospect as contacted
export async function markDmContacted(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { id } = req.params;
  const prospect = await prisma.creatorProspect.update({
    where: { id },
    data: { status: 'contacted', contactedAt: new Date() },
  });
  res.json({ ok: true, prospect });
}

// POST /api/admin/agents/growth/report-post — log a creator post (self-reported)
export async function reportCreatorPost(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const Schema = z.object({
    creatorHandle: z.string().min(1),
    postUrl: z.string().url(),
    hookUsed: z.string().optional(),
    views: z.number().int().min(0).optional().default(0),
  });
  const { creatorHandle, postUrl, hookUsed, views } = Schema.parse(req.body);

  // Look up Creator by handle (case-insensitive prefix match)
  const handle = creatorHandle.replace(/^@/, '');
  const creator = await prisma.creator.findFirst({
    where: { handle: { equals: handle, mode: 'insensitive' } },
  });

  if (!creator) {
    res.status(404).json({ error: `No Creator found with handle "${handle}". Make sure the creator is in the system first.` });
    return;
  }

  const post = await prisma.creatorPost.create({
    data: {
      creatorId:   creator.id,
      platform:    creator.platform,
      externalUrl: postUrl,
      hookUsed:    hookUsed || null,
      views:       views ?? 0,
      postedAt:    new Date(),
    },
  });

  // Update creator aggregate stats
  await prisma.creator.update({
    where: { id: creator.id },
    data: {
      totalPosts:  { increment: 1 },
      totalViews:  { increment: views ?? 0 },
      lastPostDate: new Date(),
    },
  });

  res.json({ ok: true, post });
}

// POST /api/admin/agents/growth/creator-referral — record that one creator recruited another
export async function recordCreatorReferral(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const Schema = z.object({
    referringCreatorId: z.string().min(1),
    prospectId: z.string().min(1),
  });
  const { referringCreatorId, prospectId } = Schema.parse(req.body);

  const { creditCreatorReferral } = await import('../services/creator-manager.service.js');
  const result = await creditCreatorReferral(referringCreatorId, prospectId);

  res.json({ ok: true, ...result });
}
