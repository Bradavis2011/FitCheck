/**
 * Growth Intern — Daily morning brief assembly
 *
 * Cron: Daily 12pm UTC (8am ET)
 * Sends one email with everything the founder needs for ~25 min of growth work.
 *
 * Sections:
 *   1. DM These Creators (manual — ~8 min)
 *   2. Emails Sent Automatically (FYI — 0 min)
 *   3. Reddit — Auto-Posted (review — ~3 min)
 *   4. Follow Up These Creators (manual — ~5 min)
 *   5. Today's TikTok Idea (creative — ~5 min to think)
 *   6. Pipeline & Performance
 */

import { Resend } from 'resend';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const BASE_URL = process.env.API_BASE_URL || 'https://fitcheck-production-0f92.up.railway.app';
const HMAC_SECRET = process.env.FOLLOW_UP_HMAC_SECRET || 'growth-intern-default';

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

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
  dmProspects: any[];
  emailsSentYesterday: number;
  emailFollowUpsSent: number;
  openedButNoReply: any[];
  redditPostedYesterday: any[];
  redditForManual: any[];
  followUpProspects: any[];
  tikTokIdea: string;
  pipeline: Record<string, number>;
  redditByStatus: Record<string, number>;
  twitterPostsThisWeek: number;
}): string {
  const {
    dmProspects, emailsSentYesterday, emailFollowUpsSent, openedButNoReply,
    redditPostedYesterday, redditForManual, followUpProspects,
    tikTokIdea, pipeline, redditByStatus, twitterPostsThisWeek,
  } = sections;

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Section 1: DM These Creators
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
    : '<p style="color:#6B7280;font-style:italic;">No DM-track prospects ready today</p>';

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

  // Section 4: Follow-up creators
  const followUpSection = followUpProspects.length > 0
    ? followUpProspects.map(p => {
        const profileUrl = profileLink(p.platform, p.handle);
        const respondedUrl = `${BASE_URL}/g/prospect/${p.id}/responded?t=${generateGrowthToken(p.id, 'responded')}`;
        const daysSinceContact = p.contactedAt
          ? Math.floor((Date.now() - new Date(p.contactedAt).getTime()) / (24 * 60 * 60 * 1000))
          : '?';

        return `
        <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:8px;">
            <span style="font-size:20px;margin-right:8px;">${platformEmoji(p.platform)}</span>
            <a href="${profileUrl}" style="color:#E85D4C;font-weight:700;font-size:15px;text-decoration:none;">@${p.handle}</a>
            <span style="margin-left:auto;color:#9CA3AF;font-size:12px;">Last contacted: ${daysSinceContact}d ago</span>
          </div>
          <div style="background:#fff;border-left:3px solid #F59E0B;padding:12px 16px;font-size:13px;color:#2D2D2D;line-height:1.5;font-family:monospace;margin-bottom:12px;">
            ${(p.followUpDM || 'Hey! Just wanted to follow up on my last message about Or This? — still happy to set you up with free premium access if you\'re interested!').replace(/\n/g, '<br>')}
          </div>
          <a href="${respondedUrl}" style="display:inline-block;background:#10B981;color:white;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            ✓ They Responded!
          </a>
          <a href="${profileUrl}" style="display:inline-block;margin-left:8px;border:1px solid #E85D4C;color:#E85D4C;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:600;">
            Open Profile →
          </a>
        </div>`;
      }).join('')
    : '<p style="color:#6B7280;font-style:italic;">No follow-up needed today</p>';

  // Pipeline summary
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
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${dmProspects.length}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">DMs TO SEND</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${emailsSentYesterday + emailFollowUpsSent}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">EMAILS AUTO-SENT</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${redditPostedYesterday.length}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">REDDIT POSTED</div>
            </td>
            <td style="text-align:center;padding:0 12px;">
              <div style="font-size:24px;font-weight:700;color:#E85D4C;">${twitterPostsThisWeek}</div>
              <div style="font-size:11px;color:#6B7280;letter-spacing:0.5px;">TWEETS THIS WEEK</div>
            </td>
          </tr></table>
        </td>
      </tr>

      <tr><td style="padding:32px 40px;">

        <!-- ── Section 1: DM These Creators ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:20px;">
            <div style="width:3px;height:20px;background:#E85D4C;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#E85D4C;font-weight:600;margin-bottom:2px;">SECTION 1 · ~8 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">DM These Creators</div>
            </div>
            <div style="margin-left:auto;background:#E85D4C;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">${dmProspects.length} to DM</div>
          </div>
          ${dmSection}
        </div>

        <!-- ── Section 2: Emails Auto-Sent ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#A8B5A0;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#A8B5A0;font-weight:600;margin-bottom:2px;">SECTION 2 · 0 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Emails Sent Automatically</div>
            </div>
          </div>
          <p style="font-size:14px;color:#2D2D2D;margin:0 0 8px;">✅ Sent <strong>${emailsSentYesterday}</strong> outreach emails + <strong>${emailFollowUpsSent}</strong> follow-ups automatically.</p>
          ${openedButNoReply.length > 0 ? `
          <p style="font-size:13px;color:#F59E0B;margin:8px 0;">⚡ <strong>${openedButNoReply.length}</strong> creators opened your email but haven't replied yet — consider a manual DM:</p>
          ${openedButNoReply.map(p => `<span style="font-size:13px;color:#E85D4C;">@${p.handle}</span> (${p.platform}) &nbsp;`).join('')}
          ` : ''}
        </div>

        <!-- ── Section 3: Reddit ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#FF6314;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#FF6314;font-weight:600;margin-bottom:2px;">SECTION 3 · ~3 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Reddit — Auto-Posted</div>
            </div>
          </div>
          ${redditSection}
        </div>

        <!-- ── Section 4: Follow Up ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#F59E0B;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#F59E0B;font-weight:600;margin-bottom:2px;">SECTION 4 · ~5 MIN</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Follow Up These Creators</div>
            </div>
            ${followUpProspects.length > 0 ? `<div style="margin-left:auto;background:#F59E0B;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">${followUpProspects.length} to follow up</div>` : ''}
          </div>
          ${followUpSection}
        </div>

        <!-- ── Section 5: TikTok Idea ── -->
        <div style="margin-bottom:36px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#7C3AED;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#7C3AED;font-weight:600;margin-bottom:2px;">SECTION 5 · ~5 MIN TO THINK</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Today's TikTok Idea</div>
            </div>
          </div>
          <div style="background:#F5EDE7;border-radius:8px;padding:20px 24px;font-size:13px;color:#2D2D2D;line-height:1.7;white-space:pre-wrap;">
${tikTokIdea}
          </div>
        </div>

        <!-- ── Section 6: Pipeline ── -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="width:3px;height:20px;background:#1A1A1A;margin-right:12px;border-radius:2px;"></div>
            <div>
              <div style="font-size:11px;letter-spacing:1.5px;color:#6B7280;font-weight:600;margin-bottom:2px;">SECTION 6</div>
              <div style="font-size:18px;font-weight:700;color:#1A1A1A;">Pipeline & Performance</div>
            </div>
          </div>
          <table width="100%" style="border-collapse:collapse;border:1px solid #F5EDE7;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#F5EDE7;">
                <th style="padding:10px 16px;font-size:11px;letter-spacing:1px;color:#6B7280;text-align:left;font-weight:600;">STAGE</th>
                <th style="padding:10px 16px;font-size:11px;letter-spacing:1px;color:#6B7280;text-align:right;font-weight:600;">COUNT</th>
              </tr>
            </thead>
            <tbody>
              ${pipelineRows}
              <tr style="background:#F5EDE7;">
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Reddit threads posted (all time)</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#FF6314;text-align:right;">${redditByStatus.posted || 0}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;color:#6B7280;">Tweets this week</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#1DA1F2;text-align:right;">${twitterPostsThisWeek}</td>
              </tr>
            </tbody>
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
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const [
    dmProspects,
    emailSentYesterdayCount,
    emailFollowUpYesterdayCount,
    openedButNoReply,
    redditPostedYesterday,
    redditForManual,
    followUpProspects,
    { pipelineByStatus, redditByStatus, twitterStats },
  ] = await Promise.all([
    // DM-track prospects ready to contact
    prisma.creatorProspect.findMany({
      where: { outreachMethod: 'dm', status: 'dm_ready' },
      orderBy: { createdAt: 'asc' },
      take: 15,
    }),

    // Emails sent yesterday
    prisma.creatorProspect.count({
      where: {
        outreachMethod: 'email',
        contactedAt: { gte: yesterday },
      },
    }),

    // Follow-up emails sent yesterday
    prisma.creatorProspect.count({
      where: {
        outreachMethod: 'email',
        followedUpAt: { gte: yesterday },
      },
    }),

    // Opened but no reply
    prisma.creatorProspect.findMany({
      where: {
        outreachMethod: 'email',
        status: { in: ['contacted', 'followed_up'] },
        emailOpenedAt: { not: null },
        respondedAt: null,
      },
      take: 5,
    }),

    // Reddit posted yesterday
    prisma.redditThread.findMany({
      where: { status: 'posted', postedAt: { gte: yesterday } },
      orderBy: { postedAt: 'desc' },
    }),

    // Reddit threads for manual posting (approved status — Reddit not configured)
    prisma.redditThread.findMany({
      where: { status: 'approved', suggestedResponse: { not: null } },
      orderBy: { relevanceScore: 'desc' },
      take: 3,
    }),

    // DM-track prospects needing follow-up (contacted 3+ days ago)
    prisma.creatorProspect.findMany({
      where: {
        outreachMethod: 'dm',
        status: 'contacted',
        contactedAt: { lte: threeDaysAgo },
      },
      orderBy: { contactedAt: 'asc' },
      take: 10,
    }),

    // Pipeline stats
    getPipelineStats(),
  ]);

  // Generate TikTok idea
  const tikTokIdea = await generateTikTokIdea();

  // Build email
  const html = buildMorningBriefHtml({
    dmProspects,
    emailsSentYesterday: emailSentYesterdayCount,
    emailFollowUpsSent: emailFollowUpYesterdayCount,
    openedButNoReply,
    redditPostedYesterday,
    redditForManual,
    followUpProspects,
    tikTokIdea,
    pipeline: pipelineByStatus,
    redditByStatus,
    twitterPostsThisWeek: twitterStats,
  });

  try {
    await resend.emails.send({
      from: `Or This? Growth Intern <${fromEmail}>`,
      to: recipient,
      subject: `Growth Brief — ${dmProspects.length} DMs to send, ${emailSentYesterdayCount + emailFollowUpYesterdayCount} emails auto-sent`,
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
    followUpProspectsCount: followUpProspects.length,
    pipeline: pipelineByStatus,
  }).catch(() => {});

  console.log('[GrowthIntern] Run complete');
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
