import { createHmac } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue, registerExecutor } from './agent-manager.service.js';
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

  await executeOrQueue(
    'social-media-manager',
    'post_social',
    'high',
    { socialPostId: record.id, platform: post.platform, content: post.content, hashtags: post.hashtags } as unknown as Record<string, unknown>,
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
