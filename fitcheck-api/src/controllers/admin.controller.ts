import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { getMetricsSnapshot, getSnapshotHistory } from '../services/metrics.service.js';
import { sendDailyDigest, sendWeeklyDigest } from '../services/email-report.service.js';
import { requireAdmin } from '../utils/admin.js';
import { prisma } from '../utils/prisma.js';

// GET /api/admin/metrics
export async function getLiveMetrics(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const metrics = await getMetricsSnapshot();
  res.json({ metrics });
}

// GET /api/admin/metrics/history?days=30
const HistorySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function getMetricsHistory(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { days } = HistorySchema.parse(req.query);
  const history = await getSnapshotHistory(days);
  res.json({ history, days });
}

// POST /api/admin/reports/send
const SendReportSchema = z.object({
  type: z.enum(['daily', 'weekly']).default('daily'),
});

export async function triggerReport(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { type } = SendReportSchema.parse(req.body);

  if (type === 'weekly') {
    await sendWeeklyDigest();
  } else {
    await sendDailyDigest();
  }

  res.json({ ok: true, sent: type });
}

// GET /api/admin/content-digest?days=7
const DigestQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export async function getContentDigest(req: AuthenticatedRequest, res: Response) {
  requireAdmin(req);
  const { days } = DigestQuerySchema.parse(req.query);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [tiktokScripts, trendReports, styleTips, pendingPosts] = await Promise.all([
    prisma.blogDraft.findMany({
      where: { contentType: 'tiktok_script', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.blogDraft.findMany({
      where: { contentType: 'trend_report', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.blogDraft.findMany({
      where: { contentType: 'style_tip', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.socialPost.findMany({
      where: { status: 'draft' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    period: { days, since: since.toISOString() },
    summary: {
      tiktokScripts: tiktokScripts.length,
      trendReports: trendReports.length,
      styleTips: styleTips.length,
      pendingPosts: pendingPosts.length,
    },
    tiktokScripts,
    trendReports,
    styleTips,
    pendingPosts,
  });
}
