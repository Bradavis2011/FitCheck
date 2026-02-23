import cron from 'node-cron';
import { sendDailyDigest, sendWeeklyDigest } from './email-report.service.js';
import { resetWeeklyPoints, resetMonthlyPoints } from './gamification.service.js';
import { prisma } from '../utils/prisma.js';
import { Resend } from 'resend';
import { pushService } from './push.service.js';
import { runContentCalendar } from './content-calendar.service.js';
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
import { runSocialMediaManager, registerExecutors as registerSocialExecutors } from './social-media-manager.service.js';
import { runAppStoreManager, runAppStoreWeeklySummary, registerExecutors as registerAppstoreExecutors } from './appstore-manager.service.js';
import { runOutreachAgent, registerExecutors as registerOutreachExecutors } from './outreach-agent.service.js';
import { runFashionTrendCron } from './fashion-trends.service.js';
import { runCalibrationSnapshot } from './calibration-snapshot.service.js';
import { runEventFollowUp, runFollowUpEmailFallback } from './event-followup.service.js';
import { runMilestoneScanner } from './milestone-message.service.js';
import { runStyleNarrativeAgent } from './style-narrative.service.js';

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

// ─── Engagement Nudger ────────────────────────────────────────────────────────

async function hasReceivedNudgeToday(userId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'nudge_push',
      createdAt: { gte: todayStart },
    },
  });

  return existing !== null;
}

async function sendNudge(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  // Guard: max 1 nudge per user per day
  if (await hasReceivedNudgeToday(userId)) return;

  // Send push notification
  await pushService.sendPushNotification(userId, { title, body, data });

  // Record the nudge in notifications table to enforce daily limit
  await prisma.notification.create({
    data: {
      userId,
      type: 'nudge_push',
      title,
      body,
    },
  });
}

async function runEngagementNudger(isEveningRun: boolean): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hoursAgo48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const hoursAgo72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const daysAgo5 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  let nudgeCount = 0;

  if (!isEveningRun) {
    // ── Segment 1: New users with no outfit check (24-48h after signup) ──
    try {
      const newUsersWithoutOutfit = await prisma.user.findMany({
        where: {
          createdAt: { gte: hoursAgo48, lt: hoursAgo24 },
          outfitChecks: { none: {} },
        },
        select: { id: true },
      });

      for (const { id } of newUsersWithoutOutfit) {
        await sendNudge(
          id,
          'Ready for your first outfit check? 👗',
          "Get personalized style feedback from our AI stylist. It only takes 30 seconds!",
          { type: 'nudge', segment: 'new_no_outfit' }
        );
        nudgeCount++;
      }
      console.log(`[Nudger] Segment 1 (new, no outfit): ${newUsersWithoutOutfit.length} users, ${nudgeCount} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 1 failed:', err);
    }

    // ── Segment 2: Users inactive for 3 days ──
    try {
      // Users who checked at some point but not in the last 72h
      const activeBeforeWindow = await prisma.outfitCheck.findMany({
        where: {
          isDeleted: false,
          createdAt: { lt: hoursAgo72 },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const potentialIds = activeBeforeWindow.map(u => u.userId);

      // Filter to those who haven't checked in the last 72h
      const recentlyActive = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: potentialIds },
          isDeleted: false,
          createdAt: { gte: hoursAgo72 },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const recentIds = new Set(recentlyActive.map(u => u.userId));
      const inactiveIds = potentialIds.filter(id => !recentIds.has(id));

      let seg2Count = 0;
      for (const userId of inactiveIds) {
        await sendNudge(
          userId,
          'Your style is evolving! ✨',
          "It's been a few days. Share your current look and get AI feedback.",
          { type: 'nudge', segment: 'inactive_3d' }
        );
        seg2Count++;
      }
      console.log(`[Nudger] Segment 2 (inactive 3d): ${inactiveIds.length} users, ${seg2Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 2 failed:', err);
    }

    // ── Segment 4: Churning Plus/Pro users (inactive 5+ days) ──
    try {
      const payingInactive = await prisma.user.findMany({
        where: {
          tier: { in: ['plus', 'pro'] },
          outfitChecks: {
            none: {
              isDeleted: false,
              createdAt: { gte: daysAgo5 },
            },
          },
        },
        select: { id: true, tier: true },
      });

      let seg4Count = 0;
      for (const { id, tier } of payingInactive) {
        await sendNudge(
          id,
          `We miss you! Your ${tier === 'pro' ? 'Pro' : 'Plus'} benefits are waiting 💎`,
          "You haven't checked in for 5 days. Your subscription perks are ready to use!",
          { type: 'nudge', segment: 'churning_paid' }
        );
        seg4Count++;
      }
      console.log(`[Nudger] Segment 4 (churning paid): ${payingInactive.length} users, ${seg4Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 4 failed:', err);
    }
  }

  // ── Segment 3: Streak at risk (evening only — 10pm UTC) ──
  if (isEveningRun) {
    try {
      // Users with an active streak who haven't checked in today
      const streakUsers = await prisma.userStats.findMany({
        where: { currentStreak: { gt: 0 } },
        select: { userId: true, currentStreak: true },
      });

      const streakUserIds = streakUsers.map(u => u.userId);

      // Find which of those checked today
      const checkedToday = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: streakUserIds },
          isDeleted: false,
          createdAt: { gte: todayStart },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const checkedTodayIds = new Set(checkedToday.map(u => u.userId));
      const atRisk = streakUsers.filter(u => !checkedTodayIds.has(u.userId));

      let seg3Count = 0;
      for (const { userId, currentStreak } of atRisk) {
        await sendNudge(
          userId,
          `⚠️ Your ${currentStreak}-day streak is at risk!`,
          "Check in with an outfit before midnight to keep your streak alive.",
          { type: 'nudge', segment: 'streak_risk', streak: currentStreak }
        );
        seg3Count++;
      }
      console.log(`[Nudger] Segment 3 (streak risk): ${atRisk.length} users, ${seg3Count} nudges sent`);
    } catch (err) {
      console.error('[Nudger] Segment 3 failed:', err);
    }
  }
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

  // ── Agent 10: Content Calendar — Monday 8am UTC ──────────────────────────
  cron.schedule('0 8 * * 1', async () => {
    console.log('📅 [Scheduler] Running content calendar generator...');
    try { await runContentCalendar(); }
    catch (err) { console.error('[Scheduler] Content calendar failed:', err); }
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

  // ── Social Media Manager: Draft posts — Monday + Thursday 8:30am UTC ────────
  // Note: replaces content-calendar (Agent 10) for post drafting; Agent 10 still runs for email calendar
  // 2x/week × 7 posts = 14 drafts/week — enough to post ~2/day with backlog
  cron.schedule('30 8 * * 1,4', async () => {
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

  console.log('✅ [Scheduler] All cron jobs registered (Agents 1-16 + Operator Workforce + AI Intelligence + Relationship System)');
}
