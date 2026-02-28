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
import { getAsoKeywordHint } from './aso-intelligence.service.js';

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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Like callGemini but checks for a DB-stored prompt variant for this content type.
 * If a variant exists, it appends additional style guidance from the variant.
 */
async function callGeminiWithVariant(contentType: string, basePrompt: string): Promise<string> {
  const variantPrompt = await getPromptVariant(contentType);
  if (!variantPrompt) return callGemini(basePrompt);

  // Inject variant guidance as additional context at the end of the base prompt
  const augmentedPrompt = `${basePrompt}

ADDITIONAL STYLE GUIDANCE (learned from high-performing posts):
${variantPrompt}`;

  return callGemini(augmentedPrompt);
}

// ─── Brand Voice ──────────────────────────────────────────────────────────────

const BRAND_VOICE = `Voice & Personality of "Or This?":
- We are a tiny indie team, not a corporation. Sound human — like a group chat, not a press release.
- Confident but never arrogant. We celebrate style choices without judging.
- Gen Z-native language: lowercase okay, contractions, rhetorical questions, light humor.
- NEVER: "excited to announce", "we're thrilled", "game-changer", "revolutionize", "leverage".
- NEVER: ask people to download, sign up, or visit a link. No CTAs.
- First person plural ("we") or first person singular ("I") from the founder.
- End with something that invites engagement — a question, a hot take, a vulnerable admission.`;

// ─── Prompt Variant Loader ────────────────────────────────────────────────────

/** Load an improved prompt for this content type from DB if available, else return null. */
async function getPromptVariant(contentType: string): Promise<string | null> {
  const variant = await prisma.socialPromptVariant.findFirst({
    where: { contentType, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return variant?.promptText || null;
}

// ─── Deduplication Helpers ────────────────────────────────────────────────────

async function getRecentPosts(contentType: string, limit = 10): Promise<string[]> {
  const posts = await prisma.socialPost.findMany({
    where: { contentType },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { content: true },
  });
  return posts.map(p => p.content);
}

function buildDeduplicationBlock(recentPosts: string[]): string {
  if (recentPosts.length === 0) return '';
  const examples = recentPosts.slice(0, 5).map((p, i) => `  ${i + 1}. "${p.slice(0, 100)}..."`).join('\n');
  return `\nRECENT POSTS (do NOT repeat similar ideas, angles, or phrasing):\n${examples}\n`;
}

/** Build an ASO keyword hint for prompt injection — makes posts SEO-aligned without being spammy */
async function buildAsoKeywordBlock(): Promise<string> {
  const hint = await getAsoKeywordHint().catch(() => null);
  if (!hint) return '';
  return `\nSEO-FRIENDLY TERMS (naturally incorporate when relevant, never force): ${hint}\n`;
}

// ─── Hashtag Rotation Pools ───────────────────────────────────────────────────

const HASHTAG_POOLS: Record<string, string[]> = {
  founder_story: ['BuildingInPublic', 'IndieHacker', 'StartupLife', 'FounderJourney', 'TechStartup', 'SoloFounder', 'OrThis', 'AppDev', 'IndieDev'],
  fashion_news: ['Fashion', 'StyleTalk', 'FashionOpinion', 'WhatToWear', 'StyleTrends', 'FashionDebate', 'OrThis', 'OOTD'],
  community_spotlight: ['OrThis', 'StyleCommunity', 'OOTD', 'OutfitInspo', 'StyleWins', 'FashionFam'],
  style_data_drop: ['StyleData', 'FashionStats', 'OrThis', 'StyleFacts', 'FashionTrends', 'DataDriven'],
  wardrobe_insight: ['Wardrobe', 'StyleInsights', 'OOTD', 'OrThis', 'ClosetTips', 'WardrobeHacks', 'FashionFacts'],
  conversation_starter: ['StyleTalk', 'FashionCommunity', 'OOTD', 'FashionDebate', 'StyleOpinion', 'LetsTalk'],
  behind_the_scenes: ['BuildingInPublic', 'IndieHacker', 'StartupLife', 'FounderDiary', 'SmallBusiness', 'TechFounder'],
};

const TIKTOK_HASHTAG_POOLS: Record<string, string[]> = {
  founder_story: ['BuildingInPublic', 'StartupTok', 'AppDevelopment', 'OrThis', 'TechTok', 'FounderLife', 'IndieDev'],
  fashion_news: ['FashionTok', 'StyleTalk', 'FashionNews', 'OrThis', 'StyleAdvice', 'FashionOpinion', 'WhatToWear'],
  behind_the_scenes: ['BuildingInPublic', 'StartupTok', 'FounderLife', 'SmallBusiness', 'DayInMyLife', 'TechTok'],
};

function pickHashtags(contentType: string, platform: 'twitter' | 'tiktok' | 'pinterest', count = 3): string[] {
  const pool = platform === 'tiktok'
    ? (TIKTOK_HASHTAG_POOLS[contentType] || HASHTAG_POOLS[contentType] || [])
    : (HASHTAG_POOLS[contentType] || []);
  // Always include OrThis if it's in the pool
  const mustInclude = pool.includes('OrThis') ? ['OrThis'] : [];
  const rest = pool.filter(h => !mustInclude.includes(h));
  // Shuffle rest and take enough to fill count
  const shuffled = rest.sort(() => Math.random() - 0.5);
  return [...mustInclude, ...shuffled.slice(0, count - mustInclude.length)];
}

// ─── Smart Truncation ─────────────────────────────────────────────────────────

function truncateAtWord(text: string, max = 250): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > max * 0.7 ? truncated.slice(0, lastSpace) : truncated;
}

// ─── GitHub + Build Context Types ────────────────────────────────────────────

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
  files?: Array<{ filename: string }>;
}

interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  html_url: string;
  changed_files?: number;
}

interface CommitDetail {
  sha: string;
  message: string;       // full multi-line message
  date: string;
  files: string[];        // changed file paths
  additions: number;
  deletions: number;
}

interface MdSnapshot {
  path: string;
  excerpt: string;        // Gemini-summarized ~200 words
  fetchedAt: number;
}

interface BuildContext {
  commits: CommitDetail[];
  mergedPRs: GitHubPR[];
  mdSnapshots: MdSnapshot[];
  recentlyChangedMdPaths: string[];
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'OrThis-SocialBot/1.0',
  };
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function fetchRecentCommits(): Promise<GitHubCommit[]> {
  const owner = process.env.GITHUB_REPO_OWNER || 'Bradavis2011';
  const repo = process.env.GITHUB_REPO_NAME || 'FitCheck';
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const headers = githubHeaders();
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

// ─── GitHub Fetch Helpers ──────────────────────────────────────────────────────

async function fetchMergedPRs(): Promise<GitHubPR[]> {
  const owner = process.env.GITHUB_REPO_OWNER || 'Bradavis2011';
  const repo = process.env.GITHUB_REPO_NAME || 'FitCheck';
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=10`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) return [];
    const prs = (await res.json()) as GitHubPR[];
    return prs
      .filter(pr => pr.merged_at && new Date(pr.merged_at) >= sevenDaysAgo)
      .map(pr => ({ ...pr, body: pr.body ? pr.body.slice(0, 500) : null }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchCommitDetail(sha: string): Promise<CommitDetail | null> {
  const owner = process.env.GITHUB_REPO_OWNER || 'Bradavis2011';
  const repo = process.env.GITHUB_REPO_NAME || 'FitCheck';
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as {
      sha: string;
      commit: { message: string; author: { date: string } };
      files?: Array<{ filename: string }>;
      stats?: { additions: number; deletions: number };
    };
    return {
      sha: data.sha.slice(0, 7),
      message: data.commit.message,
      date: data.commit.author.date,
      files: (data.files || []).map(f => f.filename),
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
    };
  } catch {
    return null;
  }
}

async function fetchFileContent(path: string): Promise<string | null> {
  const owner = process.env.GITHUB_REPO_OWNER || 'Bradavis2011';
  const repo = process.env.GITHUB_REPO_NAME || 'FitCheck';
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== 'base64') return null;
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

// ─── MD Summarization ─────────────────────────────────────────────────────────

async function summarizeMdContent(path: string, content: string): Promise<string> {
  const excerpt = content.slice(0, 3000);
  const prompt = `Summarize the following documentation in ~200 words. Focus on key decisions, features built, and problems solved. Be concrete and specific — this summary will help write authentic "building in public" social media posts.

File: ${path}
Content:
${excerpt}

Return ONLY the summary, nothing else.`;
  try {
    return await callGemini(prompt);
  } catch {
    return content.slice(0, 500);
  }
}

// ─── Build Context Orchestrator ───────────────────────────────────────────────

const KNOWN_MD_FILES = [
  'CLAUDE_CODE_PROMPTS.md',
  'TECHNICAL_SPEC.md',
  'ORTHIS_BRAND_GUIDELINES.md',
];

let buildContextCache: { context: BuildContext; cachedAt: number } | null = null;
const BUILD_CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function buildBuildContext(): Promise<BuildContext> {
  // Return cached context if fresh
  if (buildContextCache && Date.now() - buildContextCache.cachedAt < BUILD_CONTEXT_CACHE_TTL) {
    console.log('[ContentEngine] Using cached build context');
    return buildContextCache.context;
  }

  console.log('[ContentEngine] Fetching fresh build context from GitHub');

  // 1. Fetch recent commits list
  let rawCommits: GitHubCommit[] = [];
  try {
    rawCommits = await fetchRecentCommits();
  } catch {
    // graceful degradation
  }

  // 2. Fetch commit details + merged PRs in parallel
  const top5Shas = rawCommits.slice(0, 5).map(c => c.sha);
  const [commitDetails, mergedPRs] = await Promise.all([
    Promise.all(top5Shas.map(sha => fetchCommitDetail(sha))),
    fetchMergedPRs(),
  ]);

  const commits: CommitDetail[] = commitDetails.filter((d): d is CommitDetail => d !== null);

  // 3. Find recently changed MD files from commit file lists
  const recentlyChangedMdPaths: string[] = [];
  for (const detail of commits) {
    for (const file of detail.files) {
      if (file.endsWith('.md') && !recentlyChangedMdPaths.includes(file)) {
        recentlyChangedMdPaths.push(file);
      }
    }
  }

  // 4. Smart-select up to 2 MD files to fetch
  const mdFilesToFetch: string[] = [];
  // Priority: MD files changed in recent commits that match known docs
  for (const changedMd of recentlyChangedMdPaths) {
    const basename = changedMd.split('/').pop() || '';
    if (KNOWN_MD_FILES.includes(basename) && mdFilesToFetch.length < 2) {
      mdFilesToFetch.push(changedMd);
    }
  }
  // Fallback: rotate through known docs by day-of-week
  if (mdFilesToFetch.length < 2) {
    const dayOfWeek = new Date().getDay();
    for (let i = 0; i < KNOWN_MD_FILES.length && mdFilesToFetch.length < 2; i++) {
      const mdFile = KNOWN_MD_FILES[(dayOfWeek + i) % KNOWN_MD_FILES.length];
      if (!mdFilesToFetch.includes(mdFile)) {
        mdFilesToFetch.push(mdFile);
      }
    }
  }

  // 5. Fetch + summarize selected MD files
  const mdSnapshots: MdSnapshot[] = [];
  for (const mdPath of mdFilesToFetch) {
    const content = await fetchFileContent(mdPath);
    if (content) {
      const excerpt = await summarizeMdContent(mdPath, content);
      mdSnapshots.push({ path: mdPath, excerpt, fetchedAt: Date.now() });
    }
  }

  const context: BuildContext = { commits, mergedPRs, mdSnapshots, recentlyChangedMdPaths };
  buildContextCache = { context, cachedAt: Date.now() };
  return context;
}

// ─── Build Context Formatter ──────────────────────────────────────────────────

function formatBuildContextForPrompt(ctx: BuildContext): string {
  const sections: string[] = [];

  if (ctx.commits.length > 0) {
    const commitLines = ctx.commits.map(c => {
      const lines = c.message.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0] || '';
      const body = lines.slice(1).join(' ').slice(0, 200);
      const fileCount = c.files.length;
      const scope = c.additions + c.deletions > 0 ? ` (+${c.additions}/-${c.deletions} lines)` : '';
      return `  • [${c.sha}] ${title}${body ? `\n    Body: ${body}` : ''}${fileCount > 0 ? `\n    Files changed: ${fileCount}${scope}` : ''}`;
    }).join('\n');
    sections.push(`RECENT COMMITS:\n${commitLines}`);
  }

  if (ctx.mergedPRs.length > 0) {
    const prLines = ctx.mergedPRs.map(pr => {
      const body = pr.body ? `\n    Why: ${pr.body.slice(0, 300)}` : '';
      const files = pr.changed_files ? ` (${pr.changed_files} files)` : '';
      return `  • PR #${pr.number}: ${pr.title}${files}${body}`;
    }).join('\n');
    sections.push(`RECENTLY MERGED PRs:\n${prLines}`);
  }

  if (ctx.commits.length > 0) {
    const allFiles = ctx.commits.flatMap(c => c.files);
    const areas = [...new Set(allFiles.map(f => f.split('/')[0]))].slice(0, 6);
    const totalAdditions = ctx.commits.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = ctx.commits.reduce((sum, c) => sum + c.deletions, 0);
    sections.push(`SCOPE:\n  Files touched: ${allFiles.length} across areas: ${areas.join(', ')}\n  Total changes: +${totalAdditions}/-${totalDeletions} lines`);
  }

  if (ctx.mdSnapshots.length > 0) {
    const mdLines = ctx.mdSnapshots.map(s => `  [${s.path}]\n  ${s.excerpt}`).join('\n\n');
    sections.push(`BUILD DOCUMENTATION:\n${mdLines}`);
  }

  return sections.join('\n\n');
}

// ─── Generator 1: Founder Story ───────────────────────────────────────────────

export async function generateFounderStory(): Promise<GeneratedPost[]> {
  let rawCommits: GitHubCommit[];
  try {
    rawCommits = await fetchRecentCommits();
  } catch (err) {
    console.warn('[ContentEngine] GitHub fetch failed — skipping founder story:', err);
    return [];
  }

  if (rawCommits.length === 0) {
    console.log('[ContentEngine] No meaningful commits this week — skipping founder story');
    return [];
  }

  // Fetch enriched context (cached across generators in same cron run)
  let ctx: BuildContext;
  try {
    ctx = await buildBuildContext();
  } catch (err) {
    console.warn('[ContentEngine] Build context fetch failed — falling back to commit summaries:', err);
    ctx = { commits: [], mergedPRs: [], mdSnapshots: [], recentlyChangedMdPaths: [] };
  }

  const contextBlock = formatBuildContextForPrompt(ctx);
  // Fallback if context is empty: use basic commit summaries
  const fallbackSummary = rawCommits
    .map(c => `- ${c.commit.message.split('\n')[0].slice(0, 120)}`)
    .join('\n');
  const buildInfo = contextBlock.trim() || `Recent commits:\n${fallbackSummary}`;

  const recentPosts = await getRecentPosts('founder_story');
  const dedupBlock = buildDeduplicationBlock(recentPosts);

  const twitterPrompt = `${BRAND_VOICE}

You are the founder of "Or This?", an AI outfit feedback app for Gen Z. Write a Twitter post about a recent update you shipped. Don't announce the feature like a press release — tell the STORY. Why you built it, what problem it solves, or what you learned building it.

Use the PR descriptions and documentation context below to understand WHY changes were made, not just what was built.

${buildInfo}

Pick ONE change, PR, or decision that has the best human story behind it. Use specific details from the context above — reference real features, decisions, or discoveries.

Good examples:
- "spent all night debugging a color detection bug only to realize I was testing in dark mode. sometimes the answer is literally staring at you"
- "we rewrote our outfit scoring from scratch this week. old version worked but it was lying to people. honesty > engagement metrics"
- "merged a PR this week that touched 23 files just to fix how we detect if an outfit is 'business casual'. turns out that phrase means completely different things to different people"
${dedupBlock}
Rules:
- First person ("we" or "I")
- Max 250 chars (we add hashtags separately)
- Sound like a real person building something, not a brand account
- Reference specific features, decisions, or discoveries from the context — ground it in real engineering/design work
- End with something that invites a response — a question, a vulnerability, a hot take
- No hashtags in the text itself

Return ONLY the tweet text, nothing else.`;

  const twitterText = await callGeminiWithVariant('founder_story', twitterPrompt);

  // Pick best PR or first commit as TikTok hook
  const tiktokHook = ctx.mergedPRs.length > 0
    ? `Merged PR: "${ctx.mergedPRs[0].title}"${ctx.mergedPRs[0].body ? `\nContext: ${ctx.mergedPRs[0].body.slice(0, 200)}` : ''}`
    : rawCommits[0]?.commit.message.split('\n')[0] || '';
  const mdBackground = ctx.mdSnapshots.length > 0
    ? `\nBuild context: ${ctx.mdSnapshots[0].excerpt.slice(0, 300)}`
    : '';

  const tiktokPrompt = `You are the founder of "Or This?", an AI outfit feedback app. Write a TikTok caption + video concept for a "building in public" post grounded in this real engineering work:

${tiktokHook}${mdBackground}

Format:
Hook: [1 sentence that stops the scroll — reference the specific feature or decision]

Video concept: [30-second video idea — no fancy equipment needed]

Caption: [2-3 sentences expanding on the hook with real behind-the-scenes detail]

Suggested format: [e.g., "POV: startup founder", "Day in my life", "Behind the scenes"]

Keep it authentic, imperfect, real. Gen Z tone.`;

  const tiktokRaw = await callGemini(tiktokPrompt);

  const sourceData = {
    commits: ctx.commits.map(c => ({ sha: c.sha, message: c.message.split('\n')[0], files: c.files.length })),
    mergedPRs: ctx.mergedPRs.map(pr => ({ number: pr.number, title: pr.title })),
    mdFilesUsed: ctx.mdSnapshots.map(s => s.path),
  };

  const posts: GeneratedPost[] = [
    {
      platform: 'twitter',
      content: truncateAtWord(twitterText),
      hashtags: pickHashtags('founder_story', 'twitter', 3),
      contentType: 'founder_story',
      sourceData,
      imageDescription: 'Screenshot of the app feature or code editor — raw and unpolished',
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: pickHashtags('founder_story', 'tiktok', 4),
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

  const recentPosts = await getRecentPosts('fashion_news');
  const dedupBlock = buildDeduplicationBlock(recentPosts);

  const tweetPrompt = `${BRAND_VOICE}

You run "Or This?", an AI outfit feedback app. React to this fashion headline as a founder who genuinely cares about how people feel about their own style choices.

Headline: "${picked.title}"
Source: ${picked.source}

Good examples:
- "vogue just said quiet luxury is over. love how fashion media kills trends the second normal people start enjoying them"
- "saw this in WWD today — apparently Gen Z is thrifting more than millennials ever did. honestly makes sense when a basic tee costs $40 new"
${dedupBlock}
Rules:
- Have a genuine TAKE — agree, disagree, add nuance. Don't be neutral.
- Reference seeing the article naturally ("saw this in ${picked.source} today...", "just read that...")
- Connect it back to everyday people's style decisions — not runway fashion
- Max 250 chars
- No link in the text (we'll add source URL separately)
- No hashtags in the text itself

Return ONLY the tweet text, nothing else.`;

  const tweetText = await callGeminiWithVariant('fashion_news', tweetPrompt);

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
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('fashion_news', 'twitter', 3),
      contentType: 'fashion_news',
      sourceData,
      imageDescription: `Screenshot or graphic quoting the headline from ${picked.source}`,
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: pickHashtags('fashion_news', 'tiktok', 4),
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

  const recentPosts = await getRecentPosts('community_spotlight');
  const dedupBlock = buildDeduplicationBlock(recentPosts);

  const tweetPrompt = `${BRAND_VOICE}

Write a social post celebrating the Or This? community's style choices this week. Make it feel like you're talking about real people you admire, not metrics.

This week's data:
${dataContext}

Good examples:
- "y'all submitted 847 outfit checks this week and the earth tone game was unreal. the beige-to-olive pipeline is real"
- "our community's average confidence score went up 0.4 points this week and I genuinely teared up a little"
${dedupBlock}
Rules:
- Celebrate the PEOPLE and their choices, not the product
- Reference specific trends in a way that feels personal ("y'all are really into earth tones this week", "the work outfit game has been strong")
- Conversational, warm, Gen Z-friendly
- Max 250 chars
- Don't mention app features or download CTAs
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGeminiWithVariant('community_spotlight', tweetPrompt);

  return [
    {
      platform: 'twitter',
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('community_spotlight', 'twitter', 3),
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

  const recentPosts = await getRecentPosts('style_data_drop');
  const dedupBlock = buildDeduplicationBlock(recentPosts);
  const asoBlock = await buildAsoKeywordBlock();

  const tweetPrompt = `${BRAND_VOICE}

Turn this style data into a surprising, shareable social media post. Pick the single most interesting or unexpected stat and frame it as a discovery.

Data:
${statsContext}
${asoBlock}

Good examples:
- "68% of outfit checks this week were for work. y'all are STRESSED about office fits and honestly same"
- "turns out people who wear warm tones score 12% higher on average. earth tones really said 'I'm the main character'"
${dedupBlock}
Rules:
- Lead with the number or stat ("73% of you...", "Turns out...")
- Make people think "huh, that's interesting" or "wait, that's me"
- Add a question or light hot take after the stat
- Max 250 chars
- Conversational, not corporate-data-report tone
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGeminiWithVariant('style_data_drop', tweetPrompt);

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
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('style_data_drop', 'twitter', 3),
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

  const recentPosts = await getRecentPosts('wardrobe_insight');
  const dedupBlock = buildDeduplicationBlock(recentPosts);

  const tweetPrompt = `${BRAND_VOICE}

Write a social post about a surprising wardrobe insight from our AI-detected wardrobe data. Make it feel like a fun discovery, not a product announcement.

Insight data:
${insightContext}

Good examples:
- "the most-worn item across all wardrobes is a black t-shirt worn 47 times. basics really are the backbone and we all know it"
- "68% of wardrobe items are tops. bottoms are criminally underrepresented and I need answers"
${dedupBlock}
Rules:
- Frame it as "what people actually wear vs what they think they wear"
- Relatable, slightly surprising, makes people nod in recognition
- Max 250 chars
- Don't mention "our app" or any product features
- Lead with the most interesting insight
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGeminiWithVariant('wardrobe_insight', tweetPrompt);

  return [
    {
      platform: 'twitter',
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('wardrobe_insight', 'twitter', 3),
      contentType: 'wardrobe_insight',
      sourceData: { totalItems, topCategory: topCategory?.category, mostWorn: mostWorn?.normalizedName || mostWorn?.name, topColors },
      imageDescription: 'Flat lay of common wardrobe items or minimalist wardrobe visualization',
    },
  ];
}

// ─── Generator 6: Conversation Starter ────────────────────────────────────────

export async function generateConversationStarter(): Promise<GeneratedPost[]> {
  const recentPosts = await getRecentPosts('conversation_starter');
  const dedupBlock = buildDeduplicationBlock(recentPosts);

  const prompt = `${BRAND_VOICE}

Write a conversation-starting social media post for a fashion/style app's Twitter account.

The post should NOT mention any app, product, AI, or brand at all. It should be a genuine question, hot take, or observation about fashion, style confidence, or getting dressed that will spark replies and engagement.

Good examples:
- "honest question: when you look good, do you perform better at work? because I swear there's a direct correlation"
- "the gap between 'I have nothing to wear' and 'I have too many clothes' is exactly zero"
- "unpopular opinion: repeating outfits is actually a power move"
- "does anyone else dress completely differently when working from home vs in office? like a completely different person?"
- "what's the oldest piece of clothing you still wear regularly? mine is a hoodie from 2016 that has no business still fitting"
- "be honest: do you dress for yourself or for the version of yourself you want other people to see"
${dedupBlock}
Rules:
- No mention of "Or This?", AI, apps, or products
- Make people want to reply or quote tweet
- Can be a question, hot take, observation, or implicit poll prompt
- Lowercase casual tone is usually good but not required
- Max 250 chars
- No hashtags in the text itself
- Must be original — not one of the examples above

Return ONLY the post text.`;

  const tweetText = await callGeminiWithVariant('conversation_starter', prompt);

  return [
    {
      platform: 'twitter',
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('conversation_starter', 'twitter', 3),
      contentType: 'conversation_starter',
      sourceData: null,
      imageDescription: 'Simple text graphic or relatable meme-style image',
    },
  ];
}

// ─── Generator 7: Behind the Scenes ──────────────────────────────────────────

export async function generateBehindTheScenes(): Promise<GeneratedPost[]> {
  // Fetch growth metrics and build context in parallel
  const [metricsResult, ctxResult] = await Promise.allSettled([
    getGrowthSummary(),
    buildBuildContext(),
  ]);

  const metrics = metricsResult.status === 'fulfilled'
    ? metricsResult.value
    : { totalUsers: 0, dau: 0, newSignups7d: 0 };
  if (metricsResult.status === 'rejected') {
    console.warn('[ContentEngine] Growth summary failed — using minimal context:', metricsResult.reason);
  }

  const ctx: BuildContext = ctxResult.status === 'fulfilled'
    ? ctxResult.value
    : { commits: [], mergedPRs: [], mdSnapshots: [], recentlyChangedMdPaths: [] };
  if (ctxResult.status === 'rejected') {
    console.warn('[ContentEngine] Build context fetch failed:', ctxResult.reason);
  }

  // Calculate days since a rough launch date
  const launchDate = new Date('2024-01-01');
  const daysSinceLaunch = Math.floor((Date.now() - launchDate.getTime()) / (24 * 60 * 60 * 1000));

  const metricsContext = [
    metrics.totalUsers > 0 ? `${metrics.totalUsers} total users` : 'early days, building the user base',
    metrics.dau > 0 ? `${metrics.dau} daily active users` : '',
    metrics.newSignups7d > 0 ? `${metrics.newSignups7d} new signups this week` : '',
    `Day ~${daysSinceLaunch} of building`,
  ].filter(Boolean).join(', ');

  const contextBlock = formatBuildContextForPrompt(ctx);

  const recentPosts = await getRecentPosts('behind_the_scenes');
  const dedupBlock = buildDeduplicationBlock(recentPosts);
  const asoHint = await getAsoKeywordHint().catch(() => null);

  const tweetPrompt = `${BRAND_VOICE}

You're the founder of "Or This?", a small AI outfit feedback app. Write a vulnerable, honest "building in public" post about what it's really like to build this.

Current context: ${metricsContext}
${asoHint ? `People are searching for: ${asoHint} — if it fits naturally, use language that resonates with these interests.\n` : ''}${contextBlock ? `\nWhat you're working on:\n${contextBlock}\n\nWeave in a specific detail about what you're building — ground it in real engineering or design work from the context above.` : ''}
Good examples:
- "day 410 of building. had 3 users yesterday. but one of them sent a message saying it actually helped them pick an outfit for a date. that's the whole point right there"
- "someone asked me when we'll be profitable. I said I don't know. they said 'then why are you building it?' because I wish it existed when I was 19"
- "merged a PR at 2am last night that redesigns how we detect color harmony in outfits. 3 weeks of work. most users will never notice. I don't care."
${dedupBlock}
Rules:
- Be honest about the journey — small numbers are fine, own them with confidence
- Share a lesson, struggle, moment of clarity, or gratitude
- Reference specific real work from the context if available
- Don't ask people to sign up or download the app
- End with something reflective, or a question for other builders/founders
- First person ("we" or "I")
- Max 250 chars
- No hype, no "we're crushing it" energy — authentic wins
- No hashtags in the text itself

Return ONLY the tweet text.`;

  const tweetText = await callGeminiWithVariant('behind_the_scenes', tweetPrompt);

  // TikTok prompt with real commit/PR details
  const tiktokCommitContext = ctx.commits.length > 0
    ? ctx.commits.slice(0, 3).map(c => `- ${c.message.split('\n')[0]}`).join('\n')
    : '';
  const tiktokPrContext = ctx.mergedPRs.length > 0
    ? `Most significant PR: "${ctx.mergedPRs[0].title}"`
    : '';

  const tiktokPrompt = `You're a founder building "Or This?", an AI style app. Write a TikTok "day in my life / building in public" post that's raw and honest.

Context: ${metricsContext}${tiktokCommitContext ? `\nRecent work:\n${tiktokCommitContext}` : ''}${tiktokPrContext ? `\n${tiktokPrContext}` : ''}

Format:
Hook: [something that makes builders or aspiring entrepreneurs stop scrolling — reference real work if possible]

Story: [2-3 sentences — a real moment, lesson, or struggle from building — ground it in the specific engineering/design work above]

Lesson/Question: [1 takeaway or question for the audience]

Vibe: [e.g., "authentic", "slightly vulnerable", "proud but humble"]
Suggested format: [e.g., "Talking to camera", "Screen recording + voiceover", "Text overlay montage"]`;

  const tiktokRaw = await callGemini(tiktokPrompt);

  const sourceData = {
    totalUsers: metrics.totalUsers,
    dau: metrics.dau,
    newSignups7d: metrics.newSignups7d,
    daysSinceLaunch,
    commits: ctx.commits.map(c => ({ sha: c.sha, message: c.message.split('\n')[0] })),
    mergedPRs: ctx.mergedPRs.map(pr => ({ number: pr.number, title: pr.title })),
    mdFilesUsed: ctx.mdSnapshots.map(s => s.path),
  };

  return [
    {
      platform: 'twitter',
      content: truncateAtWord(tweetText),
      hashtags: pickHashtags('behind_the_scenes', 'twitter', 3),
      contentType: 'behind_the_scenes',
      sourceData,
      imageDescription: 'Authentic founder photo, screenshot, or workspace — nothing polished',
    },
    {
      platform: 'tiktok',
      content: tiktokRaw,
      hashtags: pickHashtags('behind_the_scenes', 'tiktok', 4),
      contentType: 'behind_the_scenes',
      sourceData,
      imageDescription: 'Talking-head video or B-roll of building/working',
    },
  ];
}
