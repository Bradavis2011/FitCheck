import { createHmac } from 'crypto';
import { prisma } from '../utils/prisma.js';

// ─── OAuth 1.0a Helpers ───────────────────────────────────────────────────────

function enc(s: string): string {
  return encodeURIComponent(s);
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

  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map(k => `${enc(k)}=${enc(oauthParams[k])}`)
    .join('&');

  const base = `${method}&${enc(url)}&${enc(sortedParams)}`;
  const signingKey = `${enc(apiSecret)}&${enc(accessTokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(base).digest('base64');
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .map(k => `${enc(k)}="${enc(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Post to Twitter ──────────────────────────────────────────────────────────

export async function postToTwitter(
  socialPostId: string,
): Promise<{ posted: boolean; tweetId?: string; error?: string; detail?: unknown }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
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
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tweetText }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      let parsedErr: unknown = errBody;
      try { parsedErr = JSON.parse(errBody); } catch { /* keep raw */ }
      console.error(`[Twitter] API error ${response.status}:`, errBody);
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
    console.log(`[Twitter] Tweet posted: ${tweetId}`);
    return { posted: true, tweetId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Twitter] Failed to post tweet:', err);
    return { posted: false, error: errMsg };
  }
}
