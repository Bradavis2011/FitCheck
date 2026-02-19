import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { createNotification } from '../controllers/notification.controller.js';

interface UserEngagement {
  userId: string;
  email: string;
  name: string | null;
  outfitChecks: number;
  followUps: number;
  feedbackGiven: number;
  daysActive: number;
  engagementScore: number;
}

async function getTopEngagedUsers(limit = 10): Promise<UserEngagement[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      outfitChecks: {
        where: { isDeleted: false, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, createdAt: true, followUps: { select: { id: true } } },
      },
      userStats: { select: { totalFeedbackGiven: true } },
    },
    where: {
      outfitChecks: {
        some: { isDeleted: false, createdAt: { gte: thirtyDaysAgo } },
      },
    },
    take: 200,
  });

  const engagedUsers: UserEngagement[] = users.map(user => {
    const checks = user.outfitChecks.length;
    const followUps = user.outfitChecks.reduce((sum, c) => sum + c.followUps.length, 0);
    const feedbackGiven = user.userStats?.totalFeedbackGiven ?? 0;
    const activeDates = new Set(user.outfitChecks.map(c => c.createdAt.toISOString().split('T')[0]));
    const daysActive = activeDates.size;
    const engagementScore = (checks * 3) + (followUps * 2) + (feedbackGiven * 1) + (daysActive * 5);

    return { userId: user.id, email: user.email, name: user.name, outfitChecks: checks, followUps, feedbackGiven, daysActive, engagementScore };
  });

  return engagedUsers.sort((a, b) => b.engagementScore - a.engagementScore).slice(0, limit);
}

function buildBetaRecruiterEmail(topUsers: UserEngagement[]): string {
  const rows = topUsers.map((u, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#FBF7F4'};">
      <td style="padding:10px 12px;font-size:13px;">${i + 1}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;">${u.name || '(no name)'}</td>
      <td style="padding:10px 12px;font-size:13px;">${u.email}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:center;">${u.outfitChecks}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:center;">${u.followUps}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:center;">${u.feedbackGiven}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:center;">${u.daysActive}</td>
      <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#E85D4C;text-align:center;">${u.engagementScore}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:800px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Beta Tester Recruiter — Top ${topUsers.length} Power Users</div>
      </div>
      <div style="padding:32px 40px;">
        <p style="color:#2D2D2D;font-size:14px;">These users received in-app beta invitations. Consider reaching out directly for TestFlight access or deeper feedback sessions.</p>
        <table width="100%" style="border-collapse:collapse;margin-top:16px;">
          <thead><tr style="background:#F5EDE7;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;">Name</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;">Email</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;">Checks</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;">Follow-ups</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;">Feedback</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B7280;">Days Active</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#E85D4C;">Score</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · Beta Recruiter Agent · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runBetaRecruiter(): Promise<void> {
  if (process.env.ENABLE_BETA_RECRUITER !== 'true') {
    console.log('[BetaRecruiter] ENABLE_BETA_RECRUITER not set — skipping');
    return;
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[BetaRecruiter] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const topUsers = await getTopEngagedUsers(10);
    if (topUsers.length === 0) {
      console.log('[BetaRecruiter] No eligible users found');
      return;
    }

    let notified = 0;
    for (const user of topUsers) {
      try {
        await createNotification({
          userId: user.userId,
          type: 'beta_invite',
          title: "You're one of our top style explorers! 🌟",
          body: "We'd love your feedback as a beta tester. Tap to learn more!",
          linkType: 'general',
        });
        notified++;
      } catch (err) {
        console.warn(`[BetaRecruiter] Failed to notify user ${user.userId}:`, err);
      }
    }

    const from = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Beta Recruiter — ${topUsers.length} power users identified, ${notified} notified`,
      html: buildBetaRecruiterEmail(topUsers),
    });

    console.log(`✅ [BetaRecruiter] Identified ${topUsers.length} users, notified ${notified}`);
  } catch (err) {
    console.error('[BetaRecruiter] Failed:', err);
  }
}
