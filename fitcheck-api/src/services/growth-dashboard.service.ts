import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';

interface GrowthMetrics {
  newSignups24h: number;
  newSignups7d: number;
  newSignupsTrend: number;
  signupToFirstOutfit: number;
  retention1d: number | null;
  retention7d: number | null;
  dauWauRatio: number | null;
  dau: number;
  wau: number;
  totalUsers: number;
}

async function getGrowthMetrics(): Promise<GrowthMetrics> {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ago14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    newSignups24h,
    newSignups48hTo24h,
    newSignups7d,
    usersWithOutfitCheck,
    usersActiveToday,
    usersActiveWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: ago24h } } }),
    prisma.user.count({ where: { createdAt: { gte: ago48h, lt: ago24h } } }),
    prisma.user.count({ where: { createdAt: { gte: ago7d } } }),
    prisma.user.count({ where: { outfitChecks: { some: {} } } }),
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: todayStart }, isDeleted: false },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: ago7d }, isDeleted: false },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const dau = usersActiveToday.length;
  const wau = usersActiveWeek.length;

  const signupToFirstOutfit = totalUsers > 0
    ? Math.round((usersWithOutfitCheck / totalUsers) * 100)
    : 0;

  const newSignupsTrend = newSignups48hTo24h > 0
    ? Math.round(((newSignups24h - newSignups48hTo24h) / newSignups48hTo24h) * 100)
    : 0;

  let retention1d: number | null = null;
  try {
    const yesterdaySignups = await prisma.user.findMany({
      where: { createdAt: { gte: ago48h, lt: ago24h } },
      select: { id: true },
    });
    if (yesterdaySignups.length > 0) {
      const ids = yesterdaySignups.map(u => u.id);
      const activeToday = await prisma.outfitCheck.findMany({
        where: { userId: { in: ids }, createdAt: { gte: todayStart }, isDeleted: false },
        select: { userId: true },
        distinct: ['userId'],
      });
      retention1d = Math.round((activeToday.length / yesterdaySignups.length) * 100);
    }
  } catch {}

  let retention7d: number | null = null;
  try {
    const ago8d = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const cohort = await prisma.user.findMany({
      where: { createdAt: { gte: ago14d, lt: ago8d } },
      select: { id: true },
    });
    if (cohort.length > 0) {
      const ids = cohort.map(u => u.id);
      const retained = await prisma.outfitCheck.findMany({
        where: { userId: { in: ids }, createdAt: { gte: ago7d }, isDeleted: false },
        select: { userId: true },
        distinct: ['userId'],
      });
      retention7d = Math.round((retained.length / cohort.length) * 100);
    }
  } catch {}

  return {
    newSignups24h,
    newSignups7d,
    newSignupsTrend,
    signupToFirstOutfit,
    retention1d,
    retention7d,
    dauWauRatio: wau > 0 ? Math.round((dau / wau) * 100) : null,
    dau,
    wau,
    totalUsers,
  };
}

function trendArrow(pct: number): string {
  if (pct > 5) return `<span style="color:#10B981;">▲ ${pct}%</span>`;
  if (pct < -5) return `<span style="color:#EF4444;">▼ ${Math.abs(pct)}%</span>`;
  return `<span style="color:#6B7280;">→ ${pct}%</span>`;
}

function card(label: string, value: string, noteHtml = '', width = '33%'): string {
  return `<td style="padding:6px 4px;" width="${width}">
    <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${value} ${noteHtml}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:4px;">${label}</div>
    </div>
  </td>`;
}

function buildGrowthDashboardEmail(m: GrowthMetrics): string {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const convColor = m.signupToFirstOutfit >= 50 ? '#10B981' : m.signupToFirstOutfit >= 30 ? '#F59E0B' : '#EF4444';
  const r1Color = (m.retention1d ?? 0) >= 30 ? '#10B981' : '#F59E0B';
  const r7Color = (m.retention7d ?? 0) >= 20 ? '#10B981' : '#F59E0B';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Daily Growth Dashboard</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:8px;">${dateStr}</div>
      </div>
      <div style="padding:32px 40px;">

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Acquisition</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
          ${card('New Today', String(m.newSignups24h), trendArrow(m.newSignupsTrend))}
          ${card('New (7 days)', String(m.newSignups7d))}
          ${card('Total Users', m.totalUsers.toLocaleString())}
        </tr></table>

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Funnel</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
          <td style="padding:6px 4px;" width="50%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${convColor};">${m.signupToFirstOutfit}%</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Signup → First Outfit</div>
            </div>
          </td>
          <td style="padding:6px 4px;" width="50%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.dauWauRatio != null ? m.dauWauRatio + '%' : '—'}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">DAU/WAU Ratio</div>
            </div>
          </td>
        </tr></table>

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Retention</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${r1Color};">${m.retention1d != null ? m.retention1d + '%' : '—'}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Day 1 Retention</div>
            </div>
          </td>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${r7Color};">${m.retention7d != null ? m.retention7d + '%' : '—'}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Day 7 Retention</div>
            </div>
          </td>
          <td style="padding:6px 4px;" width="33%">
            <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.dau} / ${m.wau}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">DAU / WAU</div>
            </div>
          </td>
        </tr></table>

      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · Growth Dashboard Agent · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runGrowthDashboard(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[GrowthDashboard] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const metrics = await getGrowthMetrics();
    const from = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Growth — ${dateStr} | ${metrics.newSignups24h} new users, ${metrics.signupToFirstOutfit}% converted`,
      html: buildGrowthDashboardEmail(metrics),
    });

    console.log('✅ [GrowthDashboard] Sent growth dashboard');
  } catch (err) {
    console.error('[GrowthDashboard] Failed:', err);
  }
}

// Export for founder brief
export async function getGrowthSummary(): Promise<GrowthMetrics> {
  return getGrowthMetrics();
}
