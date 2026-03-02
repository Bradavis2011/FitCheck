/**
 * Creator Manager Service
 *
 * Manages the UGC Creator Program:
 *  A) Weekly hook distribution — Sunday 6pm UTC
 *  B) Viral replication — triggered by admin when a post goes viral
 *  C) Weekly performance digest — Friday 9am UTC
 *
 * Publishes `creator_metrics` to Intelligence Bus for Founder Brief inclusion.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue, registerExecutor } from './agent-manager.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { escapeHtml } from '../utils/escape.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Email Infrastructure ─────────────────────────────────────────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function getFromEmail(): string {
  return process.env.REPORT_FROM_EMAIL || 'reports@orthis.app';
}

function getFounderEmail(): string {
  return process.env.REPORT_RECIPIENT_EMAIL || '';
}

// ─── A) Weekly Hook Distribution ──────────────────────────────────────────────

/**
 * Sends the weekly hook library email to all active creators.
 * Called via cron: Sunday 6pm UTC.
 */
export async function runCreatorHookDistribution(): Promise<void> {
  console.log('[CreatorManager] Running weekly hook distribution...');

  const resend = getResend();
  if (!resend) {
    console.log('[CreatorManager] RESEND_API_KEY not set — skipping');
    return;
  }

  // Fetch active creators with email addresses
  const creators = await prisma.creator.findMany({
    where: { status: 'active', email: { not: null } },
    select: { id: true, name: true, email: true, referralCode: true, totalPosts: true, totalViews: true },
  });

  if (creators.length === 0) {
    console.log('[CreatorManager] No active creators with email — skipping distribution');
    return;
  }

  // Fetch latest approved hooks
  const hooks = await prisma.socialPost.findMany({
    where: { contentType: 'creator_hook', status: 'approved' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { content: true, createdAt: true },
  });

  if (hooks.length === 0) {
    console.log('[CreatorManager] No approved hooks found — skipping distribution');
    return;
  }

  // Find any viral post from the past week to celebrate
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const viralPost = await prisma.creatorPost.findFirst({
    where: { isViral: true, createdAt: { gte: weekAgo } },
    orderBy: { views: 'desc' },
    include: { creator: { select: { name: true, handle: true } } },
  });

  // Get waitlist count for the referral context
  const waitlistTotal = await prisma.waitlistEntry.count();

  const content = buildHookDistributionEmail(hooks.map(h => h.content), viralPost, waitlistTotal);

  await executeOrQueue(
    'creator-manager',
    'hook_distribution',
    'medium',
    { hookCount: hooks.length, creatorCount: creators.length },
    async () => {
      const from = getFromEmail();
      let sent = 0;
      for (const creator of creators) {
        if (!creator.email) continue;
        try {
          await resend.emails.send({
            from,
            to: creator.email,
            subject: `This week's OrThis? hooks — ${hooks.length} scripts ready to film`,
            html: buildPersonalizedHookEmail(creator.name, creator.referralCode, creator.totalViews, content),
          });
          sent++;
        } catch (err) {
          console.error(`[CreatorManager] Failed to send hook email to ${creator.email}:`, err);
        }
      }
      return { sent, total: creators.length };
    },
    content,
  );

  console.log(`[CreatorManager] Hook distribution queued for ${creators.length} creator(s)`);
}

function buildHookDistributionEmail(hookTexts: string[], viralPost: { creator: { name: string; handle: string } } | null, waitlistTotal: number): string {
  const hookItems = hookTexts.map((h, i) => {
    const firstLine = escapeHtml(h.split('\n')[0].replace(/^##\s*/, ''));
    const preview = escapeHtml(h.split('\n').slice(1, 4).join(' ').replace(/\*\*/g, '').trim().slice(0, 200));
    return `<div style="margin-bottom:24px;padding:20px;background:#F5EDE7;border-left:3px solid #E85D4C;">
      <div style="font-size:15px;font-weight:600;color:#1A1A1A;margin-bottom:8px;">${i + 1}. ${firstLine}</div>
      <div style="font-size:13px;color:#4B5563;line-height:1.6;">${preview}</div>
    </div>`;
  }).join('');

  const viralSection = viralPost ? `
    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🔥 Last week's winner</div>
      <div style="font-size:14px;color:#1A1A1A;">${escapeHtml(viralPost.creator.name)} (@${escapeHtml(viralPost.creator.handle)}) went viral. Their format is in next week's batch — study it.</div>
    </div>` : '';

  return `${viralSection}${hookItems}
    <p style="color:#6B7280;font-size:13px;">Or This? has ${waitlistTotal.toLocaleString()} people on the waitlist. Every post you make is reaching potential users who've never heard of us. Your referral link is the most direct path to credit.</p>`;
}

function buildPersonalizedHookEmail(name: string, referralCode: string | null, totalViews: number, bodyContent: string): string {
  const referralUrl = referralCode
    ? `${process.env.APP_URL || 'https://orthis.app'}?ref=${referralCode}`
    : (process.env.APP_URL || 'https://orthis.app');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#1A1A1A;padding:28px 40px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#fff;">Or <em style="color:#E85D4C;">This?</em></div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Founding Creator — Weekly Hooks</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#1A1A1A;margin:0 0 24px;">Hey ${escapeHtml(name)},</p>
            <p style="font-size:14px;color:#4B5563;margin:0 0 24px;line-height:1.6;">This week's scripts. Pick 1-3 that feel natural to you. The other half is your free zone — make whatever OrThis? content you want.</p>

            ${bodyContent}

            <div style="border-top:1px solid #F5EDE7;padding-top:24px;margin-top:8px;">
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Referral Link</div>
              <div style="background:#F5EDE7;padding:12px 16px;font-size:13px;font-family:monospace;color:#1A1A1A;word-break:break-all;">${referralUrl}</div>
              <p style="font-size:12px;color:#9CA3AF;margin:8px 0 0;">Every waitlist signup through your link is attributed to you. We track it.${totalViews > 0 ? ` Your content has driven ${totalViews.toLocaleString()} views so far.` : ''}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">Or This? · Founding Creator Program · ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── B) Viral Replication ─────────────────────────────────────────────────────

/**
 * When a post is flagged viral, Gemini extracts the winning formula and
 * generates 5 variations. Sends "HOT HOOK" emergency email to all active creators.
 */
export async function replicateViralHook(creatorId: string, postId: string): Promise<void> {
  console.log(`[CreatorManager] Viral replication triggered: creator=${creatorId}, post=${postId}`);

  const post = await prisma.creatorPost.findFirst({
    where: { id: postId, creatorId },
    include: { creator: { select: { name: true, handle: true, platform: true } } },
  });

  if (!post) {
    console.error('[CreatorManager] Post not found for viral replication');
    return;
  }

  // Mark post as viral
  await prisma.creatorPost.update({
    where: { id: postId },
    data: { isViral: true },
  });

  // Update creator's total views
  await prisma.creator.update({
    where: { id: creatorId },
    data: { totalViews: { increment: post.views }, lastPostDate: new Date() },
  });

  if (!process.env.GEMINI_API_KEY) {
    console.log('[CreatorManager] No GEMINI_API_KEY — skipping viral analysis');
    return;
  }

  const postContext = [
    post.externalUrl ? `Post URL: ${post.externalUrl}` : '',
    post.hookUsed ? `Hook used: ${post.hookUsed}` : '',
    `Views: ${post.views.toLocaleString()}`,
    `Likes: ${post.likes.toLocaleString()}`,
    `Platform: ${post.creator.platform}`,
    `Creator: @${post.creator.handle}`,
  ].filter(Boolean).join('\n');

  const analysisPrompt = `You're a viral content strategist specializing in fashion/outfit content on TikTok.

A creator just hit ${post.views.toLocaleString()} views with this content:
${postContext}

First, analyze WHY this worked (the hook psychology, the format, the emotion, the curiosity loop).

Then generate 5 VARIATIONS of the same winning script for other creators to film with "Or This?", an AI outfit feedback app. Each variation should:
- Use the same winning psychological mechanic (surprise reveal, betrayal, vindication, etc.)
- Feel like a completely different video to the viewer
- Work for creators with 0-10K followers and phone-only production
- Be under 80 words total

Return JSON (no markdown):
{
  "analysis": {
    "hook": "what made the hook work",
    "format": "the format that worked",
    "psychology": "the emotional mechanic",
    "why_it_spread": "why people shared/saved it"
  },
  "variations": [
    {
      "title": "short name",
      "hook": "opening line (2 seconds)",
      "setup": "build the scenario (10 seconds)",
      "payoff": "the reveal/reaction (10 seconds)",
      "cta": "soft close (3 seconds)"
    }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    });
    const result = await model.generateContent(analysisPrompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse Gemini response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      analysis: { hook: string; format: string; psychology: string; why_it_spread: string };
      variations: Array<{ title: string; hook: string; setup: string; payoff: string; cta: string }>;
    };

    // Store variations as SocialPost records
    for (const v of (parsed.variations || []).slice(0, 5)) {
      const content = `## ${v.title}\n\n**HOOK:** ${v.hook}\n\n**SETUP:** ${v.setup}\n\n**PAYOFF:** ${v.payoff}\n\n**CTA:** ${v.cta}`;
      await prisma.socialPost.create({
        data: {
          platform: 'tiktok',
          content,
          hashtags: ['fitcheck', 'ratemyoutfit', 'OrThis'],
          contentType: 'viral_replication',
          status: 'draft',
          sourceData: JSON.stringify({ sourcePostId: postId, sourceViews: post.views, analysis: parsed.analysis }),
        },
      });
    }

    // Queue "HOT HOOK" email to founder + all active creators
    const hotHookContent = buildHotHookEmail(post.views, parsed.analysis, parsed.variations || []);

    await executeOrQueue(
      'creator-manager',
      'viral_replication',
      'medium',
      {
        postId,
        creatorHandle: post.creator.handle,
        views: post.views,
        variationCount: (parsed.variations || []).length,
      },
      async () => {
        const resend = getResend();
        if (!resend) return { sent: false };
        const from = getFromEmail();

        // Send to founder
        const founderEmail = getFounderEmail();
        if (founderEmail) {
          await resend.emails.send({
            from,
            to: founderEmail,
            subject: `🔥 HOT HOOK: @${post.creator.handle} hit ${post.views.toLocaleString()} views — distribute NOW`,
            html: hotHookContent,
          });
        }

        // Send to active creators with email
        const activeCreators = await prisma.creator.findMany({
          where: { status: 'active', email: { not: null } },
          select: { email: true },
        });

        let sent = 0;
        for (const creator of activeCreators) {
          if (!creator.email) continue;
          try {
            await resend.emails.send({
              from,
              to: creator.email,
              subject: `🔥 HOT HOOK: ${post.views.toLocaleString()} views — film your version today`,
              html: hotHookContent,
            });
            sent++;
          } catch (err) {
            console.error('[CreatorManager] Failed to send hot hook email:', err);
          }
        }

        return { sent, founderNotified: !!founderEmail };
      },
      hotHookContent,
    );

    console.log(`[CreatorManager] Viral replication queued — ${(parsed.variations || []).length} variations generated`);
  } catch (err) {
    console.error('[CreatorManager] Viral replication failed:', err);
  }
}

function buildHotHookEmail(
  views: number,
  analysis: { hook: string; format: string; psychology: string; why_it_spread: string },
  variations: Array<{ title: string; hook: string; setup: string; payoff: string; cta: string }>,
): string {
  const variationItems = variations.slice(0, 3).map((v, i) => `
    <div style="margin-bottom:20px;padding:16px;background:#F5EDE7;border-left:3px solid #E85D4C;">
      <div style="font-size:14px;font-weight:700;color:#1A1A1A;margin-bottom:8px;">${i + 1}. ${escapeHtml(v.title)}</div>
      <div style="font-size:13px;color:#4B5563;line-height:1.7;">
        <strong>Hook:</strong> ${escapeHtml(v.hook)}<br>
        <strong>Setup:</strong> ${escapeHtml(v.setup)}<br>
        <strong>Payoff:</strong> ${escapeHtml(v.payoff)}<br>
        <strong>CTA:</strong> ${escapeHtml(v.cta)}
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#E85D4C;padding:28px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#fff;">🔥 HOT HOOK</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">This hook just hit ${views.toLocaleString()} views. Film your version TODAY.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:16px;margin-bottom:28px;">
              <div style="font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Why It Worked</div>
              <div style="font-size:13px;color:#1A1A1A;line-height:1.7;">
                <strong>Hook:</strong> ${escapeHtml(analysis.hook)}<br>
                <strong>Format:</strong> ${escapeHtml(analysis.format)}<br>
                <strong>Psychology:</strong> ${escapeHtml(analysis.psychology)}<br>
                <strong>Why it spread:</strong> ${escapeHtml(analysis.why_it_spread)}
              </div>
            </div>

            <div style="font-size:14px;font-weight:700;color:#1A1A1A;margin-bottom:16px;">3 Variations Ready to Film</div>
            ${variationItems}

            <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:12px;margin-top:16px;">
              <div style="font-size:13px;color:#991B1B;line-height:1.5;"><strong>Move fast:</strong> The algorithm rewards this format for ~48 hours. The sooner you post, the more the algorithm pushes it.</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">Or This? · Creator Program · Viral Replication Alert</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── C) Weekly Performance Digest ─────────────────────────────────────────────

/**
 * Sends the weekly performance digest to the founder.
 * Called via cron: Friday 9am UTC.
 */
export async function runCreatorPerformanceDigest(): Promise<void> {
  console.log('[CreatorManager] Running weekly performance digest...');

  const resend = getResend();
  const founderEmail = getFounderEmail();
  if (!resend || !founderEmail) {
    console.log('[CreatorManager] RESEND or REPORT_RECIPIENT_EMAIL not set — skipping digest');
    return;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [creators, recentPosts, hookPerformance] = await Promise.all([
    prisma.creator.findMany({
      where: { status: { in: ['active', 'accepted'] } },
      include: {
        posts: {
          where: { createdAt: { gte: weekAgo } },
          orderBy: { views: 'desc' },
        },
      },
      orderBy: { totalViews: 'desc' },
    }),
    prisma.creatorPost.findMany({
      where: { createdAt: { gte: weekAgo } },
      include: { creator: { select: { name: true, handle: true } } },
      orderBy: { views: 'desc' },
      take: 20,
    }),
    // Hook performance: group by hookUsed
    prisma.creatorPost.groupBy({
      by: ['hookUsed'],
      where: { createdAt: { gte: weekAgo }, hookUsed: { not: null } },
      _sum: { views: true, likes: true },
      _count: { id: true },
      orderBy: { _sum: { views: 'desc' } },
      take: 5,
    }),
  ]);

  const totalViewsThisWeek = recentPosts.reduce((sum, p) => sum + p.views, 0);
  const activeCount = creators.filter(c => c.status === 'active').length;
  const viralCount = recentPosts.filter(p => p.isViral).length;

  // Publish metrics to Intelligence Bus
  await publishToIntelligenceBus('creator-manager', 'creator_metrics', {
    activeCreators: activeCount,
    totalCreators: creators.length,
    totalViewsThisWeek,
    postsThisWeek: recentPosts.length,
    viralPostsThisWeek: viralCount,
    topHook: hookPerformance[0]?.hookUsed || null,
    topHookViews: hookPerformance[0]?._sum?.views || 0,
  });

  // Identify who to cut (< 3 posts OR < 5K avg views after 2+ posts)
  const cutCandidates = creators.filter(c => {
    if (c.status !== 'active') return false;
    const allPosts = c.posts;
    const postCount = allPosts.length;
    const avgViews = postCount > 0 ? allPosts.reduce((s, p) => s + p.views, 0) / postCount : 0;
    return postCount < 3 || (postCount >= 2 && avgViews < 5000);
  });

  const html = buildPerformanceDigestEmail(
    creators,
    recentPosts,
    hookPerformance.map(h => ({ hookUsed: h.hookUsed || 'Unknown', totalViews: h._sum?.views || 0, postCount: h._count.id })),
    cutCandidates.map(c => c.name),
    totalViewsThisWeek,
    viralCount,
  );

  await resend.emails.send({
    from: getFromEmail(),
    to: founderEmail,
    subject: `Or This? Creator Report — ${recentPosts.length} posts, ${totalViewsThisWeek.toLocaleString()} views this week`,
    html,
  });

  console.log(`[CreatorManager] Performance digest sent — ${creators.length} creators, ${recentPosts.length} posts`);
}

function buildPerformanceDigestEmail(
  creators: Array<{ name: string; handle: string; platform: string; totalViews: number; totalPosts: number; status: string }>,
  recentPosts: Array<{ views: number; isViral: boolean; creator: { name: string; handle: string }; hookUsed: string | null }>,
  hookPerformance: Array<{ hookUsed: string; totalViews: number; postCount: number }>,
  cutCandidates: string[],
  totalViewsWeek: number,
  viralCount: number,
): string {
  const creatorRows = creators.slice(0, 10).map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${escapeHtml(c.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;color:#6B7280;">@${escapeHtml(c.handle)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${c.totalViews.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${c.totalPosts}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${c.platform}</td>
    </tr>`).join('');

  const hookRows = hookPerformance.map(h => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${escapeHtml(h.hookUsed)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${h.postCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F5EDE7;font-size:13px;">${h.totalViews.toLocaleString()}</td>
    </tr>`).join('');

  const cutSection = cutCandidates.length > 0 ? `
    <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px;margin-top:24px;">
      <div style="font-size:12px;font-weight:600;color:#991B1B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Recommended Cuts</div>
      <p style="font-size:13px;color:#1A1A1A;margin:0 0 8px;">These creators haven't hit benchmarks (3+ posts, 5K+ avg views) after 2 weeks:</p>
      <ul style="margin:0;padding-left:20px;">${cutCandidates.map(n => `<li style="font-size:13px;color:#4B5563;">${escapeHtml(n)}</li>`).join('')}</ul>
      <p style="font-size:12px;color:#6B7280;margin:8px 0 0;">Use PATCH /api/admin/creators/:id with { "status": "cut" } to remove them from distribution.</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#1A1A1A;padding:28px 40px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#fff;">Or <em style="color:#E85D4C;">This?</em></div>
            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Creator Program — Weekly Digest</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <!-- Summary Stats -->
            <div style="display:flex;gap:16px;margin-bottom:32px;">
              <div style="flex:1;background:#F5EDE7;border-radius:8px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#E85D4C;">${totalViewsWeek.toLocaleString()}</div>
                <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Views This Week</div>
              </div>
              <div style="flex:1;background:#F5EDE7;border-radius:8px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#1A1A1A;">${recentPosts.length}</div>
                <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Posts</div>
              </div>
              <div style="flex:1;background:#F5EDE7;border-radius:8px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#10B981;">${viralCount}</div>
                <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Viral Posts</div>
              </div>
              <div style="flex:1;background:#F5EDE7;border-radius:8px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#1A1A1A;">${creators.filter(c => c.status === 'active').length}</div>
                <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Active Creators</div>
              </div>
            </div>

            <!-- Creator Leaderboard -->
            <div style="margin-bottom:28px;">
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Creator Leaderboard (All Time)</div>
              <table width="100%" style="border-collapse:collapse;">
                <thead><tr style="background:#F5EDE7;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Name</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Handle</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Total Views</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Posts</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Platform</th>
                </tr></thead>
                <tbody>${creatorRows}</tbody>
              </table>
            </div>

            ${hookPerformance.length > 0 ? `
            <!-- Hook Performance -->
            <div style="margin-bottom:28px;">
              <div style="font-size:12px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Hook Performance This Week</div>
              <table width="100%" style="border-collapse:collapse;">
                <thead><tr style="background:#F5EDE7;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Hook</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Posts</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;">Total Views</th>
                </tr></thead>
                <tbody>${hookRows}</tbody>
              </table>
            </div>` : ''}

            ${cutSection}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">Or This? · Creator Manager · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Executor Registration ─────────────────────────────────────────────────────

export function registerCreatorExecutors(): void {
  registerExecutor('creator-manager', 'hook_distribution', async (payload) => {
    const p = payload as { hookCount: number; creatorCount: number };
    console.log(`[CreatorManager] Executing approved hook_distribution: ${p.hookCount} hooks to ${p.creatorCount} creators`);
    await runCreatorHookDistribution();
    return { executed: true };
  });

  registerExecutor('creator-manager', 'viral_replication', async (payload) => {
    const p = payload as { postId: string; creatorHandle: string; views: number };
    console.log(`[CreatorManager] Executing approved viral_replication for @${p.creatorHandle} (${p.views.toLocaleString()} views)`);
    return { executed: true, note: 'Email already sent during queuing phase' };
  });
}

// Auto-register at module load time
registerCreatorExecutors();
