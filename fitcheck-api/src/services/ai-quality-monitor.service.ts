import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { getAiCounters } from './ai-feedback.service.js';

export interface AiQualityMetrics {
  fallbackRate: number | null;
  avgFeedbackRating: number | null;
  ratingCount: number;
  lowRatingCount: number;
  aiSuccessCount: number;
  aiFallbackCount: number;
}

async function getAiQualityMetrics(): Promise<AiQualityMetrics> {
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counters = getAiCounters();
  const aiTotal = counters.success + counters.fallback;
  const fallbackRate = aiTotal > 0 ? Math.round((counters.fallback / aiTotal) * 100) : null;

  const [ratingAgg, lowRatings] = await Promise.all([
    prisma.outfitCheck.aggregate({
      where: { feedbackRating: { not: null }, createdAt: { gte: ago24h } },
      _avg: { feedbackRating: true },
      _count: { feedbackRating: true },
    }),
    prisma.outfitCheck.count({
      where: { feedbackRating: { lte: 2 }, createdAt: { gte: ago24h } },
    }),
  ]);

  return {
    fallbackRate,
    avgFeedbackRating: ratingAgg._avg.feedbackRating ?? null,
    ratingCount: ratingAgg._count.feedbackRating,
    lowRatingCount: lowRatings,
    aiSuccessCount: counters.success,
    aiFallbackCount: counters.fallback,
  };
}

function buildAiQualityEmail(m: AiQualityMetrics, alerts: string[]): string {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const alertBanner = `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#EF4444;margin-bottom:8px;">🚨 AI Quality Alert</div>
      ${alerts.map(a => `<div style="font-size:13px;color:#1A1A1A;margin-bottom:4px;">• ${a}</div>`).join('')}
    </div>
  `;

  const fallbackColor = m.fallbackRate === null ? '#6B7280'
    : m.fallbackRate < 5 ? '#10B981'
    : m.fallbackRate < 10 ? '#F59E0B'
    : '#EF4444';

  const ratingColor = m.avgFeedbackRating === null ? '#6B7280'
    : m.avgFeedbackRating >= 4 ? '#10B981'
    : m.avgFeedbackRating >= 3.5 ? '#F59E0B'
    : '#EF4444';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">AI Quality Alert — ${dateStr}</div>
      </div>
      <div style="padding:32px 40px;">
        ${alertBanner}
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${fallbackColor};">${m.fallbackRate != null ? m.fallbackRate + '%' : 'N/A'}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Fallback Rate</div>
            </div>
          </td>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${ratingColor};">${m.avgFeedbackRating != null ? m.avgFeedbackRating.toFixed(1) + '★' : 'N/A'}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Avg Rating (24h, n=${m.ratingCount})</div>
            </div>
          </td>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.aiSuccessCount} / ${m.aiSuccessCount + m.aiFallbackCount}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Success / Total</div>
            </div>
          </td>
        </tr></table>
      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · AI Quality Monitor · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runAiQualityMonitor(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[AiQualityMonitor] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const metrics = await getAiQualityMetrics();
    const alerts: string[] = [];

    if (metrics.fallbackRate !== null && metrics.fallbackRate > 10) {
      alerts.push(`Fallback rate is ${metrics.fallbackRate}% (threshold: 10%) — Gemini may be degraded`);
    }
    if (metrics.avgFeedbackRating !== null && metrics.ratingCount >= 5 && metrics.avgFeedbackRating < 3.5) {
      alerts.push(`Average rating is ${metrics.avgFeedbackRating.toFixed(1)}/5 (threshold: 3.5) — users are dissatisfied with AI quality`);
    }

    if (alerts.length === 0) {
      console.log('[AiQualityMonitor] No alerts — skipping email');
      return;
    }

    const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';
    await resend.emails.send({
      from,
      to: recipient,
      subject: `🚨 Or This? AI Quality Alert — ${alerts.length} issue(s) detected`,
      html: buildAiQualityEmail(metrics, alerts),
    });

    console.log(`✅ [AiQualityMonitor] Sent alert email (${alerts.length} issues)`);
  } catch (err) {
    console.error('[AiQualityMonitor] Failed:', err);
  }
}

// Export for founder brief aggregation
export async function getAiQualitySummary(): Promise<AiQualityMetrics> {
  return getAiQualityMetrics();
}
