import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHmac } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Trend Data ───────────────────────────────────────────────────────────────

async function getTrendData(): Promise<{ topStyles: string[]; popularOccasions: string[]; colorTrends: string[] }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentDNA, recentChecks] = await Promise.all([
    prisma.styleDNA.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { styleArchetypes: true, dominantColors: true },
      take: 200,
    }),
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
      select: { occasions: true },
      take: 200,
    }),
  ]);

  const archetypeCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();

  for (const dna of recentDNA) {
    for (const a of dna.styleArchetypes) archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
    for (const c of dna.dominantColors) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
  }

  const occasionCounts = new Map<string, number>();
  for (const check of recentChecks) {
    for (const occ of check.occasions) occasionCounts.set(occ, (occasionCounts.get(occ) || 0) + 1);
  }

  return {
    topStyles: [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s),
    popularOccasions: [...occasionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([o]) => o),
    colorTrends: [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c),
  };
}

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

export async function postToTwitter(socialPostId: string): Promise<{ posted: boolean; tweetId?: string; error?: string }> {
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
      await prisma.socialPost.update({
        where: { id: socialPostId },
        data: { status: 'rejected', engagement: { error: errBody, status: response.status } },
      });
      return { posted: false, error: `twitter_api_${response.status}` };
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

// ─── Weekly Draft Generation ──────────────────────────────────────────────────

export async function runSocialMediaManager(): Promise<void> {
  console.log('[SocialMediaManager] Weekly run — generating post drafts...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[SocialMediaManager] GEMINI_API_KEY not set — skipping');
    return;
  }

  try {
    const trends = await getTrendData();
    const trendSummary = [
      trends.topStyles.length > 0 ? `Top styles: ${trends.topStyles.join(', ')}` : '',
      trends.popularOccasions.length > 0 ? `Popular occasions: ${trends.popularOccasions.join(', ')}` : '',
      trends.colorTrends.length > 0 ? `Trending colors: ${trends.colorTrends.join(', ')}` : '',
    ].filter(Boolean).join('. ') || 'Mixed community styles';

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Generate 5 social media post drafts for "Or This?", an AI-powered outfit feedback app.
Tagline: "Confidence in every choice"
Brand voice: warm, encouraging, supportive — like a stylish best friend.
This week's community trends: ${trendSummary}

Return a JSON array only (no markdown fences):
[
  {
    "platform": "twitter",
    "caption": "tweet text max 220 chars (leave room for hashtags)",
    "hashtags": ["OrThis", "OutfitCheck", "StyleAdvice"],
    "imageDescription": "description of ideal accompanying image"
  }
]

Mix of: inspirational style tips, community highlights, feature spotlights, trend commentary, CTAs.
All 5 posts should be varied in tone and content. No emojis in hashtags. Max 4 hashtags per post.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.error('[SocialMediaManager] Could not parse Gemini response for post drafts');
      return;
    }

    const drafts = JSON.parse(jsonMatch[0]) as Array<{
      platform?: string;
      caption?: string;
      hashtags?: string[];
      imageDescription?: string;
    }>;

    let queued = 0;

    for (const draft of drafts.slice(0, 5)) {
      if (!draft.caption) continue;

      const platform = draft.platform || 'twitter';
      const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags : ['OrThis'];
      const content = draft.caption;

      // Insert draft into SocialPost table first
      const post = await prisma.socialPost.create({
        data: {
          platform,
          content,
          hashtags,
          status: 'draft',
        },
      });

      // Queue for founder approval (risk=high → goes to pending queue)
      await executeOrQueue(
        'social-media-manager',
        'post_social',
        'high',
        { socialPostId: post.id, platform, content, hashtags } as unknown as Record<string, unknown>,
        async (payload) => {
          const p = payload as { socialPostId: string; platform: string };
          if (p.platform === 'twitter') {
            return await postToTwitter(p.socialPostId);
          }
          console.log(`[SocialMediaManager] Platform "${p.platform}" requires manual posting`);
          return { posted: false, note: 'manual_posting_required' };
        },
        content,
      );

      queued++;
    }

    console.log(`[SocialMediaManager] ${queued} post draft(s) queued for approval`);
  } catch (err) {
    console.error('[SocialMediaManager] Draft generation failed:', err);
  }
}
