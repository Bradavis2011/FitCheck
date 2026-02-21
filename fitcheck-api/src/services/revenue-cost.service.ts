import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';

export interface RevenueMetrics {
  totalPaidUsers: number;
  plusUsers: number;
  proUsers: number;
  estimatedMRR: number;
  newSubscriptions7d: number;
  cancellations7d: number;
  trialToPaidConversion: number | null;
  totalOutfitChecks30d: number;
  estimatedGeminiCost: number;
  totalUsers: number;
  estimatedCostPerUser: number;
}

const PLUS_PRICE = 4.99;
const PRO_PRICE = 9.99;
// gemini-2.5-flash: ~$0.15/1M input tokens, $0.60/1M output; avg ~6000 input + ~400 output per analysis
// Real token counts now logged to PostHog via usageMetadata; update this when enough data is collected
const GEMINI_COST_PER_ANALYSIS = 0.000225; // placeholder — ~$0.15*6k/1M + $0.60*400/1M ≈ $0.00115 actual; adjust after observing PostHog data

async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    plusUsers,
    proUsers,
    newSubs7d,
    cancellations7d,
    totalOutfitChecks30d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { tier: 'plus' } }),
    prisma.user.count({ where: { tier: 'pro' } }),
    prisma.subscriptionEvent.count({
      where: { processedAt: { gte: ago7d }, eventType: { in: ['INITIAL_PURCHASE', 'initial_purchase'] } },
    }),
    prisma.subscriptionEvent.count({
      where: { processedAt: { gte: ago7d }, eventType: { in: ['CANCELLATION', 'cancellation'] } },
    }),
    prisma.outfitCheck.count({ where: { createdAt: { gte: ago30d }, isDeleted: false } }),
  ]);

  const estimatedMRR = (plusUsers * PLUS_PRICE) + (proUsers * PRO_PRICE);
  const estimatedGeminiCost = totalOutfitChecks30d * GEMINI_COST_PER_ANALYSIS;
  const estimatedCostPerUser = totalUsers > 0 ? estimatedGeminiCost / totalUsers : 0;

  let trialToPaidConversion: number | null = null;
  try {
    const newUsers7d = await prisma.user.count({ where: { createdAt: { gte: ago7d } } });
    trialToPaidConversion = newUsers7d > 0 ? Math.round((newSubs7d / newUsers7d) * 100) : null;
  } catch {}

  return {
    totalPaidUsers: plusUsers + proUsers,
    plusUsers,
    proUsers,
    estimatedMRR,
    newSubscriptions7d: newSubs7d,
    cancellations7d,
    trialToPaidConversion,
    totalOutfitChecks30d,
    estimatedGeminiCost,
    totalUsers,
    estimatedCostPerUser,
  };
}

function buildRevenueCostEmail(m: RevenueMetrics): string {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const convColor = m.trialToPaidConversion !== null
    ? (m.trialToPaidConversion >= 5 ? '#10B981' : '#F59E0B')
    : '#6B7280';
  const isProfitable = m.estimatedMRR > m.estimatedGeminiCost;

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Weekly Revenue & Cost Report — ${dateStr}</div>
      </div>
      <div style="padding:32px 40px;">

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Revenue</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:6px 4px;" width="33%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#10B981;">$${m.estimatedMRR.toFixed(0)}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Est. MRR</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="33%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${m.plusUsers}P / ${m.proUsers}Pro</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Paid Subscribers</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="33%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:${convColor};">${m.trialToPaidConversion != null ? m.trialToPaidConversion + '%' : '—'}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Trial→Paid (7d)</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#10B981;">+${m.newSubscriptions7d}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">New Subs (7d)</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:${m.cancellations7d > 0 ? '#EF4444' : '#10B981'};">-${m.cancellations7d}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Cancellations (7d)</div>
              </div>
            </td>
          </tr>
        </table>

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Estimated AI Costs (30 days)</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">$${m.estimatedGeminiCost.toFixed(2)}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Gemini API (${m.totalOutfitChecks30d} analyses)</div>
              </div>
            </td>
            <td style="padding:6px 4px;" width="50%">
              <div style="background:#FBF7F4;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#1A1A1A;">$${m.estimatedCostPerUser.toFixed(4)}</div>
                <div style="font-size:11px;color:#6B7280;margin-top:4px;">Cost Per User</div>
              </div>
            </td>
          </tr>
        </table>

        <div style="background:#FBF7F4;border-radius:10px;padding:16px 20px;border-left:4px solid ${isProfitable ? '#10B981' : '#EF4444'};">
          <div style="font-size:14px;font-weight:600;color:#1A1A1A;">
            ${isProfitable
              ? `✅ Profitable: MRR ($${m.estimatedMRR.toFixed(0)}) exceeds AI costs ($${m.estimatedGeminiCost.toFixed(2)})`
              : `⚠️ AI costs ($${m.estimatedGeminiCost.toFixed(2)}) exceed MRR ($${m.estimatedMRR.toFixed(0)}) — focus on subscription growth`
            }
          </div>
        </div>

      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · Revenue & Cost Tracker · Estimates only · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runRevenueCostTracker(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[RevenueCost] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  try {
    const metrics = await getRevenueMetrics();
    const from = process.env.REPORT_FROM_EMAIL || 'metrics@orthis.app';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Revenue — ${dateStr} | MRR $${metrics.estimatedMRR.toFixed(0)}, ${metrics.totalPaidUsers} paid`,
      html: buildRevenueCostEmail(metrics),
    });

    console.log('✅ [RevenueCost] Sent revenue & cost report');
  } catch (err) {
    console.error('[RevenueCost] Failed:', err);
  }
}

// Export for founder brief
export async function getRevenueSummary(): Promise<RevenueMetrics> {
  return getRevenueMetrics();
}
