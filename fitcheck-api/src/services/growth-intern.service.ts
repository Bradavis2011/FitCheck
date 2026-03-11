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

function generateGrowthToken(id: string, action: string): string {
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
  commentProspects: any[];
  dmProspects: any[]; // warmed (2+ comments) only
  redditPostedYesterday: any[];
  redditForManual: any[];
  tikTokIdea: string;
  pipeline: Record<string, number>;
  redditByStatus: Record<string, number>;
  twitterPostsThisWeek: number;
  emailsSentYesterday: number;
  emailFollowUpsSent: number;
  redditKarmaHealth: { avgKarma: number; authorRepliedRate: number };
}): string {
  const {
    commentProspects, dmProspects, redditPostedYesterday, redditForManual,
    tikTokIdea, pipeline, redditByStatus, twitterPostsThisWeek,
    emailsSentYesterday, emailFollowUpsSent, redditKarmaHealth,
  } = sections;

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Section 1: Comment on These Creators (warming)
  const commentSection = commentProspects.length > 0
    ? commentProspects.map(p => {
        const profileUrl = profileLink(p.platform, p.handle);
        const commentedUrl = `${BASE_URL}/g/prospect/${p.id}/commented?t=${generateGrowthToken(p.id, 'commented')}`;
        const comments = p.warmingComments
          ? p.warmingComments.split('|').map((c: string) => c.trim()).filter(Boolean)
          : [];
        const commentsHtml = comments.length > 0
          ? comments.map((c: string, i: number) => `
            <div style="background:#fff;border-left:3px solid #A8B5A0;padding:10px 14px;font-size:13px;color:#2D2D2D;line-height:1.5;font-family:monospace;margin-bottom:8px;">
              <span style="color:#A8B5A0;font-size:11px;font-weight:600;">COMMENT ${i + 1}:</span><br>${c}
            </div>`).join('')
          : '<p style="color:#9CA3AF;font-size:12px;margin:0;">No pre-written comments — leave a genuine, specific observation about their style</p>';

        return `
        <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:12px;">
            <span style="font-size:20px;margin-right:8px;">${platformEmoji(p.platform)}</span>
            <a href="${profileUrl}" style="color:#E85D4C;font-weight:700;font-size:15px;text-decoration:none;">@${p.handle}</a>
            ${p.followerRange ? `<span style="margin-left:8px;background:#A8B5A0;color:white;font-size:11px;padding:2px 8px;border-radius:12px;">${p.followerRange}</span>` : ''}
            ${p.niche ? `<span style="margin-left:6px;color:#6B7280;font-size:12px;">${p.niche}</span>` : ''}
            <span style="margin-left:auto;color:#A8B5A0;font-size:11px;font-weight:600;">${p.commentsPosted || 0}/2 comments done</span>
          </div>
          ${commentsHtml}
          <a href="${commentedUrl}" style="display:inline-block;background:#A8B5A0;color:white;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            ✓ Mark Commented
          </a>
          <a href="${profileUrl}" style="display:inline-block;margin-left:8px;border:1px solid #A8B5A0;color:#A8B5A0;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            Open Profile →
          </a>
        </div>`;
      }).join('')
    : '<p style="color:#6B7280;font-style:italic;">No prospects need warming today</p>';

  // Section 2: DM These Creators (warmed only — 2+ comments)
  const dmSection = dmProspects.length > 0
    ? dmProspects.map(p => {
        const profileUrl = profileLink(p.platform, p.handle);
        const contactedUrl = `${BASE_URL}/g/prospect/${p.id}/contacted?t=${generateGrowthToken(p.id, 'contacted')}`;

        return `
        <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:12px;">
            <span style="font-size:20px;margin-right:8px;">${platformEmoji(p.platform)}</span>
            <a href="${profileUrl}" style="color:#E85D4C;font-weight:700;font-size:15px;text-decoration:none;">
              @${p.handle}
            </a>
            ${p.followerRange ? `<span style="margin-left:8px;background:#E85D4C;color:white;font-size:11px;padding:2px 8px;border-radius:12px;">${p.followerRange}</span>` : ''}
            ${p.niche ? `<span style="margin-left:6px;color:#6B7280;font-size:12px;">${p.niche}</span>` : ''}
            <span style="margin-left:auto;background:#10B981;color:white;font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;">WARMED ✓</span>
          </div>
          <div style="background:#fff;border-left:3px solid #E85D4C;padding:12px 16px;font-size:13px;color:#2D2D2D;line-height:1.5;font-family:monospace;margin-bottom:12px;">
            ${(p.personalizedDM || 'DM not generated yet').replace(/\n/g, '<br>')}
          </div>
          <a href="${contactedUrl}" style="display:inline-block;background:#E85D4C;color:white;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            ✓ Mark Contacted
          </a>
          <a href="${profileUrl}" style="display:inline-block;margin-left:8px;border:1px solid #E85D4C;color:#E85D4C;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            Open Profile →
          </a>
        </div>`;
      }).join('')
    : '<p style="color:#6B7280;font-style:italic;">No warmed prospects ready to DM today — keep commenting in Section 1</p>';

  // Section 3: Reddit
  const redditSection = (() => {
    if (redditPostedYesterday.length > 0) {
      return redditPostedYesterday.map(t => `
        <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
          <div style="font-size:12px;color:#E85D4C;font-weight:600;margin-bottom:4px;">r/${t.subreddit}</div>
          <a href="${t.url}" style="color:#1A1A1A;font-size:14px;text-decoration:none;font-weight:500;">${t.title.slice(0, 100)}</a>
        </div>`).join('');
    }
    if (redditForManual.length > 0) {
      return `<p style="color:#6B7280;font-size:13px;margin-bottom:12px;">Reddit not configured — here are threads for manual posting:</p>` +
        redditForManual.map(t => {
          const postedUrl = `${BASE_URL}/g/thread/${t.id}/posted?t=${generateGrowthToken(t.id, 'posted')}`;
          return `
          <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
            <div style="font-size:12px;color:#E85D4C;font-weight:600;margin-bottom:4px;">r/${t.subreddit}</div>
            <a href="${t.url}" style="color:#1A1A1A;font-size:14px;text-decoration:none;font-weight:500;">${t.title.slice(0, 100)}</a>
            <div style="background:#fff;border-left:3px solid #A8B5A0;padding:10px 14px;font-size:12px;color:#2D2D2D;line-height:1.5;margin:10px 0;">
              ${(t.suggestedResponse || '').slice(0, 300)}
            </div>
            <a href="${postedUrl}" style="display:inline-block;background:#A8B5A0;color:white;text-decoration:none;padding:6px 14px;border-radius:4px;font-size:11px;font-weight:600;">✓ Mark Posted</a>
            <a href="${t.url}" style="display:inline-block;margin-left:6px;border:1px solid #A8B5A0;color:#A8B5A0;text-decoration:none;padding:6px 14px;border-radius:4px;font-size:11px;">Open Thread →</a>
          </div>`;
        }).join('');
    }
    return '<p style="color:#6B7280;font-style:italic;">No Reddit threads ready today</p>';
  })();

  // Pipeline funnel summary (for Section 4)
  const pipelineRows = [
    { label: 'Discovered', status: 'identified' },
    { label: 'Ready to Contact', status: 'dm_ready' },
    { label: 'Contacted', status: 'contacted' },
    { label: 'Followed Up', status: 'followed_up' },
    { label: 'Responded', status: 'responded' },
    { label: 'Onboarded', status: 'onboarded' },
    { label: 'Posted Content', status: 'posted' },
  ].map(({ label, status }) => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#2D2D2D;">${label}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#E85D4C;text-align:right;">${pipeline[status] || 0}</td>
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
          <div style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:26px;color:#fff;">Morning Brief</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;">${date}</div>
        </td>
      </tr>

      <!-- Quick Stats -->
      <tr>
        <td style="padding:20px 40px;background:#F5EDE7;">
          <table width="100%"><tr>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#A8B5A0;">${commentProspects.length}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">TO COMMENT</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${dmProspects.length}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">WARMED DMs</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#FF6314;">${redditPostedYesterday.length}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">REDDIT POSTED</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#6B7280;">${emailsSentYesterday + emailFollowUpsSent}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">EMAILS AUTO</div>
            </td>
          </tr></table>
        </td>
      </tr>

      <tr><td style="padding:32px 40px;">

        <!-- ── Section 1: Comment on These Creators ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:20px;">
            <div style="width:3px;height:20px;background:#A8B5A0;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#A8B5A0;font-weight:600;margin-bottom:2px;">SECTION 1 · ~5 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Comment on These Creators</div>
            </div>
            ${commentProspects.length > 0 ? `<div style="margin-left:auto;background:#A8B5A0;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">${commentProspects.length} to comment</div>` : ''}
          </div>
          <p style="font-size:12px;color:#6B7280;margin:0 0 16px;">After 2 comments on a prospect they move to the DM queue. No mention of Or This? — pure engagement.</p>
          ${commentSection}
        </div>

        <!-- ── Section 2: DM These Creators (warmed) ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:20px;">
            <div style="width:3px;height:20px;background:#E85D4C;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#E85D4C;font-weight:600;margin-bottom:2px;">SECTION 2 · ~5 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">DM These Creators</div>
            </div>
            ${dmProspects.length > 0 ? `<div style="margin-left:auto;background:#E85D4C;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">${dmProspects.length} to DM</div>` : ''}
          </div>
          <p style="font-size:12px;color:#6B7280;margin:0 0 16px;">These creators have been warmed (2+ comments). DM includes the 30% affiliate commission pitch.</p>
          ${dmSection}
        </div>

        <!-- ── Section 3: Today's TikTok Idea ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#7C3AED;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#7C3AED;font-weight:600;margin-bottom:2px;">SECTION 3 · ~5 MIN TO THINK</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Today's TikTok Idea</div>
            </div>
          </div>
          <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;font-size:13px;color:#2D2D2D;line-height:1.7;white-space:pre-wrap;">
${tikTokIdea}
          </div>
        </div>

        <!-- ── Section 4: Auto-Pilot Status ── -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#1A1A1A;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#6B7280;font-weight:600;margin-bottom:2px;">SECTION 4 · 0 MIN — FYI</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Auto-Pilot Status</div>
            </div>
          </div>

          <!-- Reddit auto-pilot -->
          <div style="background:#FFF9F0;border:1px solid #FED7AA;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
            <div style="font-size:11px;letter-spacing:1px;color:#F59E0B;font-weight:600;margin-bottom:8px;">REDDIT AUTO-PILOT</div>
            ${redditSection}
            ${redditKarmaHealth.avgKarma > 0 || redditKarmaHealth.authorRepliedRate > 0 ? `
            <p style="font-size:12px;color:#6B7280;margin:8px 0 0;">
              Avg comment karma: <strong>${redditKarmaHealth.avgKarma.toFixed(1)}</strong> &nbsp;·&nbsp;
              OP replied rate: <strong>${(redditKarmaHealth.authorRepliedRate * 100).toFixed(0)}%</strong>
            </p>` : ''}
          </div>

          <!-- Creator pipeline funnel -->
          <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
            <div style="font-size:11px;letter-spacing:1px;color:#E85D4C;font-weight:600;margin-bottom:8px;">CREATOR PIPELINE FUNNEL</div>
            <table width="100%" style="border-collapse:collapse;">
              ${pipelineRows}
            </table>
          </div>

          <!-- Channels overview -->
          <table width="100%" style="border-collapse:collapse;border:1px solid #F5EDE7;border-radius:8px;overflow:hidden;">
            <tr style="background:#F5EDE7;">
              <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Reddit threads posted (all time)</td>
              <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#FF6314;text-align:right;">${redditByStatus.posted || 0}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Tweets this week</td>
              <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#1DA1F2;text-align:right;">${twitterPostsThisWeek}</td>
            </tr>
            <tr style="background:#F5EDE7;">
              <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Emails auto-sent yesterday</td>
              <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#A8B5A0;text-align:right;">${emailsSentYesterday + emailFollowUpsSent}</td>
            </tr>
          </table>
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
    commentProspects,
    dmProspects,
    emailSentYesterdayCount,
    emailFollowUpYesterdayCount,
    redditPostedYesterday,
    redditForManual,
    redditKarmaData,
    { pipelineByStatus, redditByStatus, twitterStats },
  ] = await Promise.all([
    // Section 1: DM-track prospects needing warming (0-1 comments, not yet DM-ready via warming)
    prisma.creatorProspect.findMany({
      where: {
        outreachMethod: 'dm',
        status: 'dm_ready',
        commentsPosted: { lt: 2 },
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
    }),

    // Section 2: Warmed DM-track prospects (2+ comments)
    prisma.creatorProspect.findMany({
      where: {
        outreachMethod: 'dm',
        status: 'dm_ready',
        commentsPosted: { gte: 2 },
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
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

  // Build email
  const html = buildMorningBriefHtml({
    commentProspects,
    dmProspects,
    redditPostedYesterday,
    redditForManual,
    tikTokIdea,
    pipeline: pipelineByStatus,
    redditByStatus,
    twitterPostsThisWeek: twitterStats,
    emailsSentYesterday: emailSentYesterdayCount,
    emailFollowUpsSent: emailFollowUpYesterdayCount,
    redditKarmaHealth,
  });

  try {
    await resend.emails.send({
      from: `Or This? Growth Intern <${fromEmail}>`,
      to: recipient,
      subject: `Growth Brief — ${commentProspects.length} to comment, ${dmProspects.length} warmed DMs ready`,
      html,
    });

    console.log('[GrowthIntern] Morning brief sent');
  } catch (err) {
    console.error('[GrowthIntern] Failed to send morning brief:', err);
  }

  // Publish metrics
  await publishToIntelligenceBus('growth-intern', 'growth_intern_metrics', {
    runAt: now.toISOString(),
    commentProspectsReady: commentProspects.length,
    warmedDmProspectsReady: dmProspects.length,
    emailsSentYesterday: emailSentYesterdayCount,
    followUpsSentYesterday: emailFollowUpYesterdayCount,
    redditPostedYesterday: redditPostedYesterday.length,
    redditAvgKarma: redditKarmaHealth.avgKarma,
    pipeline: pipelineByStatus,
    summary: `${commentProspects.length} to comment, ${dmProspects.length} warmed DMs, ${redditPostedYesterday.length} Reddit posts`,
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
