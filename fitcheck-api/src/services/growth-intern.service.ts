/**
 * Growth Intern — Daily morning brief assembly
 *
 * Cron: Daily 12pm UTC (8am ET)
 * Sends one email with everything the founder needs for ~25 min of growth work.
 *
 * Sections:
 *   1. Comment on These Creators (~5 min) — warming comments, pre-written, "Mark Commented"
 *   2. DM These Creators (~5 min) — warmed only (2+ comments), commission pitch
 *   3. Today's TikTok Idea (~5 min to think)
 *   4. Auto-Pilot Status (0 min — FYI) — Reddit karma, creator funnel, channels
 */

import { Resend } from 'resend';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const BASE_URL = process.env.API_BASE_URL || 'https://fitcheck-production-0f92.up.railway.app';
const _hmacSecret = process.env.FOLLOW_UP_HMAC_SECRET;
if (!_hmacSecret) {
  throw new Error('[growth-intern.service] FOLLOW_UP_HMAC_SECRET env var must be set');
}
const HMAC_SECRET: string = _hmacSecret;

// ─── HMAC Token Helpers ───────────────────────────────────────────────────────

export function generateGrowthToken(id: string, action: string): string {
  return createHmac('sha256', HMAC_SECRET).update(`${id}:${action}`).digest('hex');
}

export function verifyGrowthToken(id: string, action: string, token: string): boolean {
  const expected = generateGrowthToken(id, action);
  try {
    const tokenBuf = Buffer.from(token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch { return false; }
}

// ─── Platform Deep Links ──────────────────────────────────────────────────────

function profileLink(platform: string, handle: string): string {
  switch (platform.toLowerCase()) {
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'lemon8': return `https://www.lemon8-app.com/@${handle}`;
    case 'threads': return `https://threads.net/@${handle}`;
    default: return `https://${platform}.com/@${handle}`;
  }
}

function platformEmoji(platform: string): string {
  const map: Record<string, string> = {
    tiktok: '🎵',
    instagram: '📸',
    youtube: '▶️',
    lemon8: '🍋',
    threads: '🧵',
  };
  return map[platform.toLowerCase()] || '📱';
}

// ─── TikTok Idea Generation ───────────────────────────────────────────────────

async function generateTikTokIdea(): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('no key');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `Generate ONE specific TikTok video idea for "Or This?" — an AI outfit scoring app.

Format:
Hook: [scroll-stopping first line, under 10 words]
Concept: [what to film, 2-3 sentences]
Caption: [TikTok caption with emojis, under 100 chars]
Hashtags: [5-7 hashtags]

Ideas should leverage:
- The AI score reveal moment (the most viral format)
- Personal/authentic founder content
- Trending fashion challenges adapted for outfit scoring
- Before/after outfit transformations

Return just the formatted content, no JSON:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `Hook: "I asked AI to rate my outfit and this happened"
Concept: Film your outfit of the day, submit it to Or This? AI, and show the score reveal in real time. React to the feedback authentically — whether good or bad, it makes great content.
Caption: POV: AI scored my outfit 🤖👗 #outfitcheck #fashionai #ootd
Hashtags: #outfitcheck #fashionai #ootd #orThis #stylecheck #AIoutfit #fashiontok`;
  }
}

// ─── Data Gathering ───────────────────────────────────────────────────────────

async function getPipelineStats() {
  const [statusCounts, emailStats, redditStats, twitterStats] = await Promise.all([
    // Prospect pipeline by status
    prisma.creatorProspect.groupBy({
      by: ['status', 'outreachMethod'],
      _count: { id: true },
    }),

    // Email performance
    prisma.creatorProspect.aggregate({
      _count: {
        id: true,
        emailOpenedAt: true,
        emailClickedAt: true,
      },
      where: { outreachMethod: 'email', status: { not: 'identified' } },
    }),

    // Reddit performance
    prisma.redditThread.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Twitter (social posts)
    prisma.socialPost.count({
      where: {
        platform: 'twitter',
        status: 'posted',
        postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const pipelineByStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    pipelineByStatus[row.status] = (pipelineByStatus[row.status] || 0) + row._count.id;
  }

  const redditByStatus: Record<string, number> = {};
  for (const row of redditStats) {
    redditByStatus[row.status] = row._count.id;
  }

  return { pipelineByStatus, emailStats, redditByStatus, twitterStats };
}

// ─── Email HTML Assembly ──────────────────────────────────────────────────────

function buildMorningBriefHtml(sections: {
  dmProspects: any[];          // top 5 dm-track prospects (warmed first, then unwarmed)
  redditPostedYesterday: any[];
  redditForManual: any[];
  tikTokIdea: string;
  pipeline: Record<string, number>;
  twitterPostsThisWeek: number;
  emailsSentYesterday: number;
  emailFollowUpsSent: number;
  redditKarmaHealth: { avgKarma: number; authorRepliedRate: number };
  newOnboarded: number;        // creators self-onboarded in last 24h
  creatorSignupUrl: string;    // orthis.app/creator or fallback
}): string {
  const {
    dmProspects, redditPostedYesterday, redditForManual,
    tikTokIdea, pipeline, twitterPostsThisWeek,
    emailsSentYesterday, emailFollowUpsSent, redditKarmaHealth,
    newOnboarded, creatorSignupUrl,
  } = sections;

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Section 1: DM These 5 Creators — combined comment + DM card, one "Mark Done" click
  const dmSection = dmProspects.length > 0
    ? dmProspects.map(p => {
        const profileUrl = profileLink(p.platform, p.handle);
        const doneUrl = `${BASE_URL}/g/prospect/${p.id}/done?t=${generateGrowthToken(p.id, 'done')}`;
        const isWarmed = (p.commentsPosted || 0) >= 2;

        const comments = p.warmingComments
          ? p.warmingComments.split('|').map((c: string) => c.trim()).filter(Boolean)
          : [];
        const commentBlock = comments.length > 0
          ? `<div style="margin-bottom:10px;">
              <div style="font-size:10px;letter-spacing:1.5px;color:#A8B5A0;font-weight:600;margin-bottom:6px;">WARMING COMMENT — post on their latest video</div>
              ${comments.slice(0, 1).map((c: string) => `
                <div style="background:#fff;border-left:3px solid #A8B5A0;padding:10px 14px;font-size:13px;color:#2D2D2D;line-height:1.5;font-family:monospace;">
                  ${c}
                </div>`).join('')}
            </div>`
          : '';

        const dmText = p.personalizedDM || 'DM not generated yet';
        // Append self-serve URL to DM text so Brandon sees it when copy-pasting
        const dmWithUrl = dmText.includes('orthis.app') ? dmText
          : `${dmText}\n\n[Or they can self-sign at: ${creatorSignupUrl}]`;

        return `
        <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:14px;">
            <span style="font-size:18px;margin-right:8px;">${platformEmoji(p.platform)}</span>
            <a href="${profileUrl}" style="color:#E85D4C;font-weight:700;font-size:15px;text-decoration:none;">@${p.handle}</a>
            ${p.followerRange ? `<span style="margin-left:8px;background:#E85D4C;color:white;font-size:11px;padding:2px 8px;border-radius:12px;">${p.followerRange}</span>` : ''}
            ${p.niche ? `<span style="margin-left:6px;color:#6B7280;font-size:12px;">${p.niche}</span>` : ''}
            ${isWarmed ? `<span style="margin-left:auto;background:#10B981;color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">WARMED ✓</span>` : `<span style="margin-left:auto;color:#A8B5A0;font-size:11px;">${p.commentsPosted || 0}/2 comments</span>`}
          </div>
          ${commentBlock}
          <div style="margin-bottom:12px;">
            <div style="font-size:10px;letter-spacing:1.5px;color:#E85D4C;font-weight:600;margin-bottom:6px;">DM — paste into ${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}</div>
            <div style="background:#fff;border-left:3px solid #E85D4C;padding:10px 14px;font-size:13px;color:#2D2D2D;line-height:1.5;font-family:monospace;">
              ${dmWithUrl.replace(/\n/g, '<br>')}
            </div>
          </div>
          <a href="${doneUrl}" style="display:inline-block;background:#E85D4C;color:white;text-decoration:none;padding:10px 20px;font-size:12px;font-weight:700;letter-spacing:0.5px;">
            ✓ MARK DONE (commented + DMed)
          </a>
          <a href="${profileUrl}" style="display:inline-block;margin-left:8px;border:1px solid #E85D4C;color:#E85D4C;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:600;">
            Open Profile →
          </a>
        </div>`;
      }).join('')
    : '<p style="color:#6B7280;font-style:italic;">No DM-track prospects today — email outreach is running automatically</p>';

  // Section 3: Reddit (auto-pilot block for "What Happened Overnight")
  const redditBlock = (() => {
    if (redditPostedYesterday.length > 0) {
      return redditPostedYesterday.map(t => `
        <div style="border-bottom:1px solid #F5EDE7;padding:10px 0;">
          <span style="font-size:11px;color:#FF6314;font-weight:600;">r/${t.subreddit}</span>
          <a href="${t.url}" style="display:block;color:#2D2D2D;font-size:13px;text-decoration:none;margin-top:2px;">${t.title.slice(0, 80)}</a>
        </div>`).join('');
    }
    if (redditForManual.length > 0) {
      return redditForManual.map(t => {
        const postedUrl = `${BASE_URL}/g/thread/${t.id}/posted?t=${generateGrowthToken(t.id, 'posted')}`;
        return `
          <div style="background:#fff;border-left:3px solid #FF6314;padding:10px 14px;margin-bottom:8px;">
            <div style="font-size:11px;color:#FF6314;font-weight:600;margin-bottom:4px;">r/${t.subreddit} — manual</div>
            <a href="${t.url}" style="color:#1A1A1A;font-size:13px;text-decoration:none;">${t.title.slice(0, 80)}</a>
            <div style="background:#F5EDE7;padding:8px 10px;font-size:12px;color:#2D2D2D;line-height:1.5;margin:8px 0;font-family:monospace;">
              ${(t.suggestedResponse || '').slice(0, 200)}
            </div>
            <a href="${postedUrl}" style="font-size:11px;color:#A8B5A0;text-decoration:none;">✓ Mark Posted</a>
            &nbsp;·&nbsp;
            <a href="${t.url}" style="font-size:11px;color:#A8B5A0;text-decoration:none;">Open Thread</a>
          </div>`;
      }).join('');
    }
    return '<p style="color:#6B7280;font-size:13px;">No Reddit posts today</p>';
  })();

  // Pipeline funnel (compact, for Section 3)
  const pipelineRows = [
    { label: 'Pipeline total', status: 'dm_ready' },
    { label: 'Contacted', status: 'contacted' },
    { label: 'Onboarded', status: 'onboarded' },
    { label: 'Posted content', status: 'posted' },
  ].map(({ label, status }) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#6B7280;">${label}</td>
      <td style="padding:8px 0;font-size:13px;font-weight:700;color:#E85D4C;text-align:right;">${pipeline[status] || 0}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:32px 0;">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">

      <!-- Header -->
      <tr>
        <td style="background:#1A1A1A;padding:28px 40px;text-align:center;">
          <div style="font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:8px;">OR THIS? · GROWTH INTERN</div>
          <div style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:26px;color:#fff;">Action Brief</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;">${date}</div>
        </td>
      </tr>

      <!-- Quick Stats -->
      <tr>
        <td style="padding:20px 40px;background:#F5EDE7;">
          <table width="100%"><tr>
            <td style="text-align:center;padding:0 10px;">
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${dmProspects.length}</div>
              <div style="font-size:10px;color:#6B7280;letter-spacing:0.5px;">DMs TO SEND</div>
            </td>
            <td style="text-align:center;padding:0 10px;">
              <div style="font-size:24px;font-weight:700;color:#A8B5A0;">${emailsSentYesterday + emailFollowUpsSent}</div>
              <div style="font-size:10px;color:#6B7280;letter-spacing:0.5px;">EMAILS AUTO</div>
            </td>
            <td style="text-align:center;padding:0 10px;">
              <div style="font-size:24px;font-weight:700;color:#FF6314;">${redditPostedYesterday.length}</div>
              <div style="font-size:10px;color:#6B7280;letter-spacing:0.5px;">REDDIT AUTO</div>
            </td>
            <td style="text-align:center;padding:0 10px;">
              <div style="font-size:24px;font-weight:700;color:#10B981;">${newOnboarded}</div>
              <div style="font-size:10px;color:#6B7280;letter-spacing:0.5px;">SELF-ONBOARDED</div>
            </td>
          </tr></table>
        </td>
      </tr>

      <tr><td style="padding:32px 40px;">

        <!-- ── Section 1: DM These 5 Creators ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#E85D4C;margin-right:12px;"></div>
            <div>
              <div style="font-size:10px;letter-spacing:2px;color:#E85D4C;font-weight:700;margin-bottom:3px;">SECTION 1 · ~10 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">DM These ${Math.min(dmProspects.length, 5)} Creators</div>
            </div>
            ${dmProspects.length > 0 ? `<div style="margin-left:auto;background:#E85D4C;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;">${dmProspects.length} to do</div>` : ''}
          </div>
          <p style="font-size:12px;color:#6B7280;margin:0 0 16px;">Comment first, then paste the DM. One "Mark Done" click when both are done. Email-track creators are being contacted automatically.</p>
          ${dmSection}
        </div>

        <!-- ── Section 2: Record This TikTok ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#7C3AED;margin-right:12px;"></div>
            <div>
              <div style="font-size:10px;letter-spacing:2px;color:#7C3AED;font-weight:700;margin-bottom:3px;">SECTION 2 · ~5 MIN TO PLAN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Record This TikTok</div>
            </div>
          </div>
          <div style="background:#F5EDE7;padding:20px 24px;font-size:13px;color:#2D2D2D;line-height:1.7;white-space:pre-wrap;">${tikTokIdea}</div>
        </div>

        <!-- ── Section 3: What Happened Overnight ── -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#1A1A1A;margin-right:12px;"></div>
            <div>
              <div style="font-size:10px;letter-spacing:2px;color:#6B7280;font-weight:700;margin-bottom:3px;">SECTION 3 · 0 MIN — FYI</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">What Happened Overnight</div>
            </div>
          </div>

          <!-- Auto-pilot summary table -->
          <div style="border:1px solid #F5EDE7;margin-bottom:16px;">
            <table width="100%" style="border-collapse:collapse;">
              <tr style="background:#F5EDE7;">
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Outreach emails sent</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#A8B5A0;text-align:right;">${emailsSentYesterday}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Follow-up emails sent</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#A8B5A0;text-align:right;">${emailFollowUpsSent}</td>
              </tr>
              <tr style="background:#F5EDE7;">
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Reddit comments auto-posted</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#FF6314;text-align:right;">${redditPostedYesterday.length}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Creators self-onboarded (join link)</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#10B981;text-align:right;">${newOnboarded}</td>
              </tr>
              <tr style="background:#F5EDE7;">
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Tweets this week</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#1DA1F2;text-align:right;">${twitterPostsThisWeek}</td>
              </tr>
            </table>
          </div>

          <!-- Reddit threads -->
          ${redditPostedYesterday.length > 0 || redditForManual.length > 0 ? `
          <div style="background:#FFF9F0;border:1px solid #FED7AA;padding:16px 20px;margin-bottom:16px;">
            <div style="font-size:10px;letter-spacing:1.5px;color:#F59E0B;font-weight:700;margin-bottom:12px;">REDDIT THREADS</div>
            ${redditBlock}
            ${redditKarmaHealth.avgKarma > 0 ? `<p style="font-size:11px;color:#6B7280;margin-top:10px;">Avg karma: <strong>${redditKarmaHealth.avgKarma.toFixed(1)}</strong> · OP reply rate: <strong>${(redditKarmaHealth.authorRepliedRate * 100).toFixed(0)}%</strong></p>` : ''}
          </div>` : ''}

          <!-- Creator pipeline -->
          <div style="background:#F5EDE7;padding:16px 20px;">
            <div style="font-size:10px;letter-spacing:1.5px;color:#E85D4C;font-weight:700;margin-bottom:12px;">CREATOR PIPELINE</div>
            <table width="100%" style="border-collapse:collapse;">
              ${pipelineRows}
            </table>
            <p style="font-size:11px;color:#9CA3AF;margin-top:10px;">Creators can self-sign at: <a href="${creatorSignupUrl}" style="color:#E85D4C;">${creatorSignupUrl}</a></p>
          </div>
        </div>

      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">Or This? · Growth Intern · ${new Date().toISOString()}</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

export async function runMorningBrief(): Promise<void> {
  console.log('[GrowthIntern] Assembling morning brief...');

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  const fromEmail = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';

  if (!resend || !recipient) {
    console.log('[GrowthIntern] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    dmProspects,
    emailSentYesterdayCount,
    emailFollowUpYesterdayCount,
    redditPostedYesterday,
    redditForManual,
    redditKarmaData,
    newOnboardedCount,
    { pipelineByStatus, twitterStats },
  ] = await Promise.all([
    // Section 1: Top 5 DM-track prospects — warmed (2+ comments) first, then unwarmed
    // Ordered by commentsPosted desc so warmed ones float to top
    prisma.creatorProspect.findMany({
      where: {
        outreachMethod: 'dm',
        status: 'dm_ready',
      },
      orderBy: [{ commentsPosted: 'desc' }, { createdAt: 'asc' }],
      take: 5,
    }),

    // Emails sent yesterday
    prisma.creatorProspect.count({
      where: { outreachMethod: 'email', contactedAt: { gte: yesterday } },
    }),

    // Follow-up emails sent yesterday
    prisma.creatorProspect.count({
      where: { outreachMethod: 'email', followedUpAt: { gte: yesterday } },
    }),

    // Reddit posted yesterday
    prisma.redditThread.findMany({
      where: { status: 'posted', postedAt: { gte: yesterday } },
      orderBy: { postedAt: 'desc' },
    }),

    // Reddit threads for manual posting (approved status)
    prisma.redditThread.findMany({
      where: { status: 'approved', suggestedResponse: { not: null } },
      orderBy: { relevanceScore: 'desc' },
      take: 3,
    }),

    // Reddit karma health (posted threads in last 14 days with karma data)
    prisma.redditThread.findMany({
      where: {
        status: 'posted',
        commentKarma: { not: null },
        postedAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
      },
      select: { commentKarma: true, authorReplied: true },
      take: 50,
    }),

    // Creators self-onboarded via join link in last 24h
    prisma.creatorProspect.count({
      where: {
        status: 'onboarded',
        respondedAt: { gte: yesterday },
        notes: { contains: 'join link' },
      },
    }),

    // Pipeline stats
    getPipelineStats(),
  ]);

  // Compute Reddit karma health
  const karmaReadings = redditKarmaData.filter(t => t.commentKarma !== null);
  const redditKarmaHealth = {
    avgKarma: karmaReadings.length > 0
      ? karmaReadings.reduce((s, t) => s + (t.commentKarma ?? 0), 0) / karmaReadings.length
      : 0,
    authorRepliedRate: karmaReadings.length > 0
      ? karmaReadings.filter(t => t.authorReplied).length / karmaReadings.length
      : 0,
  };

  // Generate TikTok idea
  const tikTokIdea = await generateTikTokIdea();

  const creatorSignupUrl = process.env.CREATOR_SIGNUP_URL || 'https://orthis.app/creator';

  // Build email
  const html = buildMorningBriefHtml({
    dmProspects,
    redditPostedYesterday,
    redditForManual,
    tikTokIdea,
    pipeline: pipelineByStatus,
    twitterPostsThisWeek: twitterStats,
    emailsSentYesterday: emailSentYesterdayCount,
    emailFollowUpsSent: emailFollowUpYesterdayCount,
    redditKarmaHealth,
    newOnboarded: newOnboardedCount,
    creatorSignupUrl,
  });

  try {
    await resend.emails.send({
      from: `Or This? Growth Intern <${fromEmail}>`,
      to: recipient,
      subject: `Action Brief — ${dmProspects.length} DMs to send, ${emailSentYesterdayCount + emailFollowUpYesterdayCount} emails auto-sent`,
      html,
    });

    console.log('[GrowthIntern] Morning brief sent');
  } catch (err) {
    console.error('[GrowthIntern] Failed to send morning brief:', err);
  }

  // Publish metrics
  await publishToIntelligenceBus('growth-intern', 'growth_intern_metrics', {
    runAt: now.toISOString(),
    dmProspectsReady: dmProspects.length,
    emailsSentYesterday: emailSentYesterdayCount,
    followUpsSentYesterday: emailFollowUpYesterdayCount,
    redditPostedYesterday: redditPostedYesterday.length,
    redditAvgKarma: redditKarmaHealth.avgKarma,
    newOnboarded: newOnboardedCount,
    pipeline: pipelineByStatus,
    summary: `${dmProspects.length} DMs to send, ${emailSentYesterdayCount + emailFollowUpYesterdayCount} emails auto, ${newOnboardedCount} self-onboarded`,
  }).catch(() => {});

  console.log('[GrowthIntern] Run complete');
}

// ─── Comment Tracking ─────────────────────────────────────────────────────────

/**
 * Phase 3: Called from /g/prospect/:id/commented endpoint.
 * Increments commentsPosted + sets warmingStartedAt.
 * When commentsPosted >= 2, the prospect is considered "warmed" and appears in DM section.
 */
export async function markProspectCommented(prospectId: string): Promise<boolean> {
  try {
    const prospect = await prisma.creatorProspect.findUnique({
      where: { id: prospectId },
      select: { commentsPosted: true, warmingStartedAt: true, status: true },
    });

    if (!prospect || !['dm_ready', 'identified'].includes(prospect.status)) return false;

    const newCount = (prospect.commentsPosted || 0) + 1;

    await prisma.creatorProspect.update({
      where: { id: prospectId },
      data: {
        commentsPosted: newCount,
        warmingStartedAt: prospect.warmingStartedAt ?? new Date(),
      },
    });

    console.log(`[GrowthIntern] Marked comment for prospect ${prospectId} (${newCount} total)`);
    return true;
  } catch { return false; }
}

// ─── Mark Done (combines comment + contacted in one click) ────────────────────

/**
 * Phase 4: Single "Mark Done" action replaces separate "Mark Commented" + "Mark Contacted".
 * Sets commentsPosted ≥ 2 (warmed) AND status = contacted in one endpoint.
 */
export async function markProspectDone(prospectId: string): Promise<boolean> {
  try {
    const prospect = await prisma.creatorProspect.findUnique({
      where: { id: prospectId },
      select: { commentsPosted: true, status: true, warmingStartedAt: true },
    });

    if (!prospect || !['dm_ready', 'identified'].includes(prospect.status)) return false;

    await prisma.creatorProspect.update({
      where: { id: prospectId },
      data: {
        commentsPosted: Math.max(prospect.commentsPosted || 0, 2),
        warmingStartedAt: prospect.warmingStartedAt ?? new Date(),
        status: 'contacted',
        contactedAt: new Date(),
      },
    });

    console.log(`[GrowthIntern] Marked done (commented + contacted) for prospect ${prospectId}`);
    return true;
  } catch { return false; }
}

// ─── Stale Prospect Cleanup ───────────────────────────────────────────────────

export async function runStaleProspectCleanup(): Promise<void> {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const result = await prisma.creatorProspect.updateMany({
    where: {
      status: { in: ['dm_ready', 'identified'] },
      createdAt: { lte: tenDaysAgo },
    },
    data: { status: 'declined' },
  });

  if (result.count > 0) {
    console.log(`[GrowthIntern] Declined ${result.count} stale prospects`);
  }
}
