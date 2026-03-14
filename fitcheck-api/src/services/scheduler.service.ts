import cron from 'node-cron';
import { runSecurityAudit } from './security-auditor.service.js';
import { runCodeReview } from './code-reviewer.service.js';
import { runAsoIntelligence } from './aso-intelligence.service.js';
import { sendDailyDigest, sendWeeklyDigest } from './email-report.service.js';
import { resetWeeklyPoints, resetMonthlyPoints } from './gamification.service.js';
import { prisma } from '../utils/prisma.js';
import { Resend } from 'resend';
import { runEngagementNudger, measureNudgeMetrics, computePreferredNudgeHours, runPersonalizedNudge, runWeatherAwareNudge, runWardrobeSuggestionNudge, runTrendMatchedNudge } from './nudge.service.js';
import { runOpsLearning, pollTwitterEngagement } from './ops-learning.service.js';
// content-calendar runContentCalendar replaced by sendWeeklySocialDigest — getTrendData still used by other services
import { runGrowthDashboard } from './growth-dashboard.service.js';
import { runBetaRecruiter } from './beta-recruiter.service.js';
import { runViralMonitor } from './viral-monitor.service.js';
import { runAiQualityMonitor } from './ai-quality-monitor.service.js';
import { runRevenueCostTracker } from './revenue-cost.service.js';
import { runFounderBrief } from './founder-brief.service.js';
// ── Autonomous Operator Agents (Phase 2-4) ────────────────────────────────────
import { processApprovedActions, isAgentEnabled, recordAgentRun } from './agent-manager.service.js';
import { runLifecycleEmail } from './lifecycle-email.service.js';
import { runConversionIntelligence } from './conversion-intelligence.service.js';
import { runCommunityManagerDaily, runCommunityManagerWeekly } from './community-manager.service.js';
import { runSocialMediaManager, sendWeeklySocialDigest, registerExecutors as registerSocialExecutors } from './social-media-manager.service.js';
import { runAppStoreManager, runAppStoreWeeklySummary, registerExecutors as registerAppstoreExecutors } from './appstore-manager.service.js';
import { runCreatorHookDistribution, runCreatorPerformanceDigest, registerCreatorExecutors, updateCreatorInstallCounts } from './creator-manager.service.js';
import { runCreatorScout } from './creator-scout.service.js';
import { runEmailOutreach, runEmailFollowUp, runCreatorOnboardingFollowUps } from './creator-outreach.service.js';
import { runRedditDiscovery, runRedditAutoPost } from './reddit-scout.service.js';
import { runSubredditManager, registerExecutors as registerSubredditExecutors } from './subreddit-manager.service.js';
import { runMorningBrief, runStaleProspectCleanup } from './growth-intern.service.js';
import { runLearningContentAgent, generateStyleTips } from './learning-content.service.js';
import { sendFounderContentDigest, sendDailyScriptEmail } from './founder-content-digest.service.js';
import { runFashionTrendCron } from './fashion-trends.service.js';
import { runUptimeCheck, trackDailyUptime } from './uptime-monitor.service.js';
import { retryFailedDeletions } from './data-deletion.service.js';
import { runChurnPrediction } from './churn-prediction.service.js';
import { measureAffiliateMetrics, computeUserAffiliatePreferences } from './affiliate.service.js';
import { runFashionEventDiscovery, runFashionEventNudge } from './fashion-events.service.js';
import { runFeedbackAnalyst } from './feedback-analyst.service.js';
import { runSeoContentAgent, generateRushContentBlitz, refreshRushContent } from './seo-content.service.js';
import { runSeoIntelligence, trackKeywordPositions } from './seo-intelligence.service.js';
import { runInfraMonitor } from './infra-monitor.service.js';
import { runOnboardingOptimizer } from './onboarding-optimizer.service.js';
import { runCompetitiveIntel } from './competitive-intel.service.js';
import { runE2eTests } from './e2e-test.service.js';
import { runCalibrationSnapshot } from './calibration-snapshot.service.js';
import { runEventFollowUp, runFollowUpEmailFallback, runPreEventReminder } from './event-followup.service.js';
import { runMilestoneScanner } from './milestone-message.service.js';
import { runStyleNarrativeAgent } from './style-narrative.service.js';
import { runWardrobePrescriptionAgent } from './wardrobe-prescription.service.js';
import { runCohortImprovementCycle } from './recursive-improvement.service.js';
// ── Self-Improving StyleDNA Engine ────────────────────────────────────────────
import { resetDailyBudget, hasLearningBudget } from './token-budget.service.js';
import { purgeExpiredBusEntries } from './intelligence-bus.service.js';
import { distillLearningMemory } from './prompt-assembly.service.js';
import { runPiggybackJudge, calibrateRegressionBaselines } from './arena.service.js';
import { runCriticAgent, runFollowUpCritic } from './critic-agent.service.js';
import {
  runSurgeonAgent,
  runSurgeonAgentEvening,
  runAdditionalMutations,
  runFollowUpSurgeon,
  runExampleRotation,
} from './surgeon-agent.service.js';
import { runOvernightPipeline, isOrchestratorEnabled } from './overnight-orchestrator.service.js';

function isEnabled(): boolean {
  return process.env.ENABLE_CRON === 'true';
}

function isNudgeEnabled(): boolean {
  return process.env.ENABLE_NUDGE !== 'false';
}

// Phase 3: Gate cold email outreach — default off until deliverability is proven
function isEmailOutreachEnabled(): boolean {
  return process.env.ENABLE_EMAIL_OUTREACH === 'true';
}

/** Run a cron handler with kill-switch check + observability recording. */
async function guardedRun(agentName: string, label: string, fn: () => Promise<unknown>): Promise<void> {
  if (!(await isAgentEnabled(agentName))) return;
  if (label) console.log(label);
  try {
    await fn();
    await recordAgentRun(agentName);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Scheduler] ${agentName} failed:`, err);
    await recordAgentRun(agentName, errMsg);
  }
}

// ─── Safety Monitor ─────────────────────────────────────────────────────────

const URGENT_KEYWORDS = ['nudity', 'nude', 'harassment', 'threat', 'rape', 'violence', 'explicit'];

async function runSafetyMonitor(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[SafetyMonitor] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';

  // Fetch all pending reports
  const pendingReports = await prisma.report.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (pendingReports.length === 0) return;

  // --- Auto-hide content with 3+ reports ---
  const reportCountByTarget = new Map<string, number>();
  for (const r of pendingReports) {
    const key = `${r.targetType}:${r.targetId}`;
    reportCountByTarget.set(key, (reportCountByTarget.get(key) || 0) + 1);
  }

  for (const [key, count] of reportCountByTarget) {
    if (count >= 3) {
      const [targetType, targetId] = key.split(':');
      if (targetType === 'outfit') {
        try {
          await prisma.outfitCheck.updateMany({
            where: { id: targetId, isDeleted: false },
            data: { isDeleted: true },
          });
          console.log(`[SafetyMonitor] Auto-hid outfit ${targetId} (${count} reports)`);
        } catch (err) {
          console.error(`[SafetyMonitor] Failed to auto-hide outfit ${targetId}:`, err);
        }
      }
    }
  }

  // --- Urgent keyword detection ---
  const urgentReports = pendingReports.filter(r => {
    const text = (r.details || r.reason || '').toLowerCase();
    return URGENT_KEYWORDS.some(kw => text.includes(kw));
  });

  if (urgentReports.length > 0) {
    try {
      await resend.emails.send({
        from,
        to: recipient,
        subject: `🚨 Or This? URGENT: ${urgentReports.length} flagged report(s) need immediate review`,
        html: buildUrgentReportEmail(urgentReports),
      });
      console.log(`[SafetyMonitor] Sent urgent report alert (${urgentReports.length} reports)`);
    } catch (err) {
      console.error('[SafetyMonitor] Failed to send urgent email:', err);
    }
  }

  // --- Digest for reports older than 6h ---
  const staleReports = pendingReports.filter(r => new Date(r.createdAt) < sixHoursAgo);
  if (staleReports.length > 0) {
    try {
      await resend.emails.send({
        from,
        to: recipient,
        subject: `Or This? Safety: ${staleReports.length} report(s) pending 6+ hours`,
        html: buildStaleReportEmail(staleReports),
      });
      console.log(`[SafetyMonitor] Sent stale report digest (${staleReports.length} reports)`);
    } catch (err) {
      console.error('[SafetyMonitor] Failed to send stale report digest:', err);
    }
  }
}

function buildUrgentReportEmail(reports: any[]): string {
  const rows = reports.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.targetType}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.targetId}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.reason}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.details || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${new Date(r.createdAt).toISOString()}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:2px solid #EF4444;">
      <h2 style="color:#EF4444;margin-top:0;">🚨 Urgent Reports Require Immediate Review</h2>
      <p style="color:#2D2D2D;">The following ${reports.length} report(s) contain urgent keywords and need immediate attention:</p>
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#F5EDE7;">
          <th style="padding:8px;text-align:left;font-size:12px;">Type</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Target ID</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Reason</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Details</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Reported At</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6B7280;font-size:12px;margin-top:24px;">Or This? · Safety Monitor · ${new Date().toISOString()}</p>
    </div>
  </body></html>`;
}

function buildStaleReportEmail(reports: any[]): string {
  const rows = reports.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.targetType}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.targetId}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${r.reason}</td>
      <td style="padding:8px;border-bottom:1px solid #F5EDE7;font-size:13px;">${Math.round((Date.now() - new Date(r.createdAt).getTime()) / (60 * 60 * 1000))}h ago</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
      <h2 style="color:#E85D4C;margin-top:0;">📋 Pending Reports Digest</h2>
      <p style="color:#2D2D2D;">${reports.length} report(s) have been pending for 6+ hours and need review:</p>
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#F5EDE7;">
          <th style="padding:8px;text-align:left;font-size:12px;">Type</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Target ID</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Reason</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Age</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6B7280;font-size:12px;margin-top:24px;">Or This? · Safety Monitor · ${new Date().toISOString()}</p>
    </div>
  </body></html>`;
}

// ─── Scheduler Init ───────────────────────────────────────────────────────────

export function initializeScheduler(): void {
  if (!isEnabled()) {
    console.log('⏭️  [Scheduler] ENABLE_CRON not set — skipping cron jobs');
    return;
  }

  // Register executors for high-risk agents so processApprovedActions works after restart
  registerSocialExecutors();
  registerAppstoreExecutors();
  registerCreatorExecutors();
  registerSubredditExecutors();

  console.log('⏰ [Scheduler] Initializing cron jobs...');

  // Daily 8am ET (UTC-5 in winter, UTC-4 in summer — use 13:00 UTC as safe default)
  // "0 13 * * *" = every day at 1pm UTC (8am ET winter / 9am ET summer)
  cron.schedule('0 13 * * *', async () => {
    console.log('📊 [Scheduler] Running daily digest...');
    try {
      await sendDailyDigest();
    } catch (err) {
      console.error('[Scheduler] Daily digest failed:', err);
    }
  }, { timezone: 'UTC' });

  // Weekly digest — Monday 8am ET (1pm UTC)
  cron.schedule('0 13 * * 1', async () => {
    console.log('📈 [Scheduler] Running weekly digest...');
    try {
      await sendWeeklyDigest();
    } catch (err) {
      console.error('[Scheduler] Weekly digest failed:', err);
    }
  }, { timezone: 'UTC' });

  // Weekly points reset — Sunday 11:59pm ET (Monday 4:59am UTC)
  cron.schedule('59 4 * * 1', async () => {
    console.log('🔄 [Scheduler] Resetting weekly points...');
    try {
      await resetWeeklyPoints();
    } catch (err) {
      console.error('[Scheduler] Weekly points reset failed:', err);
    }
  }, { timezone: 'UTC' });

  // Monthly points reset — 1st of month 12:01am ET (5:01am UTC)
  cron.schedule('1 5 1 * *', async () => {
    console.log('🔄 [Scheduler] Resetting monthly points...');
    try {
      await resetMonthlyPoints();
    } catch (err) {
      console.error('[Scheduler] Monthly points reset failed:', err);
    }
  }, { timezone: 'UTC' });

  // Daily expired outfit purge — 3am ET (8am UTC)
  cron.schedule('0 8 * * *', async () => {
    console.log('🗑️  [Scheduler] Purging expired outfits...');
    try {
      const result = await prisma.outfitCheck.updateMany({
        where: {
          expiresAt: { lte: new Date() },
          isDeleted: false,
        },
        data: { isDeleted: true },
      });
      if (result.count > 0) {
        console.log(`✅ [Scheduler] Soft-deleted ${result.count} expired outfit(s)`);
      }
    } catch (err) {
      console.error('[Scheduler] Expired outfit purge failed:', err);
    }
  }, { timezone: 'UTC' });

  // Challenge status auto-transition — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const [activated, ended] = await Promise.all([
        prisma.challenge.updateMany({
          where: { status: 'upcoming', startsAt: { lte: now } },
          data: { status: 'active' },
        }),
        prisma.challenge.updateMany({
          where: { status: 'active', endsAt: { lte: now } },
          data: { status: 'ended' },
        }),
      ]);
      if (activated.count > 0 || ended.count > 0) {
        console.log(`✅ [Scheduler] Challenge transitions: ${activated.count} activated, ${ended.count} ended`);
      }
    } catch (err) {
      console.error('[Scheduler] Challenge transition failed:', err);
    }
  }, { timezone: 'UTC' });

  // Community Safety Monitor — every hour (Agent 8)
  cron.schedule('0 * * * *', async () => {
    console.log('🛡️  [Scheduler] Running community safety monitor...');
    try {
      await runSafetyMonitor();
    } catch (err) {
      console.error('[Scheduler] Safety monitor failed:', err);
    }
  }, { timezone: 'UTC' });

  // Engagement Nudger — 2pm UTC (morning run) + 10pm UTC (evening/streak run) (Agent 9)
  if (isNudgeEnabled()) {
    cron.schedule('0 14 * * *', () =>
      guardedRun('nudge', '💬 [Scheduler] Running engagement nudger (morning)...', () => runEngagementNudger(false)),
    { timezone: 'UTC' });

    cron.schedule('0 22 * * *', () =>
      guardedRun('nudge', '💬 [Scheduler] Running engagement nudger (evening/streak)...', () => runEngagementNudger(true)),
    { timezone: 'UTC' });
  } else {
    console.log('⏭️  [Scheduler] ENABLE_NUDGE=false — skipping engagement nudger');
  }

  // ── Fashion Trend Intelligence — Monday 7am UTC (before content calendar) ──
  cron.schedule('0 7 * * 1', () =>
    guardedRun('fashion-trends', '👗 [Scheduler] Running fashion trend cron...', runFashionTrendCron),
  { timezone: 'UTC' });

  // ── Calibration Snapshot — Sunday 9pm UTC ────────────────────────────────
  cron.schedule('0 21 * * 0', () =>
    guardedRun('calibration-snapshot', '📐 [Scheduler] Running calibration snapshot...', runCalibrationSnapshot),
  { timezone: 'UTC' });

  // ── Daily Social Digest — 8am UTC ─────────────────────────────────────────
  // Daily digest of ready-to-copy social posts.
  // getTrendData() (from content-calendar) is still used by other services (SEO, social engine).
  cron.schedule('0 8 * * *', () =>
    guardedRun('social-media-manager', '📱 [Scheduler] Sending daily social digest...', sendWeeklySocialDigest),
  { timezone: 'UTC' });

  // ── Agent 11: Growth Dashboard — Daily 9am UTC ───────────────────────────
  cron.schedule('0 9 * * *', () =>
    guardedRun('growth-dashboard', '📈 [Scheduler] Running growth dashboard...', runGrowthDashboard),
  { timezone: 'UTC' });

  // ── Growth Intern: Creator Scout — Daily 10am UTC (was Tue/Thu/Sat) ──
  // Running daily with 25-query batches across 100+ query pool for 200+ prospects/week target.
  cron.schedule('0 10 * * *', () =>
    guardedRun('creator-scout', '🔍 [Scheduler] Running creator scout...', runCreatorScout),
  { timezone: 'UTC' });

  // ── Growth Intern: Email Outreach — Daily 1pm UTC (gated by ENABLE_EMAIL_OUTREACH) ───
  cron.schedule('5 13 * * *', () => {
    if (!isEmailOutreachEnabled()) {
      console.log('[Scheduler] Email outreach skipped — ENABLE_EMAIL_OUTREACH not set');
      return;
    }
    return guardedRun('creator-outreach', '', runEmailOutreach);
  }, { timezone: 'UTC' });

  // ── Growth Intern: Email Follow-up — Daily 2pm UTC ───────────────────
  cron.schedule('5 14 * * *', () =>
    guardedRun('email-follow-up', '', runEmailFollowUp),
  { timezone: 'UTC' });

  // ── Growth Intern: Creator Onboarding Follow-ups — Daily 3pm UTC ──────
  // Sends Email 2 (+24h) and Email 3 (+72h) to onboarded prospects.
  cron.schedule('5 15 * * *', () =>
    guardedRun('creator-outreach', '', runCreatorOnboardingFollowUps),
  { timezone: 'UTC' });

  // ── Growth Intern: Reddit Discovery — Daily 11am UTC ─────────────────
  cron.schedule('5 11 * * *', () =>
    guardedRun('reddit-scout', '🤝 [Scheduler] Running Reddit discovery...', runRedditDiscovery),
  { timezone: 'UTC' });

  // ── Subreddit Manager — Daily 2pm UTC ────────────────────────────────────
  // Posts 7 rotating content types daily to r/OrThis (data-grounded).
  cron.schedule('0 14 * * *', () =>
    guardedRun('subreddit-manager', '[Scheduler] Running subreddit manager...', runSubredditManager),
  { timezone: 'UTC' });

  // ── Reddit Auto-Post — Daily 12:30pm UTC (after discovery at 11am) ───────
  cron.schedule('30 12 * * *', () =>
    guardedRun('reddit-scout', '📮 [Scheduler] Running Reddit auto-post...', runRedditAutoPost),
  { timezone: 'UTC' });

  // ── Growth Intern: Morning Brief — Daily 12pm UTC (8am ET) ───────────
  cron.schedule('0 12 * * *', () =>
    guardedRun('growth-intern', '🌅 [Scheduler] Running morning brief...', runMorningBrief),
  { timezone: 'UTC' });

  // ── Growth Intern: Stale Prospect Cleanup — Daily 3am UTC ────────────
  cron.schedule('5 3 * * *', () =>
    guardedRun('growth-intern', '', runStaleProspectCleanup),
  { timezone: 'UTC' });

  // ── Agent 12: Beta Recruiter — Wednesday 10am UTC ─────────────────────────
  cron.schedule('0 10 * * 3', () =>
    guardedRun('beta-recruiter', '🌟 [Scheduler] Running beta recruiter...', runBetaRecruiter),
  { timezone: 'UTC' });

  // ── Agent 13: Viral Loop Monitor — Friday 9am UTC ────────────────────────
  cron.schedule('0 9 * * 5', () =>
    guardedRun('viral-monitor', '🔁 [Scheduler] Running viral loop monitor...', runViralMonitor),
  { timezone: 'UTC' });

  // ── Agent 14: AI Quality Monitor — Daily 1:30pm UTC ─────────────────────
  cron.schedule('30 13 * * *', () =>
    guardedRun('ai-quality-monitor', '🤖 [Scheduler] Running AI quality monitor...', runAiQualityMonitor),
  { timezone: 'UTC' });

  // ── Agent 15: Revenue & Cost Tracker — Monday 9am UTC ───────────────────
  cron.schedule('0 9 * * 1', () =>
    guardedRun('revenue-cost', '💰 [Scheduler] Running revenue & cost tracker...', runRevenueCostTracker),
  { timezone: 'UTC' });

  // ── Agent 16: Weekly Founder Brief — Sunday 8pm UTC ─────────────────────
  cron.schedule('0 20 * * 0', () =>
    guardedRun('founder-brief', '📋 [Scheduler] Running weekly founder brief...', runFounderBrief),
  { timezone: 'UTC' });

  // ── Agent Manager: Process approved actions — every 5 min ─────────────────
  cron.schedule('*/5 * * * *', async () => {
    try { await processApprovedActions(); }
    catch (err) { console.error('[Scheduler] processApprovedActions failed:', err); }
  }, { timezone: 'UTC' });

  // ── Lifecycle Email: Process due email sequences — every 30 min ───────────
  cron.schedule('*/30 * * * *', () =>
    guardedRun('lifecycle-email', '📧 [Scheduler] Running lifecycle email...', runLifecycleEmail),
  { timezone: 'UTC' });

  // ── Conversion Intelligence: Scan for signals — Daily 11am UTC ───────────
  cron.schedule('0 11 * * *', () =>
    guardedRun('conversion-intelligence', '📊 [Scheduler] Running conversion intelligence...', runConversionIntelligence),
  { timezone: 'UTC' });

  // ── Community Manager: Daily highlights — Daily 10am UTC ─────────────────
  cron.schedule('0 10 * * *', () =>
    guardedRun('community-manager', '🌟 [Scheduler] Running community manager (daily)...', runCommunityManagerDaily),
  { timezone: 'UTC' });

  // ── Community Manager: Weekly challenge — Monday 9:30am UTC ─────────────────
  cron.schedule('30 9 * * 1', () =>
    guardedRun('community-manager', '🏆 [Scheduler] Running community manager (weekly challenge)...', runCommunityManagerWeekly),
  { timezone: 'UTC' });

  // ── Social Media Manager: Content engine — Daily 8:30am UTC ─────────────────
  // 7-day rotation across all 7 generators × 3 per day ≈ 21 posts/week
  cron.schedule('30 8 * * *', () =>
    guardedRun('social-media-manager', '📱 [Scheduler] Running social media manager...', () => runSocialMediaManager()),
  { timezone: 'UTC' });

  // ── App Store Manager: Fetch + respond to reviews — Daily 2:15pm UTC ────────
  cron.schedule('15 14 * * *', () =>
    guardedRun('appstore-manager', '⭐ [Scheduler] Running app store manager...', runAppStoreManager),
  { timezone: 'UTC' });

  // ── App Store Manager: Weekly review summary — Sunday 7pm UTC ────────────
  cron.schedule('0 19 * * 0', () =>
    guardedRun('appstore-manager', '📊 [Scheduler] Running app store weekly summary...', runAppStoreWeeklySummary),
  { timezone: 'UTC' });

  // ── A1: Compute preferred nudge hours — Daily 4:30am UTC (before Surgeon at 5am) ──
  if (isNudgeEnabled()) {
    cron.schedule('30 4 * * *', () =>
      guardedRun('nudge', '', computePreferredNudgeHours),
    { timezone: 'UTC' });

    // A1: Personalized nudge — every hour, sends to users whose preferred hour matches now
    cron.schedule('0 * * * *', () =>
      guardedRun('nudge', '', async () => {
        const hour = new Date().getUTCHours();
        await runPersonalizedNudge(hour);
      }),
    { timezone: 'UTC' });
  }

  // ── Content Factory — Daily 5 production scripts (6am UTC) ─────────────────
  // Generates 2× series_episode, 1× data_drop, 1× trend_take, 1× style_tip
  // Also generates weekly trend report on Tuesdays
  cron.schedule('0 6 * * *', () =>
    guardedRun('content-factory', '🎬 [Scheduler] Running content factory...', runLearningContentAgent),
  { timezone: 'UTC' });

  // ── Daily Script Email — 6:15am UTC (15 min after generation) ───────────────
  cron.schedule('15 6 * * *', () =>
    guardedRun('content-factory', '📧 [Scheduler] Sending daily script email...', sendDailyScriptEmail),
  { timezone: 'UTC' });

  // ── Ops Learning Loop — Daily Measurers (6am UTC, DB only, $0) ──────────────
  cron.schedule('0 6 * * *', () =>
    guardedRun('nudge', '📊 [Scheduler] Running ops learning measurers...', measureNudgeMetrics),
  { timezone: 'UTC' });

  // ── Ops Learning Loop — Twitter Engagement Poll (6:30am UTC) ─────────────────
  cron.schedule('30 6 * * *', () =>
    guardedRun('ops-learning', '', pollTwitterEngagement),
  { timezone: 'UTC' });

  // ── Ops Learning Agent — Weekly Cycle (Sunday 7am UTC) ───────────────────────
  cron.schedule('0 7 * * 0', () =>
    guardedRun('ops-learning', '🧠 [Scheduler] Running Ops Learning Agent...', runOpsLearning),
  { timezone: 'UTC' });

  // ── Relationship System ───────────────────────────────────────────────────────

  // Post-event follow-up: every 30 minutes
  cron.schedule('*/30 * * * *', () =>
    guardedRun('event-followup', '', runEventFollowUp),
  { timezone: 'UTC' });

  // Pre-event reminder: every 30 minutes (only fires in 6-11pm UTC window)
  cron.schedule('*/30 * * * *', () =>
    guardedRun('pre-event-reminder', '', runPreEventReminder),
  { timezone: 'UTC' });

  // Follow-up email fallback: every 6 hours
  cron.schedule('0 */6 * * *', () =>
    guardedRun('event-followup', '📧 [Scheduler] Running follow-up email fallback...', runFollowUpEmailFallback),
  { timezone: 'UTC' });

  // ── Proactive Plus Outreach (weather, wardrobe, trends) ──────────────────────

  // Weather-aware morning nudge: daily 7am UTC (Plus/Pro only)
  cron.schedule('0 7 * * *', () =>
    guardedRun('weather-nudge', '🌤️ [Scheduler] Running weather-aware nudge...', runWeatherAwareNudge),
  { timezone: 'UTC' });

  // Wardrobe suggestion nudge: daily 8am UTC (Plus/Pro only)
  cron.schedule('0 8 * * *', () =>
    guardedRun('wardrobe-nudge', '👗 [Scheduler] Running wardrobe suggestion nudge...', runWardrobeSuggestionNudge),
  { timezone: 'UTC' });

  // Trend-matched nudge: Fridays at 9am UTC (Plus/Pro only)
  cron.schedule('0 9 * * 5', () =>
    guardedRun('trend-nudge', '✨ [Scheduler] Running trend-matched nudge...', runTrendMatchedNudge),
  { timezone: 'UTC' });

  // Milestone scanner: daily 3pm UTC
  cron.schedule('0 15 * * *', () =>
    guardedRun('milestone-scanner', '🏆 [Scheduler] Running milestone scanner...', runMilestoneScanner),
  { timezone: 'UTC' });

  // Style narrative agent: Sunday 5pm UTC
  cron.schedule('0 17 * * 0', () =>
    guardedRun('style-narrative', '✍️  [Scheduler] Running style narrative agent...', runStyleNarrativeAgent),
  { timezone: 'UTC' });

  // Wardrobe Prescription: Wednesday 11am UTC (Plus/Pro, weekly agentic affiliate picks)
  cron.schedule('0 11 * * 3', () =>
    guardedRun('wardrobe-prescription', '🛍️ [Scheduler] Running wardrobe prescription agent...', runWardrobePrescriptionAgent),
  { timezone: 'UTC' });

  // NOTE: checkAndTriggerImprovement (whole-prompt rewrite) disabled — section-level
  // Critic → Surgeon → Arena system is the primary improvement engine (runs at 5am).
  // Keeping runCohortImprovementCycle and rule discovery separate below.

  // ── C1+C2: StyleDNA Cohort Improvement — Monthly (Wed 6am UTC, days 1-7) ──
  cron.schedule('0 6 1-7 * 3', () =>
    guardedRun('surgeon', '🎯 [Scheduler] Running StyleDNA cohort improvement cycle...', runCohortImprovementCycle),
  { timezone: 'UTC' });

  // ── Self-Improving StyleDNA Engine ───────────────────────────────────────────

  if (process.env.ENABLE_LEARNING_SYSTEM !== 'false') {
    if (isOrchestratorEnabled()) {
      // ── Orchestrator mode: one midnight cron replaces 6 individual overnight crons ──
      // Budget Reset, Bus Purge, Piggyback, Learning Memory, Critic, Surgeon
      // are all managed internally by the orchestrator DAG with retry + multi-loop.
      cron.schedule('0 0 * * *', async () => {
        console.log('[Scheduler] Starting Overnight Orchestrator...');
        try { await runOvernightPipeline(); }
        catch (err) { console.error('[Scheduler] Overnight Orchestrator failed:', err); }
      }, { timezone: 'UTC' });

      // Daytime learning agents remain as independent crons (not part of the overnight DAG)
      // 3pm UTC: Follow-Up Critic (P2 budget-gated)
      cron.schedule('0 15 * * *', () =>
        guardedRun('followup-critic', '🔬 [Scheduler] Running Follow-Up Critic...', async () => {
          if (!(await hasLearningBudget(2))) return;
          await runFollowUpCritic();
        }),
      { timezone: 'UTC' });

      // 5pm UTC: Follow-Up Surgeon (P3 budget-gated)
      cron.schedule('0 17 * * *', () =>
        guardedRun('followup-surgeon', '⚕️  [Scheduler] Running Follow-Up Surgeon...', async () => {
          if (!(await hasLearningBudget(3))) return;
          await runFollowUpSurgeon();
        }),
      { timezone: 'UTC' });

      // 7pm UTC: 2nd-pass Surgeon (P3 budget-gated)
      cron.schedule('0 19 * * *', () =>
        guardedRun('surgeon', '⚕️  [Scheduler] Running 2nd-pass Surgeon...', async () => {
          if (!(await hasLearningBudget(3))) return;
          await runSurgeonAgentEvening();
        }),
      { timezone: 'UTC' });

      // 9pm UTC: Additional proactive mutations (P4 budget-gated)
      cron.schedule('0 21 * * *', () =>
        guardedRun('surgeon', '⚕️  [Scheduler] Running additional mutations (P4)...', async () => {
          if (!(await hasLearningBudget(4))) return;
          await runAdditionalMutations();
        }),
      { timezone: 'UTC' });

      // Sunday 6pm UTC: Weekly example rotation
      cron.schedule('0 18 * * 0', () =>
        guardedRun('surgeon', '🔄 [Scheduler] Running Example Rotation...', runExampleRotation),
      { timezone: 'UTC' });

      // Sunday midnight UTC: Calibrate regression baselines
      cron.schedule('0 0 * * 0', () =>
        guardedRun('surgeon', '📏 [Scheduler] Calibrating regression baselines...', calibrateRegressionBaselines),
      { timezone: 'UTC' });

      console.log('[Scheduler] Orchestrator mode active — overnight pipeline at midnight UTC');
    } else {
      // ── Legacy mode: individual crons (unchanged behaviour) ──
      // Midnight UTC: reset daily budget counter
      cron.schedule('0 0 * * *', async () => {
        try { await resetDailyBudget(); }
        catch (err) { console.error('[Scheduler] Budget reset failed:', err); }
      }, { timezone: 'UTC' });

      // 1am UTC: Piggyback Judge
      cron.schedule('0 1 * * *', () =>
        guardedRun('piggyback-judge', '🔍 [Scheduler] Running Piggyback Judge...', runPiggybackJudge),
      { timezone: 'UTC' });

      // 2am UTC: Learning Memory distillation
      cron.schedule('0 2 * * *', () =>
        guardedRun('learning-memory', '🧠 [Scheduler] Distilling Learning Memory...', distillLearningMemory),
      { timezone: 'UTC' });

      // 3am UTC: Critic Agent
      cron.schedule('0 3 * * *', () =>
        guardedRun('critic-agent', '🔬 [Scheduler] Running Critic Agent...', runCriticAgent),
      { timezone: 'UTC' });

      // 5am UTC: Surgeon Agent
      cron.schedule('0 5 * * *', () =>
        guardedRun('surgeon', '⚕️  [Scheduler] Running Surgeon Agent...', runSurgeonAgent),
      { timezone: 'UTC' });

      // 3pm UTC: Follow-Up Critic (P2 budget-gated)
      cron.schedule('0 15 * * *', () =>
        guardedRun('followup-critic', '🔬 [Scheduler] Running Follow-Up Critic...', async () => {
          if (!(await hasLearningBudget(2))) return;
          await runFollowUpCritic();
        }),
      { timezone: 'UTC' });

      // 5pm UTC: Follow-Up Surgeon (P3 budget-gated)
      cron.schedule('0 17 * * *', () =>
        guardedRun('followup-surgeon', '⚕️  [Scheduler] Running Follow-Up Surgeon...', async () => {
          if (!(await hasLearningBudget(3))) return;
          await runFollowUpSurgeon();
        }),
      { timezone: 'UTC' });

      // 7pm UTC: 2nd-pass Surgeon (P3 budget-gated)
      cron.schedule('0 19 * * *', () =>
        guardedRun('surgeon', '⚕️  [Scheduler] Running 2nd-pass Surgeon...', async () => {
          if (!(await hasLearningBudget(3))) return;
          await runSurgeonAgentEvening();
        }),
      { timezone: 'UTC' });

      // 9pm UTC: Additional proactive mutations (P4 budget-gated)
      cron.schedule('0 21 * * *', () =>
        guardedRun('surgeon', '⚕️  [Scheduler] Running additional mutations (P4)...', async () => {
          if (!(await hasLearningBudget(4))) return;
          await runAdditionalMutations();
        }),
      { timezone: 'UTC' });

      // Sunday 6pm UTC: Weekly example rotation
      cron.schedule('0 18 * * 0', () =>
        guardedRun('surgeon', '🔄 [Scheduler] Running Example Rotation...', runExampleRotation),
      { timezone: 'UTC' });

      // Sunday midnight UTC: Calibrate regression baselines
      cron.schedule('0 0 * * 0', () =>
        guardedRun('surgeon', '📏 [Scheduler] Calibrating regression baselines...', calibrateRegressionBaselines),
      { timezone: 'UTC' });

      // Daily 12:30am: purge expired Intelligence Bus entries
      cron.schedule('30 0 * * *', async () => {
        try {
          const count = await purgeExpiredBusEntries();
          if (count > 0) console.log(`[Scheduler] Purged ${count} expired bus entries`);
        }
        catch (err) { console.error('[Scheduler] Bus cleanup failed:', err); }
      }, { timezone: 'UTC' });
    }
  } else {
    console.log('⏭️  [Scheduler] ENABLE_LEARNING_SYSTEM=false — skipping learning system crons');
  }

  // ── Security Auditor — Daily 2:30am UTC ──────────────────────────────────
  cron.schedule('30 2 * * *', () =>
    guardedRun('security-auditor', '🔐 [Scheduler] Running security auditor...', runSecurityAudit),
  { timezone: 'UTC' });

  // ── Code Reviewer — Wednesday 3:00am UTC ─────────────────────────────────
  cron.schedule('0 3 * * 3', () =>
    guardedRun('code-reviewer', '🔍 [Scheduler] Running code reviewer...', runCodeReview),
  { timezone: 'UTC' });

  // ── ASO Intelligence Agent — Tuesday 6:00am UTC ───────────────────────────
  cron.schedule('0 6 * * 2', () =>
    guardedRun('aso-intelligence', '📊 [Scheduler] Running ASO intelligence...', runAsoIntelligence),
  { timezone: 'UTC' });

  // ── Tier 0: Uptime Monitor — every 5 minutes ─────────────────────────────
  cron.schedule('*/5 * * * *', () =>
    guardedRun('uptime-monitor', '', runUptimeCheck),
  { timezone: 'UTC' });

  // Track daily uptime percentage at 11:55pm UTC
  cron.schedule('55 23 * * *', () =>
    guardedRun('uptime-monitor', '', trackDailyUptime),
  { timezone: 'UTC' });

  // ── Tier 0: Data Deletion Retry — Daily 6:30am UTC ───────────────────────
  cron.schedule('30 6 * * *', () =>
    guardedRun('data-deletion', '', retryFailedDeletions),
  { timezone: 'UTC' });

  // ── Affiliate Metrics — Daily 7am UTC ─────────────────────────────────────
  cron.schedule('0 7 * * *', () =>
    guardedRun('affiliate', '🛍️ [Scheduler] Running affiliate metrics...', measureAffiliateMetrics),
  { timezone: 'UTC' });

  // ── Affiliate Preference Learning — Daily 4am UTC (before nudge hour computation) ─
  cron.schedule('0 4 * * *', () =>
    guardedRun('affiliate-learning', '🛍️ [Scheduler] Computing user affiliate preferences...', computeUserAffiliatePreferences),
  { timezone: 'UTC' });

  // ── Fashion Event Discovery — Wednesday 8am UTC ───────────────────────────
  cron.schedule('0 8 * * 3', () =>
    guardedRun('fashion-events', '🗓️ [Scheduler] Running fashion event discovery...', runFashionEventDiscovery),
  { timezone: 'UTC' });

  // ── Fashion Event Nudge — Daily 8:30am UTC (Plus/Pro only) ───────────────
  cron.schedule('30 8 * * *', () =>
    guardedRun('fashion-events', '🗓️ [Scheduler] Running fashion event nudge...', runFashionEventNudge),
  { timezone: 'UTC' });

  // ── Tier 2: Churn Prediction — Daily 7:30am UTC ───────────────────────────
  cron.schedule('30 7 * * *', () =>
    guardedRun('churn-prediction', '📉 [Scheduler] Running churn prediction...', runChurnPrediction),
  { timezone: 'UTC' });

  // ── Tier 2: Feedback Analyst — Thursday 9am UTC ───────────────────────────
  cron.schedule('0 9 * * 4', () =>
    guardedRun('feedback-analyst', '💬 [Scheduler] Running feedback analyst...', runFeedbackAnalyst),
  { timezone: 'UTC' });

  // ── Tier 2: SEO Content Agent — Friday 7am UTC ────────────────────────────
  cron.schedule('0 7 * * 5', () =>
    guardedRun('seo-content', '📝 [Scheduler] Running SEO content agent...', runSeoContentAgent),
  { timezone: 'UTC' });

  // ── SEO Intelligence — Monday 7:30am UTC ──────────────────────────────────
  cron.schedule('30 7 * * 1', () =>
    guardedRun('seo-intelligence', '🔍 [Scheduler] Running SEO intelligence...', runSeoIntelligence),
  { timezone: 'UTC' });

  // ── SEO Position Tracker — Daily 6am UTC (only runs if SERPER_API_KEY set) ──
  // Reads TargetKeyword records with status=content_created, checks each in Serper,
  // writes real currentPosition. Runs before the 6:30am blitz so positions are fresh.
  cron.schedule('0 6 * * *', () =>
    guardedRun('seo-intelligence', '📍 [Scheduler] Tracking keyword positions...', trackKeywordPositions),
  { timezone: 'UTC' });

  // ── Rush Content Blitz — Tuesday + Friday 6:30am UTC (March–August) ───────
  // Generates 2 rush articles per run from the keyword seed list.
  cron.schedule('30 6 * * 2', () =>
    guardedRun('seo-content', '🎀 [Scheduler] Running rush content blitz (Tuesday)...', generateRushContentBlitz),
  { timezone: 'UTC' });

  cron.schedule('30 6 * * 5', () =>
    guardedRun('seo-content', '🎀 [Scheduler] Running rush content blitz (Friday)...', generateRushContentBlitz),
  { timezone: 'UTC' });

  // ── Rush Content Refresh — 1st of each month, 8am UTC ─────────────────────
  cron.schedule('0 8 1 * *', () =>
    guardedRun('seo-content', '🔄 [Scheduler] Running rush content refresh...', refreshRushContent),
  { timezone: 'UTC' });

  // ── Tier 3: Infra Monitor — Every 30 minutes ─────────────────────────────
  cron.schedule('*/30 * * * *', () =>
    guardedRun('infra-monitor', '', runInfraMonitor),
  { timezone: 'UTC' });

  // ── Tier 3: Onboarding Optimizer — Daily 8:30am UTC ──────────────────────
  cron.schedule('30 8 * * *', () =>
    guardedRun('onboarding-optimizer', '🚀 [Scheduler] Running onboarding optimizer...', runOnboardingOptimizer),
  { timezone: 'UTC' });

  // ── Tier 3: Competitive Intel — Saturday 9am UTC ─────────────────────────
  cron.schedule('0 9 * * 6', () =>
    guardedRun('competitive-intel', '🔍 [Scheduler] Running competitive intel...', runCompetitiveIntel),
  { timezone: 'UTC' });

  // ── Tier 3: E2E Tests — Thursday 4am UTC ─────────────────────────────────
  cron.schedule('0 4 * * 4', () =>
    guardedRun('e2e-test', '🧪 [Scheduler] Running E2E tests...', runE2eTests),
  { timezone: 'UTC' });

  // ── Creator Manager: Weekly hook distribution — Sunday 6pm UTC ───────────────
  cron.schedule('0 18 * * 0', async () => {
    console.log('🎬 [Scheduler] Running creator hook distribution...');
    try { await runCreatorHookDistribution(); }
    catch (err) { console.error('[Scheduler] Creator hook distribution failed:', err); }
  }, { timezone: 'UTC' });

  // ── Creator Manager: Performance digest — Friday 9am UTC ─────────────────────
  cron.schedule('0 9 * * 5', async () => {
    console.log('📊 [Scheduler] Running creator performance digest...');
    try { await runCreatorPerformanceDigest(); }
    catch (err) { console.error('[Scheduler] Creator performance digest failed:', err); }
  }, { timezone: 'UTC' });

  // ── Creator Install Attribution — Daily 11:30pm UTC ─────────────────────────
  cron.schedule('30 23 * * *', async () => {
    console.log('📲 [Scheduler] Updating creator install counts...');
    try { await updateCreatorInstallCounts(); }
    catch (err) { console.error('[Scheduler] Creator install count update failed:', err); }
  }, { timezone: 'UTC' });

  // ── Style Tips — Daily 11:30am UTC (picks up new DiscoveredRules as they accumulate) ──
  cron.schedule('30 11 * * *', () => {
    guardedRun('content-factory', '✍️ [Scheduler] Generating style tips...', generateStyleTips);
  }, { timezone: 'UTC' });

  // ── Learning Content Agent (weekly trend report only) — Tuesday 8am UTC ─────
  // Daily script generation runs at 6am via content-factory cron above.
  // This Tuesday run handles the weekly trend report separately.
  // NOTE: generateWeeklyTrendReport() is called inside runLearningContentAgent()
  // only on Tuesdays (guarded by day-of-week check in the function itself).

  // ── Founder Content Digest — Daily 10am UTC ──────────────────────────────
  // Sent daily after content is generated. Includes video scripts, trend report, tips, pending posts.
  cron.schedule('0 10 * * *', () => {
    guardedRun('content-factory', '📧 [Scheduler] Sending founder content digest...', sendFounderContentDigest);
  }, { timezone: 'UTC' });

  console.log('✅ [Scheduler] All cron jobs registered (Agents 1-16 + Operator Workforce + AI Intelligence + Recursive Self-Improvement + Relationship System + Self-Improving StyleDNA Engine + Ops Learning Loops + RSI Learning System + Security Auditor + Code Reviewer + ASO Intelligence + UGC Creator Program + Learning Center + Founder Content Digest + Growth Intern + Creator Install Attribution + SEO Intelligence + SEO Position Tracker + Rush Content Blitz)');
}
