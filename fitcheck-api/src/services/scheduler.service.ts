import cron from 'node-cron';
import { runSecurityAudit } from './security-auditor.service.js';
import { runCodeReview } from './code-reviewer.service.js';
import { runAsoIntelligence } from './aso-intelligence.service.js';
import { sendDailyDigest, sendWeeklyDigest } from './email-report.service.js';
import { resetWeeklyPoints, resetMonthlyPoints } from './gamification.service.js';
import { prisma } from '../utils/prisma.js';
import { Resend } from 'resend';
import { runEngagementNudger, measureNudgeMetrics, computePreferredNudgeHours, runPersonalizedNudge } from './nudge.service.js';
import { runOpsLearning, pollTwitterEngagement } from './ops-learning.service.js';
// content-calendar runContentCalendar replaced by sendWeeklySocialDigest — getTrendData still used by other services
import { runGrowthDashboard } from './growth-dashboard.service.js';
import { runBetaRecruiter } from './beta-recruiter.service.js';
import { runViralMonitor } from './viral-monitor.service.js';
import { runAiQualityMonitor } from './ai-quality-monitor.service.js';
import { runRevenueCostTracker } from './revenue-cost.service.js';
import { runFounderBrief } from './founder-brief.service.js';
// ── Autonomous Operator Agents (Phase 2-4) ────────────────────────────────────
import { processApprovedActions } from './agent-manager.service.js';
import { runLifecycleEmail } from './lifecycle-email.service.js';
import { runConversionIntelligence } from './conversion-intelligence.service.js';
import { runCommunityManagerDaily, runCommunityManagerWeekly } from './community-manager.service.js';
import { runSocialMediaManager, sendWeeklySocialDigest, registerExecutors as registerSocialExecutors } from './social-media-manager.service.js';
import { runAppStoreManager, runAppStoreWeeklySummary, registerExecutors as registerAppstoreExecutors } from './appstore-manager.service.js';
import { runOutreachAgent, registerExecutors as registerOutreachExecutors } from './outreach-agent.service.js';
import { runCreatorHookDistribution, runCreatorPerformanceDigest, registerCreatorExecutors } from './creator-manager.service.js';
import { runLearningContentAgent, generateStyleTips } from './learning-content.service.js';
import { sendFounderContentDigest } from './founder-content-digest.service.js';
import { runFashionTrendCron } from './fashion-trends.service.js';
import { runUptimeCheck, trackDailyUptime } from './uptime-monitor.service.js';
import { retryFailedDeletions } from './data-deletion.service.js';
import { runChurnPrediction } from './churn-prediction.service.js';
import { runFeedbackAnalyst } from './feedback-analyst.service.js';
import { runSeoContentAgent } from './seo-content.service.js';
import { runInfraMonitor } from './infra-monitor.service.js';
import { runOnboardingOptimizer } from './onboarding-optimizer.service.js';
import { runCompetitiveIntel } from './competitive-intel.service.js';
import { runE2eTests } from './e2e-test.service.js';
import { runCalibrationSnapshot } from './calibration-snapshot.service.js';
import { runEventFollowUp, runFollowUpEmailFallback } from './event-followup.service.js';
import { runMilestoneScanner } from './milestone-message.service.js';
import { runStyleNarrativeAgent } from './style-narrative.service.js';
import { checkAndTriggerImprovement, runCohortImprovementCycle } from './recursive-improvement.service.js';
// ── Self-Improving StyleDNA Engine ────────────────────────────────────────────
import { resetDailyBudget, hasLearningBudget } from './token-budget.service.js';
import { purgeExpiredBusEntries } from './intelligence-bus.service.js';
import { distillLearningMemory } from './prompt-assembly.service.js';
import { runPiggybackJudge } from './arena.service.js';
import { runCriticAgent, runFollowUpCritic } from './critic-agent.service.js';
import {
  runSurgeonAgent,
  runSurgeonAgentEvening,
  runAdditionalMutations,
  runFollowUpSurgeon,
  runExampleRotation,
} from './surgeon-agent.service.js';

function isEnabled(): boolean {
  return process.env.ENABLE_CRON === 'true';
}

function isNudgeEnabled(): boolean {
  return process.env.ENABLE_NUDGE !== 'false';
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
  registerOutreachExecutors();
  registerCreatorExecutors();

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
    cron.schedule('0 14 * * *', async () => {
      console.log('💬 [Scheduler] Running engagement nudger (morning)...');
      try {
        await runEngagementNudger(false);
      } catch (err) {
        console.error('[Scheduler] Engagement nudger (morning) failed:', err);
      }
    }, { timezone: 'UTC' });

    cron.schedule('0 22 * * *', async () => {
      console.log('💬 [Scheduler] Running engagement nudger (evening/streak)...');
      try {
        await runEngagementNudger(true);
      } catch (err) {
        console.error('[Scheduler] Engagement nudger (evening) failed:', err);
      }
    }, { timezone: 'UTC' });
  } else {
    console.log('⏭️  [Scheduler] ENABLE_NUDGE=false — skipping engagement nudger');
  }

  // ── Fashion Trend Intelligence — Monday 7am UTC (before content calendar) ──
  cron.schedule('0 7 * * 1', async () => {
    console.log('👗 [Scheduler] Running fashion trend cron...');
    try { await runFashionTrendCron(); }
    catch (err) { console.error('[Scheduler] Fashion trend cron failed:', err); }
  }, { timezone: 'UTC' });

  // ── Calibration Snapshot — Sunday 9pm UTC ────────────────────────────────
  cron.schedule('0 21 * * 0', async () => {
    console.log('📐 [Scheduler] Running calibration snapshot...');
    try { await runCalibrationSnapshot(); }
    catch (err) { console.error('[Scheduler] Calibration snapshot failed:', err); }
  }, { timezone: 'UTC' });

  // ── Weekly Social Digest — Monday 8am UTC ────────────────────────────────
  // Replaces separate content calendar + social manager emails with one copy-paste-ready digest.
  // getTrendData() (from content-calendar) is still used by other services (SEO, social engine).
  cron.schedule('0 8 * * 1', async () => {
    console.log('📱 [Scheduler] Sending weekly social digest...');
    try { await sendWeeklySocialDigest(); }
    catch (err) { console.error('[Scheduler] Weekly social digest failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 11: Growth Dashboard — Daily 9am UTC ───────────────────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('📈 [Scheduler] Running growth dashboard...');
    try { await runGrowthDashboard(); }
    catch (err) { console.error('[Scheduler] Growth dashboard failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 12: Beta Recruiter — Wednesday 10am UTC ─────────────────────────
  cron.schedule('0 10 * * 3', async () => {
    console.log('🌟 [Scheduler] Running beta recruiter...');
    try { await runBetaRecruiter(); }
    catch (err) { console.error('[Scheduler] Beta recruiter failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 13: Viral Loop Monitor — Friday 9am UTC ────────────────────────
  cron.schedule('0 9 * * 5', async () => {
    console.log('🔁 [Scheduler] Running viral loop monitor...');
    try { await runViralMonitor(); }
    catch (err) { console.error('[Scheduler] Viral monitor failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 14: AI Quality Monitor — Daily 1:30pm UTC ─────────────────────
  cron.schedule('30 13 * * *', async () => {
    console.log('🤖 [Scheduler] Running AI quality monitor...');
    try { await runAiQualityMonitor(); }
    catch (err) { console.error('[Scheduler] AI quality monitor failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 15: Revenue & Cost Tracker — Monday 9am UTC ───────────────────
  cron.schedule('0 9 * * 1', async () => {
    console.log('💰 [Scheduler] Running revenue & cost tracker...');
    try { await runRevenueCostTracker(); }
    catch (err) { console.error('[Scheduler] Revenue cost tracker failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent 16: Weekly Founder Brief — Sunday 8pm UTC ─────────────────────
  cron.schedule('0 20 * * 0', async () => {
    console.log('📋 [Scheduler] Running weekly founder brief...');
    try { await runFounderBrief(); }
    catch (err) { console.error('[Scheduler] Founder brief failed:', err); }
  }, { timezone: 'UTC' });

  // ── Agent Manager: Process approved actions — every 5 min ─────────────────
  cron.schedule('*/5 * * * *', async () => {
    try { await processApprovedActions(); }
    catch (err) { console.error('[Scheduler] processApprovedActions failed:', err); }
  }, { timezone: 'UTC' });

  // ── Lifecycle Email: Process due email sequences — every 30 min ───────────
  cron.schedule('*/30 * * * *', async () => {
    console.log('📧 [Scheduler] Running lifecycle email...');
    try { await runLifecycleEmail(); }
    catch (err) { console.error('[Scheduler] Lifecycle email failed:', err); }
  }, { timezone: 'UTC' });

  // ── Conversion Intelligence: Scan for signals — Daily 11am UTC ───────────
  cron.schedule('0 11 * * *', async () => {
    console.log('📊 [Scheduler] Running conversion intelligence...');
    try { await runConversionIntelligence(); }
    catch (err) { console.error('[Scheduler] Conversion intelligence failed:', err); }
  }, { timezone: 'UTC' });

  // ── Community Manager: Daily highlights — Daily 10am UTC ─────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log('🌟 [Scheduler] Running community manager (daily)...');
    try { await runCommunityManagerDaily(); }
    catch (err) { console.error('[Scheduler] Community manager daily failed:', err); }
  }, { timezone: 'UTC' });

  // ── Community Manager: Weekly challenge — Monday 9:30am UTC ─────────────────
  cron.schedule('30 9 * * 1', async () => {
    console.log('🏆 [Scheduler] Running community manager (weekly challenge)...');
    try { await runCommunityManagerWeekly(); }
    catch (err) { console.error('[Scheduler] Community manager weekly failed:', err); }
  }, { timezone: 'UTC' });

  // ── Social Media Manager: Content engine — Mon/Wed/Fri 8:30am UTC ────────────
  // 3x/week × 3 generators × 1-2 posts each ≈ 9 posts/week (~1-2/day with approval backlog)
  // Mon: Founder Story + Fashion News + Community Spotlight
  // Wed: Style Data Drop + Conversation Starter + Wardrobe Insight
  // Fri: Behind the Scenes + Fashion News + Community Spotlight
  cron.schedule('30 8 * * 1,3,5', async () => {
    console.log('📱 [Scheduler] Running social media manager...');
    try { await runSocialMediaManager(); }
    catch (err) { console.error('[Scheduler] Social media manager failed:', err); }
  }, { timezone: 'UTC' });

  // ── App Store Manager: Fetch + respond to reviews — Daily 2:15pm UTC ────────
  cron.schedule('15 14 * * *', async () => {
    console.log('⭐ [Scheduler] Running app store manager...');
    try { await runAppStoreManager(); }
    catch (err) { console.error('[Scheduler] App store manager failed:', err); }
  }, { timezone: 'UTC' });

  // ── App Store Manager: Weekly review summary — Sunday 7pm UTC ────────────
  cron.schedule('0 19 * * 0', async () => {
    console.log('📊 [Scheduler] Running app store weekly summary...');
    try { await runAppStoreWeeklySummary(); }
    catch (err) { console.error('[Scheduler] App store weekly summary failed:', err); }
  }, { timezone: 'UTC' });

  // ── Outreach Agent: Generate outreach drafts — Wednesday 10:30am UTC ─────────
  cron.schedule('30 10 * * 3', async () => {
    console.log('📨 [Scheduler] Running outreach agent...');
    try { await runOutreachAgent(); }
    catch (err) { console.error('[Scheduler] Outreach agent failed:', err); }
  }, { timezone: 'UTC' });

  // ── A1: Compute preferred nudge hours — Daily 4:30am UTC (before Surgeon at 5am) ──
  if (isNudgeEnabled()) {
    cron.schedule('30 4 * * *', async () => {
      try { await computePreferredNudgeHours(); }
      catch (err) { console.error('[Scheduler] computePreferredNudgeHours failed:', err); }
    }, { timezone: 'UTC' });

    // A1: Personalized nudge — every hour, sends to users whose preferred hour matches now
    cron.schedule('0 * * * *', async () => {
      try {
        const hour = new Date().getUTCHours();
        await runPersonalizedNudge(hour);
      } catch (err) { console.error('[Scheduler] runPersonalizedNudge failed:', err); }
    }, { timezone: 'UTC' });
  }

  // ── Ops Learning Loop — Daily Measurers (6am UTC, DB only, $0) ──────────────
  cron.schedule('0 6 * * *', async () => {
    console.log('📊 [Scheduler] Running ops learning measurers...');
    try { await measureNudgeMetrics(); }
    catch (err) { console.error('[Scheduler] Nudge metrics failed:', err); }
  }, { timezone: 'UTC' });

  // ── Ops Learning Loop — Twitter Engagement Poll (6:30am UTC) ─────────────────
  cron.schedule('30 6 * * *', async () => {
    try { await pollTwitterEngagement(); }
    catch (err) { console.error('[Scheduler] Twitter engagement poll failed:', err); }
  }, { timezone: 'UTC' });

  // ── Ops Learning Agent — Weekly Cycle (Sunday 7am UTC) ───────────────────────
  cron.schedule('0 7 * * 0', async () => {
    console.log('🧠 [Scheduler] Running Ops Learning Agent...');
    try { await runOpsLearning(); }
    catch (err) { console.error('[Scheduler] Ops Learning Agent failed:', err); }
  }, { timezone: 'UTC' });

  // ── Relationship System ───────────────────────────────────────────────────────

  // Post-event follow-up: every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try { await runEventFollowUp(); }
    catch (err) { console.error('[Scheduler] Event follow-up failed:', err); }
  }, { timezone: 'UTC' });

  // Follow-up email fallback: every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('📧 [Scheduler] Running follow-up email fallback...');
    try { await runFollowUpEmailFallback(); }
    catch (err) { console.error('[Scheduler] Follow-up email fallback failed:', err); }
  }, { timezone: 'UTC' });

  // Milestone scanner: daily 3pm UTC
  cron.schedule('0 15 * * *', async () => {
    console.log('🏆 [Scheduler] Running milestone scanner...');
    try { await runMilestoneScanner(); }
    catch (err) { console.error('[Scheduler] Milestone scanner failed:', err); }
  }, { timezone: 'UTC' });

  // Style narrative agent: Sunday 5pm UTC
  cron.schedule('0 17 * * 0', async () => {
    console.log('✍️  [Scheduler] Running style narrative agent...');
    try { await runStyleNarrativeAgent(); }
    catch (err) { console.error('[Scheduler] Style narrative agent failed:', err); }
  }, { timezone: 'UTC' });

  // ── Recursive Self-Improvement: Check quality + evaluate A/B tests — Daily 4am UTC ──
  cron.schedule('0 4 * * *', async () => {
    console.log('🧠 [Scheduler] Running recursive self-improvement check...');
    try { await checkAndTriggerImprovement(); }
    catch (err) { console.error('[Scheduler] Recursive self-improvement failed:', err); }
  }, { timezone: 'UTC' });

  // ── C1+C2: StyleDNA Cohort Improvement — Monthly (Wed 6am UTC, days 1-7) ──
  cron.schedule('0 6 1-7 * 3', async () => {
    console.log('🎯 [Scheduler] Running StyleDNA cohort improvement cycle...');
    try { await runCohortImprovementCycle(); }
    catch (err) { console.error('[Scheduler] Cohort improvement cycle failed:', err); }
  }, { timezone: 'UTC' });

  // ── Self-Improving StyleDNA Engine ───────────────────────────────────────────

  if (process.env.ENABLE_LEARNING_SYSTEM !== 'false') {
    // Midnight UTC: reset daily budget counter
    cron.schedule('0 0 * * *', async () => {
      try { await resetDailyBudget(); }
      catch (err) { console.error('[Scheduler] Budget reset failed:', err); }
    }, { timezone: 'UTC' });

    // 1am UTC: Piggyback Judge — batch-evaluate yesterday's real analyses (P1, ~7K tokens)
    cron.schedule('0 1 * * *', async () => {
      console.log('🔍 [Scheduler] Running Piggyback Judge...');
      try { await runPiggybackJudge(); }
      catch (err) { console.error('[Scheduler] Piggyback Judge failed:', err); }
    }, { timezone: 'UTC' });

    // 2am UTC: Learning Memory distillation ($0 — pure DB reads)
    cron.schedule('0 2 * * *', async () => {
      console.log('🧠 [Scheduler] Distilling Learning Memory...');
      try { await distillLearningMemory(); }
      catch (err) { console.error('[Scheduler] Learning Memory distillation failed:', err); }
    }, { timezone: 'UTC' });

    // 3am UTC: Critic Agent — find weakness patterns (P1, ~10K tokens)
    cron.schedule('0 3 * * *', async () => {
      console.log('🔬 [Scheduler] Running Critic Agent...');
      try { await runCriticAgent(); }
      catch (err) { console.error('[Scheduler] Critic Agent failed:', err); }
    }, { timezone: 'UTC' });

    // 5am UTC: Surgeon Agent — reactive fix + proactive mutation (P1+P2, ~35-42K tokens)
    cron.schedule('0 5 * * *', async () => {
      console.log('⚕️  [Scheduler] Running Surgeon Agent...');
      try { await runSurgeonAgent(); }
      catch (err) { console.error('[Scheduler] Surgeon Agent failed:', err); }
    }, { timezone: 'UTC' });

    // 3pm UTC: Follow-Up Critic — evaluate follow-up Q&A quality (P2 budget-gated)
    cron.schedule('0 15 * * *', async () => {
      if (!(await hasLearningBudget(2))) return;
      console.log('🔬 [Scheduler] Running Follow-Up Critic...');
      try { await runFollowUpCritic(); }
      catch (err) { console.error('[Scheduler] Follow-Up Critic failed:', err); }
    }, { timezone: 'UTC' });

    // 5pm UTC: Follow-Up Surgeon — improve follow-up prompt sections (P3 budget-gated)
    cron.schedule('0 17 * * *', async () => {
      if (!(await hasLearningBudget(3))) return;
      console.log('⚕️  [Scheduler] Running Follow-Up Surgeon...');
      try { await runFollowUpSurgeon(); }
      catch (err) { console.error('[Scheduler] Follow-Up Surgeon failed:', err); }
    }, { timezone: 'UTC' });

    // 7pm UTC: 2nd-pass Surgeon — reactive fix or mutation (P3 budget-gated)
    cron.schedule('0 19 * * *', async () => {
      if (!(await hasLearningBudget(3))) return;
      console.log('⚕️  [Scheduler] Running 2nd-pass Surgeon...');
      try { await runSurgeonAgentEvening(); }
      catch (err) { console.error('[Scheduler] 2nd-pass Surgeon failed:', err); }
    }, { timezone: 'UTC' });

    // 9pm UTC: Additional proactive mutations (P4 budget-gated, 2x mutations)
    cron.schedule('0 21 * * *', async () => {
      if (!(await hasLearningBudget(4))) return;
      console.log('⚕️  [Scheduler] Running additional mutations (P4)...');
      try { await runAdditionalMutations(); }
      catch (err) { console.error('[Scheduler] Additional mutations failed:', err); }
    }, { timezone: 'UTC' });

    // Sunday 6pm UTC: Weekly example rotation (~14K tokens)
    cron.schedule('0 18 * * 0', async () => {
      console.log('🔄 [Scheduler] Running Example Rotation...');
      try { await runExampleRotation(); }
      catch (err) { console.error('[Scheduler] Example Rotation failed:', err); }
    }, { timezone: 'UTC' });

    // Daily midnight: purge expired Intelligence Bus entries
    cron.schedule('30 0 * * *', async () => {
      try {
        const count = await purgeExpiredBusEntries();
        if (count > 0) console.log(`[Scheduler] Purged ${count} expired bus entries`);
      }
      catch (err) { console.error('[Scheduler] Bus cleanup failed:', err); }
    }, { timezone: 'UTC' });
  } else {
    console.log('⏭️  [Scheduler] ENABLE_LEARNING_SYSTEM=false — skipping learning system crons');
  }

  // ── Security Auditor — Daily 2:30am UTC ──────────────────────────────────
  cron.schedule('30 2 * * *', async () => {
    console.log('🔐 [Scheduler] Running security auditor...');
    try { await runSecurityAudit(); }
    catch (err) { console.error('[Scheduler] Security auditor failed:', err); }
  }, { timezone: 'UTC' });

  // ── Code Reviewer — Wednesday 3:00am UTC ─────────────────────────────────
  cron.schedule('0 3 * * 3', async () => {
    console.log('🔍 [Scheduler] Running code reviewer...');
    try { await runCodeReview(); }
    catch (err) { console.error('[Scheduler] Code reviewer failed:', err); }
  }, { timezone: 'UTC' });

  // ── ASO Intelligence Agent — Tuesday 6:00am UTC ───────────────────────────
  cron.schedule('0 6 * * 2', async () => {
    console.log('📊 [Scheduler] Running ASO intelligence...');
    try { await runAsoIntelligence(); }
    catch (err) { console.error('[Scheduler] ASO intelligence failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 0: Uptime Monitor — every 5 minutes ─────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try { await runUptimeCheck(); }
    catch (err) { console.error('[Scheduler] Uptime check failed:', err); }
  }, { timezone: 'UTC' });

  // Track daily uptime percentage at 11:55pm UTC
  cron.schedule('55 23 * * *', async () => {
    try { await trackDailyUptime(); }
    catch (err) { console.error('[Scheduler] Track daily uptime failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 0: Data Deletion Retry — Daily 6:30am UTC ───────────────────────
  cron.schedule('30 6 * * *', async () => {
    try { await retryFailedDeletions(); }
    catch (err) { console.error('[Scheduler] Data deletion retry failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 2: Churn Prediction — Daily 7:30am UTC ───────────────────────────
  cron.schedule('30 7 * * *', async () => {
    console.log('📉 [Scheduler] Running churn prediction...');
    try { await runChurnPrediction(); }
    catch (err) { console.error('[Scheduler] Churn prediction failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 2: Feedback Analyst — Thursday 9am UTC ───────────────────────────
  cron.schedule('0 9 * * 4', async () => {
    console.log('💬 [Scheduler] Running feedback analyst...');
    try { await runFeedbackAnalyst(); }
    catch (err) { console.error('[Scheduler] Feedback analyst failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 2: SEO Content Agent — Friday 7am UTC ────────────────────────────
  cron.schedule('0 7 * * 5', async () => {
    console.log('📝 [Scheduler] Running SEO content agent...');
    try { await runSeoContentAgent(); }
    catch (err) { console.error('[Scheduler] SEO content agent failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 3: Infra Monitor — Every 30 minutes ─────────────────────────────
  cron.schedule('*/30 * * * *', async () => {
    try { await runInfraMonitor(); }
    catch (err) { console.error('[Scheduler] Infra monitor failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 3: Onboarding Optimizer — Daily 8:30am UTC ──────────────────────
  cron.schedule('30 8 * * *', async () => {
    console.log('🚀 [Scheduler] Running onboarding optimizer...');
    try { await runOnboardingOptimizer(); }
    catch (err) { console.error('[Scheduler] Onboarding optimizer failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 3: Competitive Intel — Saturday 9am UTC ─────────────────────────
  cron.schedule('0 9 * * 6', async () => {
    console.log('🔍 [Scheduler] Running competitive intel...');
    try { await runCompetitiveIntel(); }
    catch (err) { console.error('[Scheduler] Competitive intel failed:', err); }
  }, { timezone: 'UTC' });

  // ── Tier 3: E2E Tests — Thursday 4am UTC ─────────────────────────────────
  cron.schedule('0 4 * * 4', async () => {
    console.log('🧪 [Scheduler] Running E2E tests...');
    try { await runE2eTests(); }
    catch (err) { console.error('[Scheduler] E2E tests failed:', err); }
  }, { timezone: 'UTC' });

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

  // ── Style Tips — Daily 11:30am UTC (picks up new DiscoveredRules as they accumulate) ──
  cron.schedule('30 11 * * *', async () => {
    try { await generateStyleTips(); }
    catch (err) { console.error('[Scheduler] Style tips failed:', err); }
  }, { timezone: 'UTC' });

  // ── Learning Content Agent — Tuesday 8am UTC ─────────────────────────────
  // Runs after Mon 7am fashion trends. Generates trend report + TikTok scripts.
  // (Style tips run daily above — no need to duplicate here.)
  cron.schedule('0 8 * * 2', async () => {
    console.log('📚 [Scheduler] Running learning content agent...');
    try { await runLearningContentAgent(); }
    catch (err) { console.error('[Scheduler] Learning content agent failed:', err); }
  }, { timezone: 'UTC' });

  // ── Founder Content Digest — Tuesday 10am UTC ────────────────────────────
  // Sent after content is generated. Includes TikTok scripts, trend report, tips, pending posts.
  cron.schedule('0 10 * * 2', async () => {
    console.log('📧 [Scheduler] Running founder content digest...');
    try { await sendFounderContentDigest(); }
    catch (err) { console.error('[Scheduler] Founder content digest failed:', err); }
  }, { timezone: 'UTC' });

  console.log('✅ [Scheduler] All cron jobs registered (Agents 1-16 + Operator Workforce + AI Intelligence + Recursive Self-Improvement + Relationship System + Self-Improving StyleDNA Engine + Ops Learning Loops + RSI Learning System + Security Auditor + Code Reviewer + ASO Intelligence + UGC Creator Program + Learning Center + Founder Content Digest)');
}
