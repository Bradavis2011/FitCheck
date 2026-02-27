import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { getMetricsSnapshot } from './metrics.service.js';
import { getAiQualitySummary } from './ai-quality-monitor.service.js';
import { getRevenueSummary } from './revenue-cost.service.js';
import { getSecurityAuditSummary } from './security-auditor.service.js';
import { getCodeReviewSummary } from './code-reviewer.service.js';

function statRow(label: string, value: string, noteHtml = ''): string {
  return `<tr>
    <td style="padding:8px 12px;color:#2D2D2D;font-size:14px;" colspan="2">${label}</td>
    <td style="padding:8px 12px;text-align:right;font-weight:600;color:#1A1A1A;font-size:14px;">${value} ${noteHtml}</td>
  </tr>`;
}

function sectionHeader(title: string): string {
  return `<tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">${title}</td></tr>`;
}

export async function runFounderBrief(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[FounderBrief] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const ago14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [metrics, aiQuality, revenue, newUsersThisWeek, newUsersPriorWeek, securitySummary, codeReviewSummary] = await Promise.all([
      getMetricsSnapshot(),
      getAiQualitySummary(),
      getRevenueSummary(),
      prisma.user.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.user.count({ where: { createdAt: { gte: ago14d, lt: ago7d } } }),
      getSecurityAuditSummary(),
      getCodeReviewSummary(),
    ]);

    const userGrowthPct = newUsersPriorWeek > 0
      ? Math.round(((newUsersThisWeek - newUsersPriorWeek) / newUsersPriorWeek) * 100)
      : null;

    const growthArrow = userGrowthPct != null
      ? userGrowthPct > 0
        ? `<span style="color:#10B981;font-size:12px;">▲ ${userGrowthPct}% WoW</span>`
        : userGrowthPct < 0
          ? `<span style="color:#EF4444;font-size:12px;">▼ ${Math.abs(userGrowthPct)}% WoW</span>`
          : `<span style="color:#6B7280;font-size:12px;">→ Flat</span>`
      : '';

    const highlights: string[] = [];
    const risks: string[] = [];

    if (newUsersThisWeek > 5) highlights.push(`${newUsersThisWeek} new users joined this week`);
    if (metrics.retention7d && metrics.retention7d > 20) highlights.push(`7-day retention at ${metrics.retention7d}% — strong retention signal`);
    if (revenue.estimatedMRR > 0) highlights.push(`MRR at $${revenue.estimatedMRR.toFixed(0)} with ${revenue.totalPaidUsers} paying subscribers`);
    if (revenue.newSubscriptions7d > 0) highlights.push(`${revenue.newSubscriptions7d} new subscriptions this week`);
    if (metrics.checksToday > 0) highlights.push(`${metrics.checksToday} outfit checks submitted today`);

    if (metrics.errorCount5xx > 10) risks.push(`${metrics.errorCount5xx} server errors — check Sentry`);
    if (aiQuality.fallbackRate !== null && aiQuality.fallbackRate > 10) risks.push(`AI fallback rate at ${aiQuality.fallbackRate}% — Gemini may be degraded`);
    if (revenue.cancellations7d > revenue.newSubscriptions7d) risks.push(`Churn (${revenue.cancellations7d}) outpacing new subs (${revenue.newSubscriptions7d}) this week`);
    if (metrics.dau === 0) risks.push(`Zero DAU today — verify the API is reachable`);
    if (metrics.pendingReportsOlderThan24h > 0) risks.push(`${metrics.pendingReportsOlderThan24h} content report(s) pending 24h+ review`);
    if (securitySummary && securitySummary.critical > 0) risks.push(`${securitySummary.critical} CRITICAL security finding(s) — check Security Auditor email`);
    if (securitySummary && securitySummary.high > 0) risks.push(`${securitySummary.high} high-severity security finding(s) need attention`);
    if (codeReviewSummary && codeReviewSummary.high > 0) risks.push(`${codeReviewSummary.high} high-severity code review finding(s) — check Code Reviewer email`);

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const highlightBlock = highlights.length > 0 ? `
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;color:#10B981;margin-bottom:8px;">✅ This Week's Highlights</div>
        ${highlights.map(h => `<div style="font-size:13px;color:#1A1A1A;margin-bottom:4px;">• ${h}</div>`).join('')}
      </div>
    ` : '';

    const riskBlock = risks.length > 0 ? `
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;color:#EF4444;margin-bottom:8px;">⚠️ Risks to Address</div>
        ${risks.map(r => `<div style="font-size:13px;color:#1A1A1A;margin-bottom:4px;">• ${r}</div>`).join('')}
      </div>
    ` : '';

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
      <div style="max-width:650px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Weekly Founder Brief</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:8px;">${dateStr}</div>
        </div>
        <div style="padding:32px 40px;">
          ${highlightBlock}
          ${riskBlock}

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="background:#F5EDE7;">
              <th colspan="2" style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;">Metric</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;">Value</th>
            </tr>

            ${sectionHeader('Users')}
            ${statRow('Total Users', metrics.totalUsers.toLocaleString())}
            ${statRow('New This Week', newUsersThisWeek.toString(), growthArrow)}
            ${statRow('DAU', metrics.dau.toString())}
            ${statRow('WAU', metrics.wau.toString())}
            ${statRow('7-Day Retention', metrics.retention7d != null ? metrics.retention7d + '%' : '—')}

            ${sectionHeader('Revenue')}
            ${statRow('Est. MRR', `$${revenue.estimatedMRR.toFixed(0)}`)}
            ${statRow('Paid Subscribers', `${revenue.plusUsers} Plus + ${revenue.proUsers} Pro`)}
            ${statRow('New Subs (7d)', `+${revenue.newSubscriptions7d}`)}
            ${statRow('Cancellations (7d)', `-${revenue.cancellations7d}`)}
            ${statRow('Trial→Paid Conv.', revenue.trialToPaidConversion != null ? revenue.trialToPaidConversion + '%' : '—')}

            ${sectionHeader('Product & AI')}
            ${statRow('Outfit Checks Today', metrics.checksToday.toString())}
            ${statRow('AI Fallback Rate', aiQuality.fallbackRate != null ? aiQuality.fallbackRate + '%' : 'N/A')}
            ${statRow('Avg AI Rating', aiQuality.avgFeedbackRating != null ? aiQuality.avgFeedbackRating.toFixed(1) + '/5' : 'N/A')}
            ${statRow('Est. AI Cost (30d)', `$${revenue.estimatedGeminiCost.toFixed(2)}`)}

            ${sectionHeader('Operations')}
            ${statRow('5xx Errors', metrics.errorCount5xx.toString())}
            ${statRow('Pending Reports 24h+', metrics.pendingReportsOlderThan24h.toString())}
            ${statRow('Expert Reviews Pending', metrics.expertReviewsPending.toString())}

            ${sectionHeader('Security')}
            ${statRow('Security Findings', securitySummary ? `${securitySummary.total} total` : 'N/A', securitySummary && securitySummary.critical > 0 ? `<span style="color:#EF4444;font-size:12px;">🔴 ${securitySummary.critical} critical</span>` : '')}
            ${statRow('Critical Issues', securitySummary ? securitySummary.critical.toString() : '—')}
            ${statRow('High Issues', securitySummary ? securitySummary.high.toString() : '—')}

            ${sectionHeader('Code Health')}
            ${statRow('Code Review Findings', codeReviewSummary ? `${codeReviewSummary.total} total` : 'N/A', codeReviewSummary && codeReviewSummary.high > 0 ? `<span style="color:#EF4444;font-size:12px;">🔴 ${codeReviewSummary.high} high</span>` : '')}
          </table>
        </div>
        <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
          <div style="font-size:12px;color:#6B7280;">Or This? · Weekly Founder Brief · ${new Date().toISOString()}</div>
        </div>
      </div>
    </body></html>`;

    const from = process.env.REPORT_FROM_EMAIL || 'metrics@orthis.app';
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Weekly Brief — ${metrics.totalUsers.toLocaleString()} users, $${revenue.estimatedMRR.toFixed(0)} MRR`,
      html,
    });

    console.log('✅ [FounderBrief] Sent weekly founder brief');
  } catch (err) {
    console.error('[FounderBrief] Failed:', err);
  }
}
