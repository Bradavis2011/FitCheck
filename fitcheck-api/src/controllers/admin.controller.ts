import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { getMetricsSnapshot, getSnapshotHistory } from '../services/metrics.service.js';
import { sendDailyDigest, sendWeeklyDigest } from '../services/email-report.service.js';
import { requireAdmin } from '../utils/admin.js';

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
