import { Resend } from 'resend';
import { getMetricsSnapshot, storeDailySnapshot, getSnapshotHistory, MetricsSnapshot } from './metrics.service.js';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#6B7280';
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
}

function deltaArrow(current: number, previous: number | null | undefined): string {
  if (previous == null) return '';
  const diff = current - previous;
  if (diff > 0) return `<span style="color:#10B981"> ▲ ${diff}</span>`;
  if (diff < 0) return `<span style="color:#EF4444"> ▼ ${Math.abs(diff)}</span>`;
  return `<span style="color:#6B7280"> →</span>`;
}

function buildDailyHtml(metrics: MetricsSnapshot): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#FBF7F4;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Or This?</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Daily Metrics Digest</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:8px;">${dateStr}</div>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">

          <!-- Users -->
          <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Users</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              ${metricCard('Total Users', metrics.totalUsers.toLocaleString())}
              ${metricCard('New Today', metrics.newUsersToday.toLocaleString())}
              ${metricCard('DAU', metrics.dau.toLocaleString())}
              ${metricCard('WAU', metrics.wau.toLocaleString())}
            </tr>
            <tr>
              ${metricCard('Free', metrics.freeUsers.toLocaleString())}
              ${metricCard('Plus', metrics.plusUsers.toLocaleString())}
              ${metricCard('Pro', metrics.proUsers.toLocaleString())}
              ${metricCard('7-Day Retention', metrics.retention7d != null ? metrics.retention7d + '%' : '—')}
            </tr>
          </table>

          <!-- Engagement -->
          <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Engagement</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              ${metricCard('Checks Today', metrics.checksToday.toLocaleString())}
              ${metricCard('Feedbacks Today', metrics.feedbacksToday.toLocaleString())}
              ${metricCard('Avg AI Score', fmt(metrics.avgAiScore, 1), scoreColor(metrics.avgAiScore))}
              ${metricCard('Avg Community', fmt(metrics.avgCommunityScore, 1), scoreColor(metrics.avgCommunityScore))}
            </tr>
          </table>

          <!-- Community & Streaks -->
          <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Community & Streaks</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              ${metricCard('Users w/ Streak', metrics.usersWithStreak.toLocaleString())}
              ${metricCard('Avg Streak', fmt(metrics.avgStreak, 1) + ' days')}
              ${metricCard('Comparison Posts', metrics.comparisonPosts.toLocaleString())}
              ${metricCard('Live Sessions', metrics.liveSessions.toLocaleString())}
            </tr>
          </table>

          <!-- Revenue -->
          <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Revenue Events Today</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              ${metricCard('New Subscriptions', metrics.newSubscriptions.toLocaleString(), '#10B981')}
              ${metricCard('Cancellations', metrics.cancellations.toLocaleString(), metrics.cancellations > 0 ? '#EF4444' : undefined)}
              ${metricCard('Renewals', metrics.renewals.toLocaleString())}
              ${metricCard('Expert Reviews Pending', metrics.expertReviewsPending.toLocaleString())}
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F5EDE7;padding:20px 40px;text-align:center;">
            <div style="font-size:12px;color:#6B7280;">Or This? · Automated daily digest · Generated ${new Date().toISOString()}</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function metricCard(label: string, value: string, valueColor?: string): string {
  return `<td style="padding:6px 4px;" width="25%">
    <div style="background:#FBF7F4;border-radius:10px;padding:12px 10px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:${valueColor ?? '#1A1A1A'};">${value}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:4px;">${label}</div>
    </div>
  </td>`;
}

function buildWeeklyHtml(metrics: MetricsSnapshot, prev: MetricsSnapshot | null): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const weekRow = (label: string, current: number, previous: number | null | undefined, suffix = '') =>
    `<tr>
      <td style="padding:8px 12px;color:#2D2D2D;font-size:14px;">${label}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#1A1A1A;font-size:14px;">${current.toLocaleString()}${suffix}</td>
      <td style="padding:8px 12px;text-align:right;font-size:13px;color:#6B7280;">${previous != null ? previous.toLocaleString() + suffix : '—'}${deltaArrow(current, previous)}</td>
    </tr>`;

  const p = prev ?? null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#FBF7F4;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Or This?</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Weekly Business Report</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:8px;">${dateStr}</div>
          </td>
        </tr>

        <!-- Table header -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr style="background:#F5EDE7;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Metric</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">This Week</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Last Week</th>
              </tr>

              <!-- Users -->
              <tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">Users</td></tr>
              ${weekRow('Total Users', metrics.totalUsers, p?.totalUsers)}
              ${weekRow('New Users Today', metrics.newUsersToday, p?.newUsersToday)}
              ${weekRow('DAU', metrics.dau, p?.dau)}
              ${weekRow('WAU', metrics.wau, p?.wau)}
              ${weekRow('7-Day Retention', metrics.retention7d ?? 0, p?.retention7d ?? null, '%')}

              <!-- Tiers -->
              <tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">Tier Breakdown</td></tr>
              ${weekRow('Free', metrics.freeUsers, p?.freeUsers)}
              ${weekRow('Plus', metrics.plusUsers, p?.plusUsers)}
              ${weekRow('Pro', metrics.proUsers, p?.proUsers)}

              <!-- Engagement -->
              <tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">Engagement</td></tr>
              ${weekRow('Checks Today', metrics.checksToday, p?.checksToday)}
              ${weekRow('Feedbacks Today', metrics.feedbacksToday, p?.feedbacksToday)}

              <!-- Revenue -->
              <tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">Revenue</td></tr>
              ${weekRow('New Subscriptions', metrics.newSubscriptions, p?.newSubscriptions)}
              ${weekRow('Cancellations', metrics.cancellations, p?.cancellations)}
              ${weekRow('Renewals', metrics.renewals, p?.renewals)}

              <!-- Community -->
              <tr><td colspan="3" style="padding:12px 12px 4px;font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;">Community</td></tr>
              ${weekRow('Comparison Posts', metrics.comparisonPosts, p?.comparisonPosts)}
              ${weekRow('Live Sessions', metrics.liveSessions, p?.liveSessions)}
              ${weekRow('Users with Streak', metrics.usersWithStreak, p?.usersWithStreak)}

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F5EDE7;padding:20px 40px;text-align:center;margin-top:24px;">
            <div style="font-size:12px;color:#6B7280;">Or This? · Weekly report · Generated ${new Date().toISOString()}</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDailyDigest(): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[EmailReport] RESEND_API_KEY not set — skipping daily digest');
    return;
  }
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!recipient) {
    console.warn('[EmailReport] REPORT_RECIPIENT_EMAIL not set — skipping daily digest');
    return;
  }
  const from = process.env.REPORT_FROM_EMAIL || 'metrics@orthis.app';

  const metrics = await getMetricsSnapshot();
  await storeDailySnapshot(metrics);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  await resend.emails.send({
    from,
    to: recipient,
    subject: `Or This? Daily Digest — ${dateStr} | ${metrics.dau} DAU, ${metrics.checksToday} checks`,
    html: buildDailyHtml(metrics),
  });

  console.log(`✅ [EmailReport] Daily digest sent to ${recipient}`);
}

export async function sendWeeklyDigest(): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[EmailReport] RESEND_API_KEY not set — skipping weekly digest');
    return;
  }
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!recipient) {
    console.warn('[EmailReport] REPORT_RECIPIENT_EMAIL not set — skipping weekly digest');
    return;
  }
  const from = process.env.REPORT_FROM_EMAIL || 'metrics@orthis.app';

  const metrics = await getMetricsSnapshot();

  // Get last week's snapshot for delta comparison
  const history = await getSnapshotHistory(14);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  // Find snapshot closest to 7 days ago
  let prevSnapshot = history.find(s => {
    const d = new Date(s.date);
    return Math.abs(d.getTime() - sevenDaysAgo.getTime()) < 24 * 60 * 60 * 1000;
  }) ?? null;

  // Convert snapshot to MetricsSnapshot shape for comparison
  let prevMetrics: MetricsSnapshot | null = null;
  if (prevSnapshot) {
    prevMetrics = {
      generatedAt: new Date(prevSnapshot.date),
      totalUsers: prevSnapshot.totalUsers,
      newUsersToday: prevSnapshot.newUsersToday,
      freeUsers: prevSnapshot.freeUsers,
      plusUsers: prevSnapshot.plusUsers,
      proUsers: prevSnapshot.proUsers,
      dau: prevSnapshot.dau,
      wau: prevSnapshot.wau,
      checksToday: prevSnapshot.checksToday,
      feedbacksToday: prevSnapshot.feedbacksToday,
      avgAiScore: prevSnapshot.avgAiScore,
      usersWithStreak: prevSnapshot.usersWithStreak,
      avgStreak: prevSnapshot.avgStreak,
      newSubscriptions: prevSnapshot.newSubscriptions,
      cancellations: prevSnapshot.cancellations,
      renewals: prevSnapshot.renewals,
      comparisonPosts: prevSnapshot.comparisonPosts,
      liveSessions: prevSnapshot.liveSessions,
      retention7d: null,
      expertReviewsPending: 0,
      avgCommunityScore: null,
    };
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  await resend.emails.send({
    from,
    to: recipient,
    subject: `Or This? Weekly Report — ${dateStr} | ${metrics.totalUsers.toLocaleString()} total users`,
    html: buildWeeklyHtml(metrics, prevMetrics),
  });

  console.log(`✅ [EmailReport] Weekly digest sent to ${recipient}`);
}
