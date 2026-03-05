import { createHmac } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue, registerExecutor } from './agent-manager.service.js';
import { getTrendData } from './content-calendar.service.js';
import {
  generateFounderStory,
  generateFashionNewsTake,
  generateCommunitySpotlight,
  generateStyleDataDrop,
  generateWardrobeInsight,
  generateConversationStarter,
  generateBehindTheScenes,
  type GeneratedPost,
} from './social-content-engine.service.js';

// ─── Twitter OAuth 1.0a Signing ───────────────────────────────────────────────

function enc(s: string): string {
  return encodeURIComponent(s);
}

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${enc(k)}=${enc(params[k])}`)
    .join('&');

  const base = `${method}&${enc(url)}&${enc(sortedParams)}`;
  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;

  return createHmac('sha1', signingKey).update(base).digest('base64');
}

function buildOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams };
  const signature = oauthSign(method, url, allParams, apiSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .map(k => `${enc(k)}="${enc(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Post to Twitter ──────────────────────────────────────────────────────────

export async function postToTwitter(socialPostId: string): Promise<{ posted: boolean; tweetId?: string; error?: string; detail?: unknown }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('[SocialMediaManager] Twitter API keys not configured — skipping post');
    return { posted: false, error: 'twitter_keys_not_configured' };
  }

  const post = await prisma.socialPost.findUnique({ where: { id: socialPostId } });
  if (!post) return { posted: false, error: 'post_not_found' };

  const tweetText = [post.content, ...post.hashtags.map(h => `#${h}`)].join(' ').slice(0, 280);

  const url = 'https://api.twitter.com/2/tweets';
  const authHeader = buildOAuthHeader('POST', url, apiKey, apiSecret, accessToken, accessTokenSecret);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: tweetText }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[SocialMediaManager] Twitter API error ${response.status}:`, errBody);
      let parsedErr: unknown = errBody;
      try { parsedErr = JSON.parse(errBody); } catch { /* keep raw */ }
      await prisma.socialPost.update({
        where: { id: socialPostId },
        data: { status: 'rejected', engagement: { error: errBody, status: response.status } },
      });
      return { posted: false, error: `twitter_api_${response.status}`, detail: parsedErr };
    }

    const data = (await response.json()) as { data?: { id?: string } };
    const tweetId = data?.data?.id;

    await prisma.socialPost.update({
      where: { id: socialPostId },
      data: { status: 'posted', postedAt: new Date(), externalId: tweetId },
    });

    console.log(`[SocialMediaManager] Tweet posted: ${tweetId}`);
    return { posted: true, tweetId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[SocialMediaManager] Failed to post tweet:', err);
    return { posted: false, error: errMsg };
  }
}

// ─── Orchestrator: Content Engine Runner ──────────────────────────────────────

async function queueGeneratedPost(post: GeneratedPost): Promise<void> {
  // Generate UTM tracking URL for attribution — unique per post via the record ID
  // We create the record first to get the ID, then update with the tracking URL
  const record = await prisma.socialPost.create({
    data: {
      platform: post.platform,
      content: post.content,
      hashtags: post.hashtags,
      status: 'draft',
      contentType: post.contentType,
      sourceData: post.sourceData != null ? JSON.parse(JSON.stringify(post.sourceData)) : undefined,
    },
  });

  // Build UTM tracking URL and store it on the record
  const baseUrl = process.env.REFERRAL_BASE_URL?.replace('/invite', '') || 'https://orthis.app';
  const trackingUrl = `${baseUrl}?utm_source=${encodeURIComponent(post.platform)}&utm_medium=social&utm_campaign=${encodeURIComponent(post.contentType)}&utm_content=${record.id}`;
  await prisma.socialPost.update({
    where: { id: record.id },
    data: { trackingUrl },
  });

  // All social posts queue for manual approval — Twitter API is expensive and
  // Instagram/TikTok require manual posting anyway
  const riskLevel = 'high';

  await executeOrQueue(
    'social-media-manager',
    'post_social',
    riskLevel,
    { socialPostId: record.id, platform: post.platform, content: post.content, hashtags: post.hashtags, contentType: post.contentType, imageDescription: post.imageDescription } as unknown as Record<string, unknown>,
    async (payload) => {
      const p = payload as { socialPostId: string; platform: string };
      if (p.platform === 'twitter') {
        return await postToTwitter(p.socialPostId);
      }
      console.log(`[SocialMediaManager] Platform "${p.platform}" requires manual posting`);
      return { posted: false, note: 'manual_posting_required' };
    },
    post.content,
  );
}

export async function runSocialMediaManager(options?: { force?: boolean }): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('[SocialMediaManager] GEMINI_API_KEY not set — skipping');
    return;
  }

  const dayOfWeek = new Date().getUTCDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  type Generator = () => Promise<GeneratedPost[]>;
  let generators: Generator[];
  let dayLabel: string;

  switch (dayOfWeek) {
    case 1: // Monday
      dayLabel = 'Monday';
      generators = [generateFounderStory, generateFashionNewsTake, generateCommunitySpotlight];
      break;
    case 3: // Wednesday
      dayLabel = 'Wednesday';
      generators = [generateStyleDataDrop, generateConversationStarter, generateWardrobeInsight];
      break;
    case 5: // Friday
      dayLabel = 'Friday';
      generators = [generateBehindTheScenes, generateFashionNewsTake, generateCommunitySpotlight];
      break;
    default:
      if (!options?.force) {
        console.log(`[SocialMediaManager] Not a content day (UTC day ${dayOfWeek}) — skipping`);
        return;
      }
      // force=true: run all 7 generators for testing
      dayLabel = 'Forced';
      generators = [
        generateFounderStory, generateFashionNewsTake, generateCommunitySpotlight,
        generateStyleDataDrop, generateConversationStarter, generateWardrobeInsight,
        generateBehindTheScenes,
      ];
      break;
  }

  console.log(`[SocialMediaManager] ${dayLabel} content run — ${generators.length} generators`);

  let totalQueued = 0;

  for (const generator of generators) {
    const generatorName = generator.name || 'unknown';
    try {
      const posts = await generator();

      for (const post of posts) {
        try {
          await queueGeneratedPost(post);
          totalQueued++;
          console.log(`[SocialMediaManager] Queued ${post.contentType} post for ${post.platform}`);
        } catch (err) {
          console.error(`[SocialMediaManager] Failed to queue post from ${generatorName}:`, err);
        }
      }
    } catch (err) {
      // Generator failure is isolated — don't let it kill the whole run
      console.error(`[SocialMediaManager] Generator "${generatorName}" failed:`, err);
    }
  }

  console.log(`[SocialMediaManager] ${dayLabel} run complete — ${totalQueued} post(s) queued for approval`);
}

/** Register executors at startup so processApprovedActions works after a server restart. */
export function registerExecutors(): void {
  registerExecutor('social-media-manager', 'post_social', async (payload) => {
    const p = payload as { socialPostId: string; platform: string };
    if (p.platform === 'twitter') {
      return await postToTwitter(p.socialPostId);
    }
    console.log(`[SocialMediaManager] Platform "${p.platform}" requires manual posting`);
    return { posted: false, note: 'manual_posting_required' };
  });
}

// Auto-register at module load time — ensures executor is available even if
// initScheduler() hasn't been called yet (e.g. ENABLE_CRON=false on Railway)
registerExecutors();

// ─── Instagram Graph API ──────────────────────────────────────────────────────

export async function postToInstagram(socialPostId: string): Promise<{ posted: boolean; postId?: string; error?: string }> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    return { posted: false, error: 'INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID not configured' };
  }

  const post = await prisma.socialPost.findUnique({ where: { id: socialPostId } });
  if (!post) return { posted: false, error: 'Post not found' };

  try {
    // Step 1: Create media container
    const caption = `${post.content}${post.hashtags?.length ? '\n\n' + (post.hashtags as string[]).map(h => `#${h}`).join(' ') : ''}`;
    const imageUrl = post.mediaUrl || '';

    if (!imageUrl.startsWith('http')) {
      return { posted: false, error: 'Instagram posts require a public image URL' };
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
      }
    );
    const container = await containerRes.json() as { id?: string; error?: { message: string } };
    if (!container.id) {
      return { posted: false, error: container.error?.message || 'Failed to create media container' };
    }

    // Step 2: Publish media container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
      }
    );
    const published = await publishRes.json() as { id?: string; error?: { message: string } };
    if (!published.id) {
      return { posted: false, error: published.error?.message || 'Failed to publish media' };
    }

    await prisma.socialPost.update({
      where: { id: socialPostId },
      data: { status: 'posted', postedAt: new Date() },
    });

    console.log(`[SocialMediaManager] Instagram post published: ${published.id}`);
    return { posted: true, postId: published.id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[SocialMediaManager] Failed to post to Instagram:', err);
    return { posted: false, error: errMsg };
  }
}

// ─── Weekly Social Digest ─────────────────────────────────────────────────────

const PLATFORM_EMOJI: Record<string, string> = {
  twitter: '𝕏',
  tiktok: '🎵',
  pinterest: '📌',
  instagram: '📸',
};


function buildDigestEmail(
  weekOf: string,
  trendData: { topStyles: string[]; popularOccasions: string[]; colorTrends: string[] },
  postsByDay: Array<{ day: string; posts: GeneratedPost[] }>,
): string {
  const trendSection = `
    <div style="margin-bottom:32px;padding:20px;background:#F5EDE7;border-radius:8px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#A8B5A0;margin:0 0 12px;">What's Trending in Your App This Week</p>
      <div style="display:flex;flex-wrap:wrap;gap:20px;">
        <div><p style="font-size:12px;color:#6B7280;margin:0 0 4px;">Top styles</p><p style="color:#1A1A1A;font-size:13px;margin:0;">${trendData.topStyles.slice(0, 3).join(' · ')}</p></div>
        <div><p style="font-size:12px;color:#6B7280;margin:0 0 4px;">Occasions</p><p style="color:#1A1A1A;font-size:13px;margin:0;">${trendData.popularOccasions.slice(0, 3).join(' · ')}</p></div>
        <div><p style="font-size:12px;color:#6B7280;margin:0 0 4px;">Colors</p><p style="color:#1A1A1A;font-size:13px;margin:0;">${trendData.colorTrends.slice(0, 3).join(' · ')}</p></div>
      </div>
    </div>`;

  const dayBlocks = postsByDay.map(({ day, posts }) => {
    const postCards = posts.map(post => `
      <div style="margin-bottom:12px;padding:16px;background:#fff;border:1px solid rgba(26,26,26,0.08);border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#E85D4C;">${post.contentType.replace(/_/g, ' ')}</span>
          <span style="font-size:12px;color:#6B7280;">${PLATFORM_EMOJI[post.platform] ?? ''} ${post.platform}</span>
        </div>
        <p style="font-size:14px;color:#1A1A1A;line-height:1.6;margin:0 0 8px;white-space:pre-wrap;">${post.content}</p>
        <p style="font-size:12px;color:#A8B5A0;margin:0 0 8px;">${post.hashtags.map(h => `#${h}`).join(' ')}</p>
        ${post.imageDescription ? `<p style="font-size:12px;color:#6B7280;font-style:italic;margin:0;">📸 ${post.imageDescription}</p>` : ''}
      </div>`).join('');

    return `
      <div style="margin-bottom:28px;">
        <p style="font-size:13px;font-weight:700;color:#2D2D2D;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(26,26,26,0.1);">${day}</p>
        ${postCards}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;margin:0;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#1A1A1A;padding:28px 36px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:0 0 4px;">Or This?</p>
        <p style="font-size:22px;font-weight:700;color:#fff;margin:0;">Weekly Social Posts</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:6px 0 0;">Week of ${weekOf} · Copy-paste ready</p>
      </div>
      <div style="padding:28px 36px;">
        ${trendSection}
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#A8B5A0;margin:0 0 20px;">This Week's Posts</p>
        ${dayBlocks}
      </div>
      <div style="background:#F5EDE7;padding:16px 36px;text-align:center;">
        <p style="font-size:11px;color:#A8B5A0;margin:0;">Or This? · Weekly Social Digest · ${new Date().toISOString()}</p>
      </div>
    </div>
  </body></html>`;
}

/**
 * Generates all week's social posts and emails them as one actionable digest.
 * Replaces the content calendar email + individual Mon/Wed/Fri notification emails.
 * Runs Monday 8am UTC — one email, copy-paste ready, no action queue needed.
 */
export async function sendWeeklySocialDigest(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[SocialDigest] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log('[SocialDigest] GEMINI_API_KEY not set — skipping');
    return;
  }

  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  console.log('[SocialDigest] Generating weekly social digest...');

  const trendData = await getTrendData();

  // Run all generators grouped by the day they'd normally run
  const dayGenerators: Array<{ day: string; generators: Array<() => Promise<GeneratedPost[]>> }> = [
    { day: 'Monday', generators: [generateFounderStory, generateFashionNewsTake, generateCommunitySpotlight] },
    { day: 'Wednesday', generators: [generateStyleDataDrop, generateConversationStarter, generateWardrobeInsight] },
    { day: 'Friday', generators: [generateBehindTheScenes, generateFashionNewsTake, generateCommunitySpotlight] },
  ];

  const postsByDay: Array<{ day: string; posts: GeneratedPost[] }> = [];

  for (const { day, generators } of dayGenerators) {
    const dayPosts: GeneratedPost[] = [];
    for (const generator of generators) {
      try {
        const posts = await generator();
        dayPosts.push(...posts);
      } catch (err) {
        console.error(`[SocialDigest] Generator failed for ${day}:`, err);
      }
    }
    if (dayPosts.length > 0) {
      postsByDay.push({ day, posts: dayPosts });
    }
  }

  if (postsByDay.length === 0) {
    console.log('[SocialDigest] No posts generated — skipping email');
    return;
  }

  const totalPosts = postsByDay.reduce((sum, d) => sum + d.posts.length, 0);
  const from = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';

  try {
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? — ${totalPosts} social posts ready to copy · Week of ${weekOf}`,
      html: buildDigestEmail(weekOf, trendData, postsByDay),
    });
    console.log(`[SocialDigest] Sent weekly digest with ${totalPosts} posts for week of ${weekOf}`);
  } catch (err) {
    console.error('[SocialDigest] Failed to send digest email:', err);
  }
}
