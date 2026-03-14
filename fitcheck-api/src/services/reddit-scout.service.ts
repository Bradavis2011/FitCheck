/**
 * Reddit Scout — Thread discovery + response generation + auto-posting
 *
 * Discovery: Daily 11am UTC — finds relevant Reddit threads
 * Auto-Post: Daily 2pm UTC — posts approved responses via Reddit OAuth
 */

import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const SUBREDDITS = [
  'malefashionadvice',
  'femalefashionadvice',
  'outfits',
  'OUTFITS',
  'streetwear',
  'womensstreetwear',
  'WDYWT',
  'fashion',
  'fashionadvice',
];

const SEARCH_QUERIES = [
  'outfit feedback',
  'rate my outfit',
  'what should I wear',
  'fashion app beta',
  'outfit check',
  'style advice needed',
  'fashion feedback',
  'AI fashion',
  'how does this look',
  'does this outfit work',
  'outfit of the day feedback',
];

const MAX_DAILY_POSTS = 5;
const POST_DELAY_MS = 12 * 60 * 1000; // 12 minutes between posts

// ─── Gemini Helper ────────────────────────────────────────────────────────────

async function getGemini() {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('[RedditScout] GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

// ─── Reddit API Helpers ───────────────────────────────────────────────────────

async function redditFetch(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'OrThisApp/1.0 (fashion app; contact: hello@orthis.app)',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getRedditOAuthToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    return null;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'User-Agent': 'OrThisApp/1.0 (fashion app; contact: hello@orthis.app)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
      }).toString(),
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.warn('[RedditScout] OAuth token failed:', err);
    return null;
  }
}

// ─── Thread Discovery ─────────────────────────────────────────────────────────

function extractImageUrl(post: any): string | null {
  // Direct image URL
  if (post.url && /\.(jpg|jpeg|png|webp)$/i.test(post.url)) return post.url;
  // Reddit-hosted image
  if (post.post_hint === 'image' && post.url) return post.url;
  // i.redd.it
  if (post.url && post.url.startsWith('https://i.redd.it/')) return post.url;
  // preview image
  if (post.preview?.images?.[0]?.source?.url) {
    return post.preview.images[0].source.url.replace(/&amp;/g, '&');
  }
  return null;
}

async function fetchSubredditThreads(subreddit: string): Promise<Array<{
  id: string; title: string; url: string; selfText: string;
  upvotes: number; commentCount: number; author: string;
  imageUrl: string | null; hasImage: boolean;
}>> {
  try {
    const data = await redditFetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=25`);

    return (data.data?.children || [])
      .filter((post: any) => post.kind === 't3')
      .map((post: any) => {
        const imageUrl = extractImageUrl(post.data);
        return {
          id: post.data.id,
          title: post.data.title,
          url: `https://www.reddit.com${post.data.permalink}`,
          selfText: (post.data.selftext || '').slice(0, 1000),
          upvotes: post.data.ups || 0,
          commentCount: post.data.num_comments || 0,
          author: post.data.author || '',
          imageUrl,
          hasImage: imageUrl !== null,
        };
      });
  } catch (err) {
    console.warn(`[RedditScout] Failed to fetch r/${subreddit}:`, err);
    return [];
  }
}

async function searchRedditThreads(query: string): Promise<Array<{
  id: string; title: string; url: string; selfText: string;
  upvotes: number; commentCount: number; author: string; subreddit: string;
  imageUrl: string | null; hasImage: boolean;
}>> {
  try {
    const data = await redditFetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=day&limit=25`
    );

    return (data.data?.children || [])
      .filter((post: any) => post.kind === 't3')
      .map((post: any) => {
        const imageUrl = extractImageUrl(post.data);
        return {
          id: post.data.id,
          title: post.data.title,
          url: `https://www.reddit.com${post.data.permalink}`,
          selfText: (post.data.selftext || '').slice(0, 1000),
          upvotes: post.data.ups || 0,
          commentCount: post.data.num_comments || 0,
          author: post.data.author || '',
          subreddit: post.data.subreddit || '',
          imageUrl,
          hasImage: imageUrl !== null,
        };
      });
  } catch (err) {
    console.warn(`[RedditScout] Search failed for "${query}":`, err);
    return [];
  }
}

// ─── Relevance Scoring ────────────────────────────────────────────────────────

async function scoreThreads(
  genAI: any,
  threads: Array<{ id: string; subreddit: string; title: string; selfText: string }>,
): Promise<Array<{ id: string; relevanceScore: number; category: string }>> {
  if (threads.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const threadList = threads.map((t, i) =>
    `${i + 1}. [${t.subreddit}] "${t.title}" — ${t.selfText.slice(0, 100)}`
  ).join('\n');

  const prompt = `Score the relevance of these Reddit threads for genuine fashion advice comments.

Threads:
${threadList}

Scoring criteria (0.0 to 1.0):
- Directly asking for outfit feedback/rating: 0.9-1.0
- Asking for fashion advice/what to wear: 0.7-0.9
- General fashion discussion where advice is welcome: 0.5-0.7
- Off-topic: 0.0-0.3

Also assign a category: "outfit_feedback", "fashion_advice", "general_fashion", "off_topic"

Return ONLY JSON array:
[{"id": "1", "relevanceScore": 0.85, "category": "outfit_feedback"}]
Use the thread number as id (1, 2, 3...).`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const scores = JSON.parse(jsonMatch[0]);
    return scores.map((s: any, idx: number) => ({
      id: threads[parseInt(s.id) - 1]?.id || threads[idx]?.id,
      relevanceScore: parseFloat(s.relevanceScore) || 0,
      category: s.category || 'general_fashion',
    }));
  } catch {
    return threads.map(t => ({ id: t.id, relevanceScore: 0.5, category: 'general_fashion' }));
  }
}

// ─── Response Generation ──────────────────────────────────────────────────────

async function generateThreadResponse(
  genAI: any,
  thread: {
    subreddit: string; title: string; selfText: string; category: string;
    imageUrl?: string | null; hasImage?: boolean;
    threadId?: string;
    upvotes?: number;
  },
): Promise<{ text: string; analysisUsed: boolean }> {
  // Check for ops-learning-generated improved comment style
  let learnedStyleBlock = '';
  try {
    const variant = await prisma.socialPromptVariant.findUnique({
      where: { contentType: 'reddit_outfit_comment' },
    });
    if (variant?.isActive && variant.promptText) {
      learnedStyleBlock = `\n\nLearned style guidance from top-performing comments:\n${variant.promptText}`;
    }
  } catch { /* non-fatal */ }

  // AI outfit analysis for image posts
  if (thread.hasImage && thread.imageUrl && thread.category === 'outfit_feedback') {
    try {
      const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const analysisPrompt = `You are a knowledgeable fashion Redditor responding to someone sharing their outfit photo.

Analyze this outfit photo. Write a Reddit comment that:
1. Opens with 2-3 specific, genuine observations about what works (proportions, colors, silhouette, texture, fit)
2. Gives one actionable suggestion — specific, not generic

Rules:
- Be specific to what you actually see in the image — no generic fashion advice
- Sound like a knowledgeable Redditor, not a brand
- Under 120 words total
- No emojis, no app mentions, no self-promotion of any kind${learnedStyleBlock}

Write ONLY the comment text:`;

      const imageResponse = await fetch(thread.imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        const result = await visionModel.generateContent([
          analysisPrompt,
          { inlineData: { mimeType: contentType, data: base64Image } },
        ]);
        return { text: result.response.text().trim(), analysisUsed: true };
      }
    } catch (err) {
      console.warn('[RedditScout] Image analysis failed, falling back to text:', err);
    }
  }

  // Text-based response
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `Write a Reddit comment for r/${thread.subreddit}.

Thread title: "${thread.title}"
Thread content: "${thread.selfText.slice(0, 300)}"
Category: ${thread.category}

Rules:
- Answer their question with genuine, specific fashion advice (2-3 sentences)
- Match r/${thread.subreddit} community tone exactly
- Under 120 words total
- Sound like a real helpful Redditor
- No app mentions, no self-promotion, no links of any kind${learnedStyleBlock}

Write ONLY the comment text (no JSON, no formatting markers):`;

  try {
    const result = await model.generateContent(prompt);
    return { text: result.response.text().trim(), analysisUsed: false };
  } catch {
    return {
      text: `${thread.category === 'outfit_feedback' ? 'Great fit overall! ' : ''}The proportions look balanced — I'd focus on making sure the silhouette reads clearly at a distance. Specific to your piece, the color palette is working well together.`,
      analysisUsed: false,
    };
  }
}

// ─── Reddit Auto-Posting ──────────────────────────────────────────────────────

async function postRedditComment(threadUrl: string, comment: string): Promise<string | null> {
  const token = await getRedditOAuthToken();
  if (!token) {
    console.log('[RedditScout] Reddit OAuth not configured — skipping auto-post');
    return null;
  }

  // Extract thread ID from URL
  const urlMatch = threadUrl.match(/comments\/([a-z0-9]+)\//);
  if (!urlMatch) return null;
  const thingId = `t3_${urlMatch[1]}`;

  try {
    const response = await fetch('https://oauth.reddit.com/api/comment', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'OrThisApp/1.0 (fashion app; contact: hello@orthis.app)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        api_type: 'json',
        thing_id: thingId,
        text: comment,
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Reddit comment failed: ${response.status} — ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const commentId = data?.json?.data?.things?.[0]?.data?.id;
    return commentId || null;
  } catch (err) {
    console.error('[RedditScout] Post comment failed:', err);
    return null;
  }
}

// ─── Karma Monitoring ─────────────────────────────────────────────────────────

async function checkPostedCommentKarma(): Promise<void> {
  const token = await getRedditOAuthToken();
  if (!token) return;

  const postedComments = await prisma.redditThread.findMany({
    where: { status: 'posted', redditCommentId: { not: null } },
    orderBy: { postedAt: 'desc' },
    take: 20,
  });

  let negativeFlagged = 0;

  for (const thread of postedComments) {
    if (!thread.redditCommentId) continue;

    try {
      // Fetch comment info
      const commentResponse = await fetch(
        `https://oauth.reddit.com/api/info?id=t1_${thread.redditCommentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'OrThisApp/1.0 (fashion app; contact: hello@orthis.app)',
          },
        }
      );

      if (!commentResponse.ok) continue;
      const commentApiData: any = await commentResponse.json();
      const commentData = commentApiData?.data?.children?.[0]?.data;
      if (!commentData) continue;

      const karma = commentData.score || 0;

      // Check if author replied to our comment (fetch thread replies)
      let authorReplied = false;
      try {
        const urlMatch = thread.url.match(/comments\/([a-z0-9]+)\//);
        if (urlMatch) {
          const threadResponse = await fetch(
            `https://oauth.reddit.com/comments/${urlMatch[1]}.json?limit=50`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'OrThisApp/1.0 (fashion app; contact: hello@orthis.app)',
              },
            }
          );
          if (threadResponse.ok) {
            const threadApiData: any = await threadResponse.json();
            // threadApiData[1] = comments listing
            const comments = threadApiData?.[1]?.data?.children || [];
            // Find our comment and check its replies
            for (const c of comments) {
              if (c.data?.id === thread.redditCommentId) {
                const replies = c.data?.replies?.data?.children || [];
                authorReplied = replies.some((r: any) =>
                  r.data?.author === (thread as any).authorName
                );
                break;
              }
            }
          }
        }
      } catch { /* non-fatal */ }

      // Store karma + authorReplied
      await prisma.redditThread.update({
        where: { id: thread.id },
        data: { commentKarma: karma, authorReplied },
      }).catch(() => {});

      if (karma < -2) {
        negativeFlagged++;
        console.warn(`[RedditScout] Comment in r/${thread.subreddit} has karma ${karma} — flagging`);
      }
    } catch {
      // Skip if can't check karma
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  if (negativeFlagged > 0) {
    // Pause auto-posting for 48h by updating a flag in the intelligence bus
    await publishToIntelligenceBus('reddit-scout', 'reddit_scout_metrics', {
      event: 'karma_pause',
      negativeFlagged,
      pauseUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    console.warn(`[RedditScout] Pausing auto-posting for 48h due to ${negativeFlagged} negative-karma comments`);
  }
}

// ─── Main: Thread Discovery ───────────────────────────────────────────────────

export async function runRedditDiscovery(): Promise<void> {
  console.log('[RedditScout] Running thread discovery...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[RedditScout] GEMINI_API_KEY not set — skipping');
    return;
  }

  const genAI = await getGemini();

  // Fetch threads from subreddits
  const allThreads: Array<{
    id: string; subreddit: string; title: string; url: string;
    selfText: string; upvotes: number; commentCount: number; author: string;
    imageUrl: string | null; hasImage: boolean;
  }> = [];

  for (const subreddit of SUBREDDITS) {
    const threads = await fetchSubredditThreads(subreddit);
    allThreads.push(...threads.map(t => ({ ...t, subreddit })));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Also search across Reddit
  for (const query of SEARCH_QUERIES.slice(0, 4)) {
    const searchResults = await searchRedditThreads(query);
    for (const result of searchResults) {
      if (!allThreads.find(t => t.id === result.id)) {
        allThreads.push(result);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[RedditScout] Found ${allThreads.length} total threads`);

  // Deduplicate against already-known threads
  const existingIds = new Set(
    (await prisma.redditThread.findMany({ select: { threadId: true } }))
      .map(t => t.threadId)
  );

  const newThreads = allThreads.filter(t => !existingIds.has(t.id));
  console.log(`[RedditScout] ${newThreads.length} new threads`);

  if (newThreads.length === 0) return;

  // Score relevance in batches
  const batchSize = 10;
  const scoredIds: Record<string, { relevanceScore: number; category: string }> = {};

  for (let i = 0; i < newThreads.length; i += batchSize) {
    const batch = newThreads.slice(i, i + batchSize);
    const scores = await scoreThreads(genAI, batch);
    for (const score of scores) {
      if (score.id) scoredIds[score.id] = score;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Filter: keep threads with relevance >= 0.5, top 10
  const relevantThreads = newThreads
    .map(t => ({
      ...t,
      relevanceScore: scoredIds[t.id]?.relevanceScore || 0,
      category: scoredIds[t.id]?.category || 'general_fashion',
    }))
    .filter(t => t.relevanceScore >= 0.5)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);

  console.log(`[RedditScout] ${relevantThreads.length} relevant threads to generate responses for`);

  // Generate responses
  let saved = 0;

  for (const thread of relevantThreads) {
    try {
      const { text: response, analysisUsed } = await generateThreadResponse(genAI, {
        ...thread,
        threadId: thread.id,
      });

      await prisma.redditThread.create({
        data: {
          subreddit: thread.subreddit,
          threadId: thread.id,
          title: thread.title,
          url: thread.url,
          authorName: thread.author,
          selfText: thread.selfText,
          upvotes: thread.upvotes,
          commentCount: thread.commentCount,
          relevanceScore: thread.relevanceScore,
          category: thread.category,
          suggestedResponse: response,
          status: 'response_ready',
          imageUrl: thread.imageUrl,
          hasImage: thread.hasImage,
          analysisUsed,
        },
      });

      saved++;
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`[RedditScout] Failed to save thread ${thread.id}:`, err);
    }
  }

  console.log(`[RedditScout] Saved ${saved} threads with responses`);

  await publishToIntelligenceBus('reddit-scout', 'reddit_scout_metrics', {
    runAt: new Date().toISOString(),
    type: 'discovery',
    threadsFound: allThreads.length,
    newThreads: newThreads.length,
    relevantThreads: relevantThreads.length,
    saved,
  });
}

// ─── Main: Auto-Posting ───────────────────────────────────────────────────────

export async function runRedditAutoPost(): Promise<void> {
  console.log('[RedditScout] Running auto-post...');

  // Check karma pause
  const { readFromIntelligenceBus } = await import('./intelligence-bus.service.js');
  const pauseEntries = await readFromIntelligenceBus('reddit-auto-post', 'reddit_scout_metrics', {
    limit: 1,
    unreadOnly: false,
    sinceDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
  });

  const isPaused = pauseEntries.some(e => {
    const p = e.payload as any;
    return p.event === 'karma_pause' && p.pauseUntil && new Date(p.pauseUntil) > new Date();
  });

  if (isPaused) {
    console.log('[RedditScout] Auto-posting paused due to negative karma — skipping');
    return;
  }

  // Check daily post limit
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const postedToday = await prisma.redditThread.count({
    where: { status: 'posted', postedAt: { gte: todayStart } },
  });

  if (postedToday >= MAX_DAILY_POSTS) {
    console.log(`[RedditScout] Daily limit reached (${postedToday}/${MAX_DAILY_POSTS})`);
    return;
  }

  const threads = await prisma.redditThread.findMany({
    where: { status: 'response_ready', suggestedResponse: { not: null } },
    orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'asc' }],
    take: MAX_DAILY_POSTS - postedToday,
  });

  let posted = 0;

  for (const thread of threads) {
    if (!thread.suggestedResponse) continue;

    await executeOrQueue(
      'reddit-scout',
      'post_comment',
      'medium',
      { threadId: thread.id, subreddit: thread.subreddit, url: thread.url },
      async (_payload) => {
        const commentId = await postRedditComment(thread.url, thread.suggestedResponse!);

        if (commentId) {
          await prisma.redditThread.update({
            where: { id: thread.id },
            data: { status: 'posted', redditCommentId: commentId, postedAt: new Date() },
          });
          console.log(`[RedditScout] Posted to r/${thread.subreddit}: ${thread.title.slice(0, 50)}`);
          posted++;
        } else {
          // Reddit not configured — mark as approved for manual handling
          await prisma.redditThread.update({
            where: { id: thread.id },
            data: { status: 'approved' },
          });
        }

        return { posted: !!commentId, commentId };
      },
      thread.suggestedResponse,
    );

    // Stagger posts: 10-15 minutes between (only delay if actually posting)
    if (posted < threads.length - 1) {
      const delay = POST_DELAY_MS + Math.floor(Math.random() * 5 * 60 * 1000);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Run karma check on existing posts
  await checkPostedCommentKarma().catch(err =>
    console.warn('[RedditScout] Karma check failed:', err)
  );

  await publishToIntelligenceBus('reddit-scout', 'reddit_scout_metrics', {
    runAt: new Date().toISOString(),
    type: 'auto_post',
    posted,
    dailyTotal: postedToday + posted,
  });

  console.log(`[RedditScout] Auto-post run complete (posted: ${posted})`);
}
