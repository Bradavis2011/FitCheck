import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { getMetricsSnapshot } from './metrics.service.js';
import { getAiQualitySummary } from './ai-quality-monitor.service.js';
import { getRevenueSummary } from './revenue-cost.service.js';
import { getSecurityAuditSummary } from './security-auditor.service.js';
import { getCodeReviewSummary } from './code-reviewer.service.js';
import { getAsoSummary } from './aso-intelligence.service.js';
import { getLatestBusEntry } from './intelligence-bus.service.js';
import { getUptimeSummary } from './uptime-monitor.service.js';
import { getInfraSummary } from './infra-monitor.service.js';
import { getE2eSummary } from './e2e-test.service.js';
import { getChurnSummary } from './churn-prediction.service.js';
import { getSupportSummary } from './support-bot.service.js';

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

    const [metrics, aiQuality, revenue, newUsersThisWeek, newUsersPriorWeek, securitySummary, codeReviewSummary, asoSummary, attributionEntry, uptimeSummary, infraSummary, e2eSummary, churnSummary, supportSummary, qualityAlertEntry, competitiveEntry, orchestratorEntry, creatorScoutEntry, growthInternEntry, productFeedbackEntry] = await Promise.all([
      getMetricsSnapshot(),
      getAiQualitySummary(),
      getRevenueSummary(),
      prisma.user.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.user.count({ where: { createdAt: { gte: ago14d, lt: ago7d } } }),
      getSecurityAuditSummary(),
      getCodeReviewSummary(),
      getAsoSummary(),
      getLatestBusEntry('attribution_metrics'),
      getUptimeSummary(),
      getInfraSummary(),
      getE2eSummary(),
      getChurnSummary(),
      getSupportSummary(),
      getLatestBusEntry('quality_alert'),
      getLatestBusEntry('competitive_intel'),
      getLatestBusEntry('orchestrator_run'),
      getLatestBusEntry('creator_scout_metrics'),
      getLatestBusEntry('growth_intern_metrics'),
      getLatestBusEntry('product_feedback'),
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
    if (uptimeSummary.failureCount > 0) risks.push(`Uptime monitor: ${uptimeSummary.failureCount} health check failures today`);
    if (infraSummary.heapUsedPct > 0.80) risks.push(`Memory at ${Math.round(infraSummary.heapUsedPct * 100)}% — potential memory leak`);
    if (e2eSummary && !e2eSummary.lastRunPassed) risks.push(`E2E tests failing: ${e2eSummary.failureCount} endpoint(s) down`);
    if (churnSummary.highRiskCount > 0) risks.push(`${churnSummary.highRiskCount} paid user(s) at high churn risk — retention emails triggered`);
    if (supportSummary.escalated7d > 0) risks.push(`${supportSummary.escalated7d} support ticket(s) escalated this week`);

    // Quality alert from AI quality monitor
    const qaPayload = qualityAlertEntry?.payload as Record<string, unknown> | null;
    if (qaPayload?.alerts && Array.isArray(qaPayload.alerts) && qaPayload.alerts.length > 0) {
      risks.push(`AI quality alert: ${(qaPayload.alerts as string[]).slice(0, 2).join('; ')}`);
    }

    // Orchestrator FQI trend
    const orchPayload = orchestratorEntry?.payload as Record<string, unknown> | null;
    if (orchPayload) {
      const fqiAfter = orchPayload.fqiAfter as number | null;
      const delta = orchPayload.fqiDelta as number | null;
      if (fqiAfter !== null && fqiAfter !== undefined) {
        const sign = delta !== null && delta >= 0 ? '+' : '';
        highlights.push(`Learning system FQI: ${fqiAfter.toFixed(4)} (${sign}${(delta ?? 0).toFixed(4)}) — ${orchPayload.multiLoopCount ?? 0} overnight mutations`);
      }
    }

    // Competitive intel highlight
    const compPayload = competitiveEntry?.payload as Record<string, unknown> | null;
    if (compPayload?.summary && typeof compPayload.summary === 'string') {
      highlights.push(`Competitive intel: ${compPayload.summary.slice(0, 120)}`);
    }

    // Creator scout metrics
    const scoutPayload = creatorScoutEntry?.payload as Record<string, unknown> | null;
    if (scoutPayload?.totalSaved && (scoutPayload.totalSaved as number) > 0) {
      highlights.push(`Creator scout: ${scoutPayload.totalSaved} new prospects found (${scoutPayload.emailTrackCount ?? 0} email-track, ${scoutPayload.dmTrackCount ?? 0} DM-track)`);
    }

    // Product feedback themes
    const pfPayload = productFeedbackEntry?.payload as Record<string, unknown> | null;
    const pfThemes = pfPayload?.themes;
    if (pfPayload && pfPayload.criticalBugsCount && (pfPayload.criticalBugsCount as number) > 0) {
      risks.push(`Product feedback: ${pfPayload.criticalBugsCount} critical bug report(s) from user feedback analysis`);
    } else if (pfThemes && Array.isArray(pfThemes) && pfThemes.length > 0) {
      highlights.push(`Product feedback themes: ${(pfThemes as string[]).slice(0, 2).join(', ')}`);
    }

    // Growth intern metrics
    const giPayload = growthInternEntry?.payload as Record<string, unknown> | null;
    if (giPayload?.summary && typeof giPayload.summary === 'string') {
      highlights.push(`Growth intel: ${giPayload.summary.slice(0, 100)}`);
    }

    // ASO keyword alerts
    if (asoSummary) {
      const droppedKeywords = asoSummary.biggestMovers.filter(m => m.change > 5);
      const improvedKeywords = asoSummary.biggestMovers.filter(m => m.change < -3);
      if (droppedKeywords.length > 0) {
        risks.push(`ASO: "${droppedKeywords[0].keyword}" dropped ${droppedKeywords[0].change} positions on ${droppedKeywords[0].store === 'google' ? 'Play' : 'iOS'} — consider content push`);
      }
      if (improvedKeywords.length > 0) {
        highlights.push(`ASO: "${improvedKeywords[0].keyword}" improved ${Math.abs(improvedKeywords[0].change)} positions — keyword gaining traction`);
      }
    }

    // Attribution highlights
    const attrPayload = attributionEntry?.payload as Record<string, unknown> | null;
    if (attrPayload) {
      const bySource = attrPayload.bySource as Array<{ source: string; count: number }> | undefined;
      if (bySource && bySource.length > 0) {
        const topSource = bySource[0];
        if (topSource.count > 0) {
          highlights.push(`Attribution: ${topSource.count} new user(s) came from ${topSource.source} this week`);
        }
      }
    }

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
            ${statRow('Uptime Failures (today)', uptimeSummary.failureCount.toString(), uptimeSummary.failureCount > 0 ? '<span style="color:#EF4444;font-size:12px;">⚠️</span>' : '')}
            ${statRow('Heap Usage', `${Math.round(infraSummary.heapUsedPct * 100)}%`, infraSummary.heapUsedPct > 0.80 ? '<span style="color:#F59E0B;font-size:12px;">⚠️ high</span>' : '')}
            ${e2eSummary ? statRow('E2E Tests', e2eSummary.lastRunPassed ? '✅ Passing' : `❌ ${e2eSummary.failureCount} failing`) : ''}

            ${sectionHeader('Retention & Support')}
            ${statRow('High Churn Risk (paid)', churnSummary.highRiskCount.toString(), churnSummary.highRiskCount > 0 ? '<span style="color:#F59E0B;font-size:12px;">⚠️</span>' : '')}
            ${statRow('Support Tickets Open', supportSummary.openTickets.toString())}
            ${statRow('Escalated (7d)', supportSummary.escalated7d.toString(), supportSummary.escalated7d > 0 ? '<span style="color:#EF4444;font-size:12px;">needs attention</span>' : '')}

            ${sectionHeader('Security')}
            ${statRow('Security Findings', securitySummary ? `${securitySummary.total} total` : 'N/A', securitySummary && securitySummary.critical > 0 ? `<span style="color:#EF4444;font-size:12px;">🔴 ${securitySummary.critical} critical</span>` : '')}
            ${statRow('Critical Issues', securitySummary ? securitySummary.critical.toString() : '—')}
            ${statRow('High Issues', securitySummary ? securitySummary.high.toString() : '—')}

            ${sectionHeader('Code Health')}
            ${statRow('Code Review Findings', codeReviewSummary ? `${codeReviewSummary.total} total` : 'N/A', codeReviewSummary && codeReviewSummary.high > 0 ? `<span style="color:#EF4444;font-size:12px;">🔴 ${codeReviewSummary.high} high</span>` : '')}

            ${asoSummary ? `
            ${sectionHeader('ASO — Keyword Rankings')}
            ${asoSummary.topKeywords.slice(0, 3).map((kw, i) => {
              const data = asoSummary.keywords.find(k => k.keyword === kw && k.store === 'apple') ||
                           asoSummary.keywords.find(k => k.keyword === kw);
              return statRow(`#${i + 1}: ${kw}`, data ? `traffic ${data.traffic.toFixed(0)}, difficulty ${data.difficulty.toFixed(0)}` : '—');
            }).join('')}
            ${asoSummary.biggestMovers.length > 0 ? statRow('Biggest Mover', `${asoSummary.biggestMovers[0].keyword}`, asoSummary.biggestMovers[0].change < 0 ? `<span style="color:#10B981;font-size:12px;">▲ improved</span>` : `<span style="color:#EF4444;font-size:12px;">▼ dropped</span>`) : ''}
            ${asoSummary.competitors.length > 0 ? statRow('Competitors Tracked', `${asoSummary.competitors.length} apps`) : ''}
            ` : ''}

            ${attrPayload ? `
            ${sectionHeader('Attribution — Where Users Came From (7d)')}
            ${(attrPayload.bySource as Array<{ source: string; count: number }> || []).slice(0, 4).map(s =>
              statRow(s.source || 'unknown', `${s.count} signup(s)`)
            ).join('')}
            ${statRow('Total Attributed', `${(attrPayload.totalAttributed as number) || 0}`)}
            ` : ''}

            ${orchPayload ? `
            ${sectionHeader('System Intelligence — Overnight Learning')}
            ${statRow('FQI After', orchPayload.fqiAfter != null ? (orchPayload.fqiAfter as number).toFixed(4) : '—', orchPayload.fqiDelta != null ? `<span style="color:${(orchPayload.fqiDelta as number) >= 0 ? '#10B981' : '#EF4444'};font-size:12px;">${(orchPayload.fqiDelta as number) >= 0 ? '▲' : '▼'} ${Math.abs(orchPayload.fqiDelta as number).toFixed(4)}</span>` : '')}
            ${statRow('Overnight Mutations', `${orchPayload.multiLoopCount ?? 0}`)}
            ${orchPayload.emergencyRevert ? statRow('Emergency Revert', '⚠️ triggered', '<span style="color:#EF4444;font-size:12px;">candidate reverted</span>') : ''}
            ` : ''}

            ${pfPayload && pfThemes && Array.isArray(pfThemes) && pfThemes.length > 0 ? `
            ${sectionHeader('Product Feedback — User Themes')}
            ${(pfThemes as string[]).slice(0, 4).map((t, i) => statRow(`Theme ${i + 1}`, String(t).slice(0, 60))).join('')}
            ${statRow('Sentiment', pfPayload.sentiment ? String(pfPayload.sentiment) : '—')}
            ` : ''}
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
