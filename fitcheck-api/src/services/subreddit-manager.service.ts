/**
 * Subreddit Manager — Or This?
 *
 * Owns the r/OrThis subreddit. Posts 3x/week (Mon/Wed/Fri) with curated
 * fashion content that drives discovery without being promotional:
 *
 *   Monday  — Celebrity / award-season outfit breakdown
 *   Wednesday — Street style breakdown or style tip
 *   Friday  — "Rate this look" discussion post
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
 *
 * To bootstrap: create a Reddit "script" app at reddit.com/prefs/apps, use
 * the bot account as the developer. The bot account must be a moderator of
 * the subreddit to enable flair/sticky if needed.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { trackServerEvent } from '../lib/posthog.js';

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

// ─── Content Generation ───────────────────────────────────────────────────────

interface GeneratedPost {
  title: string;
  body: string;
  contentType: 'celebrity_breakdown' | 'street_style' | 'rate_this_look';
}

async function generatePost(contentType: GeneratedPost['contentType']): Promise<GeneratedPost | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompts: Record<GeneratedPost['contentType'], string> = {
    celebrity_breakdown: `
You write engaging Reddit posts about fashion for r/${SUBREDDIT}, a community for people who care about how they dress.
Today is ${today}.

Write a Reddit post breaking down a REAL celebrity outfit from a recent event (awards, red carpet, street paparazzi, etc.).
The post should be analytical — what's working, what's not, why it works or doesn't. Reference specific garments, fit, and styling choices.
Don't be sycophantic. Real fashion commentary.

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

Format:
TITLE: (compelling, 60-120 chars — include "rate" or "thoughts on" or a question)
BODY: (2-3 paragraphs describing the look and what's interesting/debatable about it, ends with specific questions)

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

async function postedThisWeek(): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

  if (await postedThisWeek()) {
    console.log('[SubredditManager] Already posted this week — skipping');
    return;
  }

  const dayOfWeek = new Date().getUTCDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  const contentTypeByDay: Record<number, GeneratedPost['contentType']> = {
    1: 'celebrity_breakdown', // Monday
    3: 'street_style',        // Wednesday
    5: 'rate_this_look',      // Friday
  };

  const contentType = contentTypeByDay[dayOfWeek];
  if (!contentType) {
    console.log('[SubredditManager] Not a posting day — skipping');
    return;
  }

  console.log(`[SubredditManager] Generating ${contentType} post for r/${SUBREDDIT}...`);

  const post = await generatePost(contentType);
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
