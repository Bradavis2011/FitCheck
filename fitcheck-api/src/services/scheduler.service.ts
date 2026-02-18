import cron from 'node-cron';
import { sendDailyDigest, sendWeeklyDigest } from './email-report.service.js';
import { resetWeeklyPoints, resetMonthlyPoints } from './gamification.service.js';
import { prisma } from '../utils/prisma.js';

function isEnabled(): boolean {
  return process.env.ENABLE_CRON === 'true';
}

export function initializeScheduler(): void {
  if (!isEnabled()) {
    console.log('⏭️  [Scheduler] ENABLE_CRON not set — skipping cron jobs');
    return;
  }

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

  console.log('✅ [Scheduler] All cron jobs registered');
}
