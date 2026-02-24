/**
 * Social Content Engine — 7 specialized content generators
 *
 * Each generator produces 1-2 posts from a different angle:
 *  1. Founder Story      — recent GitHub commits → first-person story
 *  2. Fashion News Take  — RSS headlines → genuine opinion/reaction
 *  3. Community Spotlight— StyleDNA trend data → celebrate the community
 *  4. Style Data Drop    — outfit check aggregates → surprising stat post
 *  5. Wardrobe Insight   — WardrobeItem aggregates → fun wardrobe discovery
 *  6. Conversation Starter — pure Gemini creative → no product mention
 *  7. Behind the Scenes  — growth metrics → founder diary / build-in-public
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { getTrendData } from './content-calendar.service.js';
import { getLatestFashionTrendText } from './fashion-trends.service.js';
import { getGrowthSummary } from './growth-dashboard.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface GeneratedPost {
  platform: 'twitter' | 'tiktok' | 'pinterest';
  content: string;
  hashtags: string[];
  contentType: string;
  sourceData?: unknown;
  imageDescription?: string;
}

// ─── Gemini Helper ────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Generator 1: Founder Story ───────────────────────────────────────────────

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
  files?: Array<{ filename: string }>;
}

async function fetchRecentCommits(): Promise<GitHubCommit[]> {
  const owner = process.env.GITHUB_REPO_OWNER || 'Bradavis2011';
  const repo = process.env.GITHUB_REPO_NAME || 'FitCheck';
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'OrThis-SocialBot/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=15&since=${since}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }

  const commits = (await res.json()) as GitHubCommit[];

  // Filter out merge commits and trivial CI-only changes
  return commits.filter(c => {
    const msg = c.commit.message.toLowerCase();
    return (
      !msg.startsWith('merge') &&
      !msg.includes('ci:') &&
      !msg.includes('chore: bump') &&
      msg.length > 10
    );
  }).slice(0, 8);
}

export async function generateFounderStory(): Promise<GeneratedPost[]> {
  let commits: GitHubCommit[];
  try {
    commits = await fetchRecentCommits();
  } catch (err) {
    console.warn('[ContentEngine] GitHub fetch failed — skipping founder story:', err);
    return [];
  }

  if (commits.length === 0) {
    console.log('[ContentEngine] No meaningful commits this week — skipping founder story');
    return [];
  }

  const commitSummary = commits
    .map(c => `- ${c.commit.message.split('\n')[0].slice(0, 120)}`)
    .join('\n');

  const twitterPrompt = `You are the founder of "Or This?", an AI outfit feedback app for Gen Z. Write a Twitter post about a recent update you shipped. Don't announce the feature like a press release — tell the STORY. Why you built it, what problem it solves, or what you learned building it.

Recent changes shipped this week:
${commitSummary}

Pick ONE change that has the best human story behind it.

Rules:
- First person ("we" or "I")
- Max 220 chars (we add hashtags separately)
- Sound like a real person building something, not a brand account
- No "excited to announce" or "we're thrilled" or "game-changer"
- End with something that invites a response — a question, a vulnerability, a hot take
- No hashtags in the text itself

Return ONLY the tweet text, nothing else.`;

  const twitterText = await callGemini(twitterPrompt);

  const tiktokPrompt = `You are the founder of "Or This?", an AI outfit feedback app. Write a TikTok caption + video concept for a "building in public" post about this recent change:

${commitSummary.split('\n')[0]}

Format:
Hook: [1 sentence that stops the scroll]

Video concept: [30-second video idea — no fancy equipment needed]

Caption: [2-3 sentences expanding on the hook]

Suggested format: [e.g., "POV: startup founder", "Day in my life", "Behind the scenes"]

Keep it authentic, imperfect, real. Gen Z tone.`;

  const tiktokRaw = await callGemini(tiktokPrompt);

  const sourceData = { commits: commits.map(c => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split('\n')[0] })) };

  const posts: GeneratedPost[] = [
    {
      platform: 'twitter',
      content: twitterText.slice(0, 220),
      hashtags: ['BuildingInPublic', 'OrThis', 'StartupLife'],
      contentType: 'founder_story',
      sourceData,
      imageDescription: 'Screenshot of the app feature or code editor — raw and unpolished',
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: ['BuildingInPublic', 'StartupTok', 'AppDevelopment', 'OrThis'],
      contentType: 'founder_story',
      sourceData,
      imageDescription: 'Authentic screen recording or face-to-camera talking about the feature',
    },
  ];

  return posts;
}

// ─── Generator 2: Fashion News Take ──────────────────────────────────────────

interface RssFeed {
  name: string;
  url: string;
}

const RSS_FEEDS: RssFeed[] = [
  { name: 'Vogue', url: 'https://www.vogue.com/feed/rss' },
  { name: 'WWD', url: 'https://wwd.com/feed/' },
  { name: 'Fashionista', url: 'https://fashionista.com/feed' },
];

function extractRssTitles(xml: string, source: string): Array<{ title: string; link: string; source: string }> {
  const items: Array<{ title: string; link: string; source: string }> = [];
  // Match <item> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[1];

    // Extract title — handle CDATA
    const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>([^<]+)<\/link>/i) || block.match(/<guid[^>]*>([^<]+)<\/guid>/i);

    if (titleMatch?.[1]) {
      items.push({
        title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
        link: linkMatch?.[1]?.trim() || '',
        source,
      });
    }

    if (items.length >= 8) break;
  }

  return items;
}

export async function generateFashionNewsTake(): Promise<GeneratedPost[]> {
  const allHeadlines: Array<{ title: string; link: string; source: string }> = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'OrThis-SocialBot/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[ContentEngine] RSS ${feed.name} returned ${res.status} — skipping`);
        continue;
      }
      const xml = await res.text();
      const headlines = extractRssTitles(xml, feed.name);
      allHeadlines.push(...headlines);
      console.log(`[ContentEngine] RSS ${feed.name}: ${headlines.length} headlines`);
    } catch (err) {
      console.warn(`[ContentEngine] RSS ${feed.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  if (allHeadlines.length === 0) {
    console.log('[ContentEngine] No RSS headlines available — skipping fashion news');
    return [];
  }

  // Ask Gemini to pick the most interesting headline
  const headlineList = allHeadlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title}`).join('\n');

  const pickPrompt = `You run "Or This?", an AI outfit feedback app. Which of these fashion headlines would make the most interesting social media take — something everyday people would actually care about or have an opinion on?

Headlines:
${headlineList}

Reply with ONLY the number (e.g., "3"). Nothing else.`;

  const pickedRaw = await callGemini(pickPrompt);
  const pickedIdx = (parseInt(pickedRaw.trim(), 10) || 1) - 1;
  const picked = allHeadlines[Math.min(pickedIdx, allHeadlines.length - 1)];

  const tweetPrompt = `You run "Or This?", an AI outfit feedback app. React to this fashion headline as a founder who genuinely cares about how people feel about their own style choices.

Headline: "${picked.title}"
Source: ${picked.source}

Rules:
- Have a genuine TAKE — agree, disagree, add nuance. Don't be neutral.
- Reference seeing the article naturally ("saw this in ${picked.source} today...", "just read that...")
- Connect it back to everyday people's style decisions — not runway fashion
- Max 220 chars
- No link in the text (we'll add source URL separately)
- Sound like a person with opinions, not a brand account
- No hashtags in the text itself

Return ONLY the tweet text, nothing else.`;

  const tweetText = await callGemini(tweetPrompt);

  const tiktokPrompt = `You run "Or This?", an AI outfit feedback app. React to this fashion headline in a TikTok format — be opinionated, relatable, real.

Headline: "${picked.title}" (${picked.source})

Format:
Hook: [controversial or relatable opener]

Take: [your honest opinion in 2-3 sentences — can be agree, disagree, or "it's complicated"]

Question for comments: [1 question that will get replies]

Suggested format: [e.g., "POV", "Hot take", "Unpopular opinion", "Story time"]`;

  const tiktokRaw = await callGemini(tiktokPrompt);

  const sourceData = { headline: picked.title, source: picked.source, link: picked.link };

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['Fashion', 'StyleTalk', 'OrThis'],
      contentType: 'fashion_news',
      sourceData,
      imageDescription: `Screenshot or graphic quoting the headline from ${picked.source}`,
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: ['FashionTok', 'StyleTalk', 'FashionNews', 'OrThis', 'StyleAdvice'],
      contentType: 'fashion_news',
      sourceData,
      imageDescription: 'Face-to-camera reaction or text overlay on fashion photo',
    },
  ];
}

// ─── Generator 3: Community Spotlight ────────────────────────────────────────

export async function generateCommunitySpotlight(): Promise<GeneratedPost[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [trends, trendText, weekStats] = await Promise.all([
    getTrendData().catch(() => ({ topStyles: [], popularOccasions: [], colorTrends: [] })),
    getLatestFashionTrendText().catch(() => null),
    prisma.outfitCheck.aggregate({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
      _count: { id: true },
      _avg: { aiScore: true },
    }),
  ]);

  const totalChecks = weekStats._count.id;
  const avgScore = weekStats._avg.aiScore ? Math.round(weekStats._avg.aiScore * 10) / 10 : null;

  // Need at least some data to make this meaningful
  if (totalChecks === 0 && trends.topStyles.length === 0) {
    console.log('[ContentEngine] Insufficient community data — skipping spotlight');
    return [];
  }

  const dataContext = [
    `${totalChecks} outfit checks submitted this week`,
    trends.topStyles.length > 0 ? `Top styles: ${trends.topStyles.slice(0, 3).join(', ')}` : '',
    trends.popularOccasions.length > 0 ? `Popular occasions: ${trends.popularOccasions.slice(0, 3).join(', ')}` : '',
    trends.colorTrends.length > 0 ? `Trending colors: ${trends.colorTrends.slice(0, 3).join(', ')}` : '',
    avgScore ? `Average confidence score: ${avgScore}/10` : '',
    trendText ? `Broader fashion context: ${trendText.slice(0, 200)}` : '',
  ].filter(Boolean).join('\n');

  const tweetPrompt = `Write a social post celebrating the Or This? community's style choices this week. Make it feel like you're talking about real people you admire, not metrics.

This week's data:
${dataContext}

Rules:
- Celebrate the PEOPLE and their choices, not the product
- Reference specific trends in a way that feels personal ("y'all are really into earth tones this week", "the work outfit game has been strong")
- Conversational, warm, Gen Z-friendly
- Max 220 chars
- Don't mention app features or download CTAs
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGemini(tweetPrompt);

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['OrThis', 'StyleCommunity', 'OOTD'],
      contentType: 'community_spotlight',
      sourceData: { totalChecks, avgScore, topStyles: trends.topStyles, popularOccasions: trends.popularOccasions, colorTrends: trends.colorTrends },
      imageDescription: 'Mood board collage or simple graphic showing top style categories',
    },
  ];
}

// ─── Generator 4: Style Data Drop ─────────────────────────────────────────────

export async function generateStyleDataDrop(): Promise<GeneratedPost[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [occasionStats, dnaStats, totalChecks] = await Promise.all([
    prisma.outfitCheck.findMany({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
      select: { occasions: true, aiScore: true },
      take: 500,
    }),
    prisma.styleDNA.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { colorHarmony: true, silhouetteType: true },
      take: 300,
    }),
    prisma.outfitCheck.count({
      where: { createdAt: { gte: weekAgo }, isDeleted: false },
    }),
  ]);

  if (totalChecks < 5) {
    console.log('[ContentEngine] Not enough data for style data drop — skipping');
    return [];
  }

  // Aggregate occasion counts
  const occasionCounts = new Map<string, { count: number; totalScore: number }>();
  for (const check of occasionStats) {
    for (const occ of check.occasions) {
      const entry = occasionCounts.get(occ) || { count: 0, totalScore: 0 };
      entry.count++;
      if (check.aiScore) entry.totalScore += check.aiScore;
      occasionCounts.set(occ, entry);
    }
  }

  const topOccasion = [...occasionCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)[0];

  const topOccasionPct = topOccasion
    ? Math.round((topOccasion[1].count / totalChecks) * 100)
    : null;
  const topOccasionAvgScore = topOccasion && topOccasion[1].count > 0
    ? Math.round((topOccasion[1].totalScore / topOccasion[1].count) * 10) / 10
    : null;

  // Aggregate DNA stats
  const harmonyCounts = new Map<string, number>();
  const silhouetteCounts = new Map<string, number>();
  for (const dna of dnaStats) {
    if (dna.colorHarmony) harmonyCounts.set(dna.colorHarmony, (harmonyCounts.get(dna.colorHarmony) || 0) + 1);
    if (dna.silhouetteType) silhouetteCounts.set(dna.silhouetteType, (silhouetteCounts.get(dna.silhouetteType) || 0) + 1);
  }

  const topHarmony = [...harmonyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topSilhouette = [...silhouetteCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const statsContext = [
    `Total outfit checks this week: ${totalChecks}`,
    topOccasion && topOccasionPct ? `Most common occasion: "${topOccasion[0]}" (${topOccasionPct}% of checks)` : '',
    topOccasionAvgScore ? `Average AI score for ${topOccasion?.[0]} outfits: ${topOccasionAvgScore}/10` : '',
    topHarmony ? `Most common color harmony: ${topHarmony}` : '',
    topSilhouette ? `Most common silhouette: ${topSilhouette}` : '',
  ].filter(Boolean).join('\n');

  const tweetPrompt = `Turn this style data into a surprising, shareable social media post. Pick the single most interesting or unexpected stat and frame it as a discovery.

Data:
${statsContext}

Rules:
- Lead with the number or stat ("73% of you...", "Turns out...")
- Make people think "huh, that's interesting" or "wait, that's me"
- Add a question or light hot take after the stat
- Max 220 chars
- Conversational, not corporate-data-report tone
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGemini(tweetPrompt);

  const sourceData = {
    totalChecks,
    topOccasion: topOccasion?.[0],
    topOccasionPct,
    topOccasionAvgScore,
    topHarmony,
    topSilhouette,
  };

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['StyleData', 'FashionStats', 'OrThis'],
      contentType: 'style_data_drop',
      sourceData,
      imageDescription: 'Clean data visualization graphic with brand colors',
    },
  ];
}

// ─── Generator 5: Wardrobe Insight ────────────────────────────────────────────

export async function generateWardrobeInsight(): Promise<GeneratedPost[]> {
  const totalItems = await prisma.wardrobeItem.count();

  if (totalItems < 10) {
    console.log(`[ContentEngine] Only ${totalItems} wardrobe items — skipping wardrobe insight`);
    return [];
  }

  const [categoryStats, mostWorn, colorStats] = await Promise.all([
    // Most common categories
    prisma.wardrobeItem.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 3,
    }),
    // Most worn single item (globally)
    prisma.wardrobeItem.findFirst({
      where: { timesWorn: { gt: 0 } },
      orderBy: { timesWorn: 'desc' },
      select: { normalizedName: true, name: true, category: true, timesWorn: true, color: true },
    }),
    // Most common colors
    prisma.wardrobeItem.groupBy({
      by: ['color'],
      where: { color: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 3,
    }),
  ]);

  const topCategory = categoryStats[0];
  const topColors = colorStats.filter(c => c.color).map(c => c.color as string);

  const insightContext = [
    topCategory ? `Most common wardrobe category: "${topCategory.category}" (${topCategory._count.id} items)` : '',
    mostWorn ? `Most-worn item: "${mostWorn.normalizedName || mostWorn.name}" worn ${mostWorn.timesWorn} times${mostWorn.color ? ` (${mostWorn.color})` : ''}` : '',
    topColors.length > 0 ? `Most common colors in wardrobes: ${topColors.join(', ')}` : '',
    `Total wardrobe items tracked: ${totalItems}`,
  ].filter(Boolean).join('\n');

  const tweetPrompt = `Write a social post about a surprising wardrobe insight from our AI-detected wardrobe data. Make it feel like a fun discovery, not a product announcement.

Insight data:
${insightContext}

Rules:
- Frame it as "what people actually wear vs what they think they wear"
- Relatable, slightly surprising, makes people nod in recognition
- Max 220 chars
- Don't mention "our app" or any product features
- Lead with the most interesting insight
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGemini(tweetPrompt);

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['Wardrobe', 'StyleInsights', 'OOTD', 'OrThis'],
      contentType: 'wardrobe_insight',
      sourceData: { totalItems, topCategory: topCategory?.category, mostWorn: mostWorn?.normalizedName || mostWorn?.name, topColors },
      imageDescription: 'Flat lay of common wardrobe items or minimalist wardrobe visualization',
    },
  ];
}

// ─── Generator 6: Conversation Starter ────────────────────────────────────────

export async function generateConversationStarter(): Promise<GeneratedPost[]> {
  const prompt = `Write a conversation-starting social media post for a fashion/style app's Twitter account.

The post should NOT mention any app, product, AI, or brand at all. It should be a genuine question, hot take, or observation about fashion, style confidence, or getting dressed that will spark replies and engagement.

Examples of good conversation starters:
- "honest question: when you look good, do you perform better at work? because I swear there's a direct correlation"
- "the gap between 'I have nothing to wear' and 'I have too many clothes' is exactly zero"
- "unpopular opinion: repeating outfits is actually a power move"
- "does anyone else dress completely differently when working from home vs in office? like a completely different person?"

Rules:
- No mention of "Or This?", AI, apps, or products
- Make people want to reply or quote tweet
- Can be a question, hot take, observation, or implicit poll prompt
- Lowercase casual tone is usually good but not required
- Max 220 chars
- No hashtags in the text itself
- Must be original — not one of the examples above

Return ONLY the post text.`;

  const tweetText = await callGemini(prompt);

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['StyleTalk', 'FashionCommunity', 'OOTD'],
      contentType: 'conversation_starter',
      sourceData: null,
      imageDescription: 'Simple text graphic or relatable meme-style image',
    },
  ];
}

// ─── Generator 7: Behind the Scenes ──────────────────────────────────────────

export async function generateBehindTheScenes(): Promise<GeneratedPost[]> {
  let metrics;
  try {
    metrics = await getGrowthSummary();
  } catch (err) {
    console.warn('[ContentEngine] Growth summary failed — using minimal context:', err);
    metrics = { totalUsers: 0, dau: 0, newSignups7d: 0 };
  }

  // Calculate days since a rough launch date (use earliest user or a fixed date)
  const launchDate = new Date('2024-01-01'); // rough estimate; will be approximate
  const daysSinceLaunch = Math.floor((Date.now() - launchDate.getTime()) / (24 * 60 * 60 * 1000));

  const metricsContext = [
    metrics.totalUsers > 0 ? `${metrics.totalUsers} total users` : 'early days, building the user base',
    metrics.dau > 0 ? `${metrics.dau} daily active users` : '',
    metrics.newSignups7d > 0 ? `${metrics.newSignups7d} new signups this week` : '',
    `Day ~${daysSinceLaunch} of building`,
  ].filter(Boolean).join(', ');

  const tweetPrompt = `You're the founder of "Or This?", a small AI outfit feedback app. Write a vulnerable, honest "building in public" post about what it's really like to build this.

Current context: ${metricsContext}

Rules:
- Be honest about the journey — small numbers are fine, own them with confidence
- Share a lesson, struggle, moment of clarity, or gratitude
- Don't ask people to sign up or download the app
- End with something reflective, or a question for other builders/founders
- First person ("we" or "I")
- Max 220 chars
- No hype, no "we're crushing it" energy — authentic wins
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGemini(tweetPrompt);

  const tiktokPrompt = `You're a founder building "Or This?", an AI style app. Write a TikTok "day in my life / building in public" post that's raw and honest.

Context: ${metricsContext}

Format:
Hook: [something that makes builders or aspiring entrepreneurs stop scrolling]

Story: [2-3 sentences — a real moment, lesson, or struggle from building]

Lesson/Question: [1 takeaway or question for the audience]

Vibe: [e.g., "authentic", "slightly vulnerable", "proud but humble"]
Suggested format: [e.g., "Talking to camera", "Screen recording + voiceover", "Text overlay montage"]`;

  const tiktokRaw = await callGemini(tiktokPrompt);

  const sourceData = { totalUsers: metrics.totalUsers, dau: metrics.dau, newSignups7d: metrics.newSignups7d, daysSinceLaunch };

  return [
    {
      platform: 'twitter',
      content: tweetText.slice(0, 220),
      hashtags: ['BuildingInPublic', 'IndieHacker', 'StartupLife'],
      contentType: 'behind_the_scenes',
      sourceData,
      imageDescription: 'Authentic founder photo, screenshot, or workspace — nothing polished',
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: ['BuildingInPublic', 'StartupTok', 'FounderLife', 'SmallBusiness'],
      contentType: 'behind_the_scenes',
      sourceData,
      imageDescription: 'Talking-head video or B-roll of building/working',
    },
  ];
}
