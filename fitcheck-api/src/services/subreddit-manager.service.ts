/**
 * Subreddit Manager — Or This?
 *
 * Owns the r/OrThis subreddit. Posts daily with 7 rotating content types
 * grounded in real app data (DiscoveredRules, outfit stats, fashion trends):
 *
 *   Day 0 (Sun) — celebrity_breakdown
 *   Day 1 (Mon) — street_style
 *   Day 2 (Tue) — rate_this_look
 *   Day 3 (Wed) — data_insight
 *   Day 4 (Thu) — trend_discussion
 *   Day 5 (Fri) — community_poll
 *   Day 6 (Sat) — outfit_challenge
 *
 * Posts go through executeOrQueue at medium risk (brand guard check before publish).
 * Uses the same Reddit OAuth2 password-grant flow as reddit-scout.service.ts.
 *
 * Env vars (shared with reddit-scout):
 *   REDDIT_CLIENT_ID        — script-type Reddit app client ID
 *   REDDIT_CLIENT_SECRET    — script-type Reddit app secret
 *   REDDIT_USERNAME         — bot account username
 *   REDDIT_PASSWORD         — bot account password
 *   REDDIT_SUBREDDIT        — subreddit name without r/ (default: OrThis)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { trackServerEvent } from '../lib/posthog.js';
import { getTrendData } from './content-calendar.service.js';
import { getLatestFashionTrendText } from './fashion-trends.service.js';

const SUBREDDIT = process.env.REDDIT_SUBREDDIT || 'OrThis';
const UA = 'OrThisApp/1.0 (fashion community; contact: hello@orthis.app)';

// ─── Reddit Auth ──────────────────────────────────────────────────────────────

async function getRedditToken(): Promise<string | null> {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) return null;

  try {
    const creds = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'password', username: REDDIT_USERNAME, password: REDDIT_PASSWORD }).toString(),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.warn('[SubredditManager] Reddit auth failed:', err);
    return null;
  }
}

// ─── Reddit Post Submission ───────────────────────────────────────────────────

async function submitRedditPost(token: string, title: string, body: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        sr: SUBREDDIT,
        kind: 'self',
        title,
        text: body,
        nsfw: 'false',
        spoiler: 'false',
        resubmit: 'true',
      }).toString(),
    });

    if (!res.ok) {
      console.warn('[SubredditManager] Submit failed:', res.status, await res.text());
      return null;
    }

    const data: any = await res.json();
    // Reddit returns nested JSON: { json: { data: { url: '...' } } }
    return data?.json?.data?.url || null;
  } catch (err) {
    console.warn('[SubredditManager] Post submission error:', err);
    return null;
  }
}

// ─── Learning Data Context ─────────────────────────────────────────────────────

async function buildDataContext(): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [rulesResult, checkStatsResult, trendDataResult, trendTextResult] = await Promise.allSettled([
    prisma.discoveredRule.findMany({
      where: { confidence: { gte: 0.65 } },
      orderBy: { confidence: 'desc' },
      take: 3,
    }),
    prisma.outfitCheck.aggregate({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
      _count: { id: true },
      _avg: { aiScore: true },
    }),
    getTrendData(),
    getLatestFashionTrendText(),
  ]);

  const parts: string[] = [];

  if (rulesResult.status === 'fulfilled' && rulesResult.value.length > 0) {
    parts.push('Top AI-discovered style rules (from real outfit data):');
    for (const rule of rulesResult.value) {
      parts.push(`- [${rule.category}] ${rule.rule} (confidence: ${Math.round(rule.confidence * 100)}%, n=${rule.sampleSize})`);
    }
  }

  if (checkStatsResult.status === 'fulfilled') {
    const count = checkStatsResult.value._count.id;
    const avg = checkStatsResult.value._avg.aiScore;
    if (count > 0) {
      parts.push(`\nApp data this week: ${count} outfit checks, avg AI score ${avg ? Math.round(avg * 10) / 10 : 'N/A'}/10`);
    }
  }

  if (trendDataResult.status === 'fulfilled') {
    const td = trendDataResult.value;
    if (td.topStyles.length > 0) parts.push(`Top styles in-app: ${td.topStyles.slice(0, 3).join(', ')}`);
    if (td.popularOccasions.length > 0) parts.push(`Top occasions: ${td.popularOccasions.slice(0, 3).join(', ')}`);
    if (td.colorTrends.length > 0) parts.push(`Color trends: ${td.colorTrends.slice(0, 3).join(', ')}`);
  }

  if (trendTextResult.status === 'fulfilled' && trendTextResult.value) {
    parts.push(`\nBroader fashion context: ${trendTextResult.value.slice(0, 250)}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No data available yet — use general fashion knowledge.';
}

// ─── Content Generation ───────────────────────────────────────────────────────

type ContentType =
  | 'celebrity_breakdown'
  | 'street_style'
  | 'rate_this_look'
  | 'data_insight'
  | 'trend_discussion'
  | 'community_poll'
  | 'outfit_challenge';

interface GeneratedPost {
  title: string;
  body: string;
  contentType: ContentType;
}

async function generatePost(contentType: ContentType, dataContext: string): Promise<GeneratedPost | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dataBlock = `\nReal data context (use this to ground your post in facts, not assumptions):\n${dataContext}`;

  const prompts: Record<ContentType, string> = {
    celebrity_breakdown: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a Reddit post breaking down a REAL celebrity outfit from a recent event (awards, red carpet, street paparazzi, etc.).
The post should be analytical — what's working, what's not, why it works or doesn't. Reference specific garments, fit, and styling choices.
Don't be sycophantic. Real fashion commentary.
${dataBlock}

Format:
TITLE: (compelling, specific, 60-120 chars — use the celebrity's name and event)
BODY: (3-5 paragraphs, conversational Reddit tone, ends with a question to drive engagement)

Output only TITLE: and BODY: with no other text.`.trim(),

    street_style: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a Reddit post about a street style trend, styling tip, or outfit formula that's working right now.
This should feel like sharing insider knowledge — something specific, actionable, and a little opinionated.
Reference specific garments, color combinations, or proportions. Give people something to try.
${dataBlock}

Format:
TITLE: (compelling, specific, 60-120 chars — a tip or observation they'll click)
BODY: (3-5 paragraphs, conversational Reddit tone, concrete advice, ends with a question)

Output only TITLE: and BODY: with no other text.`.trim(),

    rate_this_look: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a "Rate this look" discussion post about a REAL outfit (celebrity, influencer, or a style archetype like "the office-to-dinner transition look").
Frame it as asking the community to weigh in. Be specific about what you're presenting — describe the look in enough detail that people can picture it.
Encourage debate. Fashion opinions are fun.
${dataBlock}

Format:
TITLE: (compelling, 60-120 chars — include "rate" or "thoughts on" or a question)
BODY: (2-3 paragraphs describing the look and what's interesting/debatable about it, ends with specific questions)

Output only TITLE: and BODY: with no other text.`.trim(),

    data_insight: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a Reddit post sharing a surprising insight from real outfit data. Frame it as "we scored X outfits and found something interesting."
Use the actual numbers from the data context below. Don't make up stats — reference what's there.
The insight should feel like a genuine discovery that changes how people think about getting dressed.
${dataBlock}

Format:
TITLE: (compelling, 60-120 chars — lead with the insight or stat)
BODY: (2-4 paragraphs, conversational, explains what the data shows and why it's interesting, ends with a question)

Output only TITLE: and BODY: with no other text.`.trim(),

    trend_discussion: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a Reddit post asking whether a current fashion trend is actually good. Take a semi-controversial stance.
Use the trends referenced in the data context below — reference them by name. Don't fabricate trend names.
Debate structure: acknowledge why people like the trend, then push back on it, then invite the community to weigh in.
${dataBlock}

Format:
TITLE: (compelling, 60-120 chars — a question or light provocation about the trend)
BODY: (3-4 paragraphs, opinionated but fair, ends with "what do you think?" type question)

Output only TITLE: and BODY: with no other text.`.trim(),

    community_poll: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a "which do you follow?" community poll post about real styling rules or habits.
Use the discovered styling rules from the data context below as the poll options — these are real patterns from outfit data.
Frame it as a genuine debate between two valid approaches. No wrong answer.
${dataBlock}

Format:
TITLE: (compelling, 60-120 chars — a "which" or "do you" question about the rules)
BODY: (describe both options from the data, explain the trade-offs, invite people to share which they follow and why, 2-3 paragraphs)

Output only TITLE: and BODY: with no other text.`.trim(),

    outfit_challenge: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a "this week's styling challenge" post focused on a specific occasion from the data context.
The challenge should have a clear constraint (e.g., "build a complete [occasion] outfit for under $X" or "style [garment] 3 ways for [occasion]").
Use the top occasions from the data context to pick something relevant right now.
${dataBlock}

Format:
TITLE: (compelling, 60-120 chars — "Challenge:" or "This week's challenge:")
BODY: (explain the challenge, the rules/constraints, what makes it interesting, ends with "share your approach" or "what would you wear?")

Output only TITLE: and BODY: with no other text.`.trim(),
  };

  try {
    const result = await model.generateContent(prompts[contentType]);
    const text = result.response.text().trim();

    const titleMatch = text.match(/^TITLE:\s*(.+)/m);
    const bodyMatch = text.match(/^BODY:\s*([\s\S]+)/m);

    if (!titleMatch || !bodyMatch) {
      console.warn('[SubredditManager] Unexpected Gemini response format');
      return null;
    }

    return {
      title: titleMatch[1].trim(),
      body: bodyMatch[1].trim(),
      contentType,
    };
  } catch (err) {
    console.warn('[SubredditManager] Gemini generation failed:', err);
    return null;
  }
}

// ─── Dedup check ──────────────────────────────────────────────────────────────

async function postedToday(): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.socialPost.count({
    where: { platform: 'reddit', createdAt: { gte: since } },
  });
  return count > 0;
}

// ─── Queue post for brand-guarded execution ───────────────────────────────────

async function queueRedditPost(post: GeneratedPost): Promise<void> {
  // Persist as SocialPost for tracking
  const record = await prisma.socialPost.create({
    data: {
      platform: 'reddit',
      content: post.body,
      contentType: post.contentType,
      status: 'pending',
      hashtags: [],
      sourceData: undefined,
      trackingUrl: null,
    },
  });

  await executeOrQueue(
    'subreddit-manager',
    'submit_reddit_post',
    'medium',
    { socialPostId: record.id, title: post.title, body: post.body, contentType: post.contentType } as unknown as Record<string, unknown>,
    async (payload) => {
      const p = payload as { socialPostId: string; title: string; body: string };
      const token = await getRedditToken();
      if (!token) {
        console.warn('[SubredditManager] No Reddit token — post skipped');
        return { posted: false, reason: 'no_token' };
      }

      const url = await submitRedditPost(token, p.title, p.body);

      if (url) {
        await prisma.socialPost.update({
          where: { id: p.socialPostId },
          data: { status: 'posted', trackingUrl: url },
        });
        trackServerEvent('system', 'reddit_post_published', { subreddit: SUBREDDIT, url, contentType: (payload as any).contentType });
        console.log(`[SubredditManager] Posted to r/${SUBREDDIT}: ${url}`);
        return { posted: true, url };
      }

      await prisma.socialPost.update({ where: { id: p.socialPostId }, data: { status: 'failed' } });
      return { posted: false, reason: 'submit_failed' };
    },
    post.body,
  );
}

// ─── 7-day content type rotation ─────────────────────────────────────────────

const CONTENT_ROTATION: ContentType[] = [
  'celebrity_breakdown', // Sunday (0)
  'street_style',        // Monday (1)
  'rate_this_look',      // Tuesday (2)
  'data_insight',        // Wednesday (3)
  'trend_discussion',    // Thursday (4)
  'community_poll',      // Friday (5)
  'outfit_challenge',    // Saturday (6)
];

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runSubredditManager(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('[SubredditManager] GEMINI_API_KEY not set — skipping');
    return;
  }

  if (!process.env.REDDIT_CLIENT_ID) {
    console.log('[SubredditManager] REDDIT_CLIENT_ID not set — skipping');
    return;
  }

  if (await postedToday()) {
    console.log('[SubredditManager] Already posted today — skipping');
    return;
  }

  const dayOfWeek = new Date().getUTCDay(); // 0=Sun ... 6=Sat
  const contentType = CONTENT_ROTATION[dayOfWeek];

  console.log(`[SubredditManager] Generating ${contentType} post for r/${SUBREDDIT}...`);

  const dataContext = await buildDataContext();
  const post = await generatePost(contentType, dataContext);
  if (!post) {
    console.warn('[SubredditManager] Content generation failed — skipping');
    return;
  }

  console.log(`[SubredditManager] Post ready: "${post.title}"`);
  await queueRedditPost(post);
}

// ─── Executor registration ────────────────────────────────────────────────────

export function registerExecutors(): void {
  // Executors are registered inline in queueRedditPost via executeOrQueue.
  // This function exists for consistency with the scheduler import pattern.
}

registerExecutors();
