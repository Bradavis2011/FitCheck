import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';

interface ViralMetrics {
  publicOutfits: number;
  totalOutfits: number;
  publicPct: number;
  sharesPast7d: number;
  sharesPrior7d: number;
  weekOverWeekTrend: number | null;
  viralCoefficient: number | null;
  topSharedStyles: string[];
}

async function getViralMetrics(): Promise<ViralMetrics> {
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ago14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [totalOutfits, publicOutfits, sharesPast7d, sharesPrior7d] = await Promise.all([
    prisma.outfitCheck.count({ where: { isDeleted: false } }),
    prisma.outfitCheck.count({ where: { isDeleted: false, isPublic: true } }),
    prisma.outfitCheck.count({ where: { isDeleted: false, isPublic: true, createdAt: { gte: ago7d } } }),
    prisma.outfitCheck.count({ where: { isDeleted: false, isPublic: true, createdAt: { gte: ago14d, lt: ago7d } } }),
  ]);

  const publicPct = totalOutfits > 0 ? Math.round((publicOutfits / totalOutfits) * 100) : 0;
  const weekOverWeekTrend = sharesPrior7d > 0
    ? Math.round(((sharesPast7d - sharesPrior7d) / sharesPrior7d) * 100)
    : null;

  let topSharedStyles: string[] = [];
  try {
    const publicDna = await prisma.styleDNA.findMany({
      where: { outfitCheck: { isPublic: true, isDeleted: false, createdAt: { gte: ago7d } } },
      select: { styleArchetypes: true },
      take: 100,
    });
    const counts = new Map<string, number>();
    for (const dna of publicDna) {
      for (const s of dna.styleArchetypes) counts.set(s, (counts.get(s) || 0) + 1);
    }
    topSharedStyles = [...counts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
  } catch {}

  const activeUsers = await prisma.outfitCheck.findMany({
    where: { createdAt: { gte: ago7d }, isDeleted: false },
    select: { userId: true },
    distinct: ['userId'],
  });
  const activeCount = activeUsers.length;
  const viralCoefficient = activeCount > 0
    ? Math.round((sharesPast7d / activeCount) * 100) / 100
    : null;

  return { publicOutfits, totalOutfits, publicPct, sharesPast7d, sharesPrior7d, weekOverWeekTrend, viralCoefficient, topSharedStyles };
}

function buildViralMonitorEmail(m: ViralMetrics): string {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const trendHtml = m.weekOverWeekTrend != null
    ? m.weekOverWeekTrend > 0
      ? `<span style="color:#10B981;font-size:13px;">▲ ${m.weekOverWeekTrend}% vs last week</span>`
      : m.weekOverWeekTrend < 0
        ? `<span style="color:#EF4444;font-size:13px;">▼ ${Math.abs(m.weekOverWeekTrend)}% vs last week</span>`
        : `<span style="color:#6B7280;font-size:13px;">→ Flat vs last week</span>`
    : '';

  const insight = m.publicPct < 20
    ? `💡 Only ${m.publicPct}% of outfits are public. Consider prompting users to share after high-scoring (8+) analyses.`
    : m.publicPct > 40
      ? `✅ Strong sharing rate at ${m.publicPct}%! Your users are engaged and proud of their looks.`
      : `📊 Moderate sharing at ${m.publicPct}%. A "Share your score" CTA after analysis could boost virality.`;

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Viral Loop Monitor — ${dateStr}</div>
      </div>
      <div style="padding:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.sharesPast7d}</div>
                <div style="margin-top:4px;">${trendHtml}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Public Outfits (7d)</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.publicPct}%</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Share Rate (all time)</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.viralCoefficient != null ? m.viralCoefficient : '—'}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Viral Coefficient</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:14px;font-weight:700;color:#1A1A1A;">${m.topSharedStyles.length > 0 ? m.topSharedStyles.join(', ') : '—'}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Top Shared Styles</div>
              </div>
            </td>
          </tr>
        </table>
        <div style="background:#FBF7F4;border-radius:10px;padding:16px 20px;border-left:4px solid #A8B5A0;">
          <div style="font-size:14px;color:#2D2D2D;">${insight}</div>
        </div>
      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · Viral Loop Monitor · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runViralMonitor(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[ViralMonitor] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const metrics = await getViralMetrics();
    const from = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Viral Monitor — ${metrics.sharesPast7d} public outfits, ${metrics.publicPct}% share rate`,
      html: buildViralMonitorEmail(metrics),
    });
    console.log('✅ [ViralMonitor] Sent viral metrics report');
  } catch (err) {
    console.error('[ViralMonitor] Failed:', err);
  }
}
