/**
 * Creator Scout — Mass discovery of nano/micro creators for outreach
 *
 * Cron: Tue/Thu/Sat 10am UTC
 * Uses Gemini with Google Search grounding to find real creators at volume.
 * Sorts into email-track (auto-send) vs DM-track (manual brief).
 * Generates personalized outreach content for each.
 */

import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus, getLatestBusEntry } from './intelligence-bus.service.js';

// ─── Google AI SDK ────────────────────────────────────────────────────────────

async function getGemini() {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('[CreatorScout] GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

// ─── Search Query Bank ────────────────────────────────────────────────────────

// 100+ queries across niches, regions, platforms — daily rotation picks ~25/run.
const SEARCH_QUERIES = [
  // ── Core fit-check format ─────────────────────────────────────────────────
  'tiktok "outfit check" creator under 10000 followers 2025 2026',
  'tiktok #fitcheck fashion creator profile small nano',
  '"top outfit" OR "best fashion" tiktok creators to follow 2025 nano micro',
  'tiktok "rate my outfit" creator content ideas',
  'tiktok "outfit ideas" creator nano style',
  'tiktok "ootd" creator outfit of the day small following',
  'tiktok "what I wore" fashion creator small',
  'tiktok "get ready with me" fashion nano creator',
  'tiktok "styling challenge" creator small audience',
  'tiktok "outfit reaction" creator nano 2026',
  // ── Aesthetic niches ──────────────────────────────────────────────────────
  'tiktok minimalist fashion creator small following',
  'tiktok streetwear outfit check nano creator',
  'tiktok cottagecore aesthetic fashion creator',
  'tiktok dark academia fashion creator nano',
  'tiktok coastal grandmother fashion creator',
  'tiktok "old money" aesthetic creator small',
  'tiktok "clean girl" aesthetic nano creator',
  'tiktok Y2K fashion creator small audience',
  'tiktok indie sleaze fashion creator',
  'tiktok "quiet luxury" fashion creator nano',
  'tiktok vintage thrift fashion creator small',
  'tiktok "coquette" aesthetic creator nano',
  'tiktok office siren aesthetic creator',
  'tiktok boho fashion creator small',
  // ── Demographics ──────────────────────────────────────────────────────────
  'tiktok plus size fashion creator outfit check',
  'tiktok men fashion outfit creator small',
  'tiktok petite fashion creator small following',
  'tiktok tall women fashion creator nano',
  'tiktok curvy fashion creator ootd',
  'tiktok gen z fashion creator under 5000 followers',
  'tiktok millennial fashion creator nano',
  'tiktok college student fashion creator',
  'tiktok fashion creator mom style small',
  // ── Occasions ─────────────────────────────────────────────────────────────
  'fashion tiktok creator campus college outfit',
  'tiktok "work outfit" fashion creator small',
  'tiktok "date night outfit" creator nano',
  'tiktok "wedding guest" outfit creator small',
  'tiktok "night out" outfit creator small following',
  'tiktok "business casual" fashion creator nano',
  'tiktok "summer outfits" creator small 2026',
  'tiktok "winter outfits" creator nano style',
  'tiktok "capsule wardrobe" creator small',
  'tiktok "budget fashion" creator nano',
  // ── Platform variants ─────────────────────────────────────────────────────
  'lemon8 fashion outfit creator 2026',
  'lemon8 ootd creator small following',
  'threads outfit creator fashion advice',
  'instagram nano fashion creator outfit check 2025',
  'instagram reels fashion outfit creator niche style',
  'instagram fashion creator 2k 5k followers outfit feedback',
  'youtube shorts fashion style creator small channel',
  'fashion blogger tiktok 1000 5000 followers outfit check',
  'tiktok "what to wear" creator fashion tips small',
  'instagram nano creator fashion inspiration 2026',
  // ── Thrift / budget ───────────────────────────────────────────────────────
  'tiktok thrift flip fashion creator small',
  'tiktok "thrift haul" creator nano style',
  'tiktok "thrift store" outfit creator small',
  'tiktok sustainable fashion creator small following',
  'tiktok "secondhand" fashion creator nano',
  'tiktok "dupes" fashion creator small',
  // ── Regional ─────────────────────────────────────────────────────────────
  'tiktok fashion creator UK small following',
  'tiktok fashion creator Australia nano',
  'tiktok fashion creator Canada style small',
  'tiktok fashion creator NYC small',
  'tiktok fashion creator LA style nano',
  'tiktok fashion creator midwest style small',
  'tiktok fashion creator south style nano',
  'tiktok fashion creator London small',
  // ── AI / tech-forward ─────────────────────────────────────────────────────
  'fashion app beta testing creator tiktok 2026',
  'tiktok fashion influencer not verified micro',
  'tiktok "AI fashion" creator small',
  'tiktok "AI outfit" creator content ideas 2026',
  // ── Site-targeted ─────────────────────────────────────────────────────────
  'site:tiktok.com fashion creator outfit review small',
  'site:instagram.com fashion creator fitcheck nano 2026',
  // ── Listicle discovery ────────────────────────────────────────────────────
  '"best fashion creators" tiktok under 10k 2026',
  '"underrated fashion creators" tiktok 2026',
  '"nano fashion influencers" to follow 2026',
  '"small fashion creators" tiktok style inspiration',
  '"hidden gem" fashion creator tiktok 2026',
  '"rising fashion creator" tiktok 2026',
  '"new fashion creator" tiktok 2026 follow',
  // ── Cross-niche lifestyle ─────────────────────────────────────────────────
  'tiktok lifestyle creator fashion ootd nano',
  'tiktok beauty creator who also does fashion small',
  'tiktok fitness creator style outfit nano',
  // ── Hyper-niche ───────────────────────────────────────────────────────────
  'tiktok "corporate fashion" creator small',
  'tiktok "teacher outfits" creator nano',
  'tiktok "nurse fashion" creator small',
  'tiktok "law student" fashion creator',
  'tiktok "NYC fashion" street style nano creator',
  'tiktok "LA fashion" street style creator small',
  'tiktok "Chicago fashion" creator nano',
];

// ─── Discovery via Gemini Web Search ─────────────────────────────────────────

async function discoverCreatorsForQuery(
  genAI: any,
  query: string,
): Promise<Array<{
  platform: string;
  handle: string;
  displayName?: string;
  followerRange?: string;
  niche?: string;
  profileUrl?: string;
  contentStyle?: string;
  email?: string;
}>> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }],
  });

  const prompt = `Search for: "${query}"

Extract every social media creator found in the search results. For each creator provide:
- platform: the social media platform (tiktok, instagram, youtube, lemon8, threads)
- handle: their @handle or username (without the @)
- displayName: their display name
- followerRange: approximate follower count range (e.g. "1k-5k", "5k-10k", "10k-50k")
- niche: their content niche (e.g. "minimalist fashion", "streetwear", "thrift fashion", "plus size fashion")
- profileUrl: direct profile URL if found
- contentStyle: brief description of their content style (10-20 words)
- email: business email if visible in bio, profile page, or article (null if not found)

Return ONLY a JSON array. Example format:
[{"platform":"tiktok","handle":"fashionista123","displayName":"Jane Smith","followerRange":"5k-10k","niche":"minimalist fashion","profileUrl":"https://tiktok.com/@fashionista123","contentStyle":"Clean minimalist outfit showcases with thrift hauls","email":null}]

Look in listicles, articles, and profile pages. Include ALL creators found, even if limited info.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON array from response (greedy — captures full array, not first bracket pair)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((c: any) => c.platform && c.handle)
      .map((c: any) => ({
        platform: String(c.platform || '').toLowerCase().trim(),
        handle: String(c.handle || '').replace('@', '').trim(),
        displayName: c.displayName || undefined,
        followerRange: c.followerRange || undefined,
        niche: c.niche || undefined,
        profileUrl: c.profileUrl || undefined,
        contentStyle: c.contentStyle || undefined,
        email: c.email && typeof c.email === 'string' && c.email.includes('@')
          ? c.email.trim()
          : undefined,
      }))
      .filter(c => c.platform && c.handle && c.handle.length > 0);
  } catch (err) {
    console.warn(`[CreatorScout] Failed to parse results for query "${query.slice(0, 50)}...":`, err);
    return [];
  }
}

// ─── DM Generation ────────────────────────────────────────────────────────────

async function generateDMs(
  genAI: any,
  prospects: Array<{ handle: string; platform: string; niche?: string; contentStyle?: string }>,
): Promise<Record<string, string>> {
  if (prospects.length === 0) return {};

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const listText = prospects
    .map((p, i) => `${i + 1}. @${p.handle} on ${p.platform} | Niche: ${p.niche || 'fashion'} | Style: ${p.contentStyle || 'outfit content'}`)
    .join('\n');

  // B2: Check for ops-learning-generated improved DM template
  let improvedTemplateBlock = '';
  try {
    const variant = await prisma.socialPromptVariant.findUnique({ where: { contentType: 'creator_dm' } });
    if (variant?.isActive && variant.promptText) {
      improvedTemplateBlock = `\n\nLearned improvements from high-performing DMs:\n${variant.promptText}`;
    }
  } catch { /* non-fatal */ }

  const prompt = `Generate a short personalized DM for each of these fashion creators about an AI outfit scoring app called "Or This?".

Creators:
${listText}

Brand voice (Or This?):
- Casual, confident, fashion-forward — like a friend who genuinely knows style
- Direct and human, never hype or performative
- NEVER use: "hey girly", "bestie", "omg", "slay", "girlie", "queen", "iconic", "obsessed", "this is giving"
- NEVER use: "excited to announce", "game-changer", "revolutionary", "partnership opportunity"
- Tone: confident and specific, not breathless. Say what you mean, then stop.

Rules:
- Under 80 words each
- Reference their specific content style/niche
- Pitch "rate my outfit with AI" as a CONTENT HOOK — filming their reaction to the AI score is inherently shareable
- The core pitch is the AFFILIATE PROGRAM: they earn 30% of every subscription from users they bring in. That's ~$1-2/subscriber/month, recurring. Every video they post grows their passive income.
- Give a concrete example: "If 50 people sign up through your link and 10% go paid, that's ~$20/month growing with each video"
- Do NOT offer "free premium access" as the main pitch — it's irrelevant to a creator building income
- End with a simple ask ("want your affiliate link?")
- Write as the founder of Or This? — direct, not corporate, not fan-girling${improvedTemplateBlock}

Return ONLY a JSON object mapping handle to DM text:
{"handle1": "dm text here", "handle2": "dm text here"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[CreatorScout] DM generation failed:', err);
    return {};
  }
}

// ─── Email Generation ─────────────────────────────────────────────────────────

async function generateEmails(
  genAI: any,
  prospects: Array<{ handle: string; platform: string; niche?: string; contentStyle?: string }>,
): Promise<Record<string, { subject: string; body: string }>> {
  if (prospects.length === 0) return {};

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const listText = prospects
    .map((p, i) => `${i + 1}. @${p.handle} on ${p.platform} | Niche: ${p.niche || 'fashion'} | Style: ${p.contentStyle || 'outfit content'}`)
    .join('\n');

  // B2: Check for ops-learning-generated improved email template
  let improvedTemplateBlock = '';
  try {
    const variant = await prisma.socialPromptVariant.findUnique({ where: { contentType: 'creator_email' } });
    if (variant?.isActive && variant.promptText) {
      improvedTemplateBlock = `\n\nLearned improvements from high-performing emails:\n${variant.promptText}`;
    }
  } catch { /* non-fatal */ }

  const prompt = `Generate a short personalized outreach email for each creator about an AI outfit scoring app called "Or This?".

Creators:
${listText}

Brand voice (Or This?):
- Casual, confident, fashion-forward — like a friend who genuinely knows style
- Direct and human, never hype or performative
- NEVER use: "hey girly", "bestie", "omg", "slay", "girlie", "queen", "iconic", "obsessed"
- NEVER use: "excited to announce", "game-changer", "revolutionary", "partnership opportunity", "collaboration"
- Tone: confident and specific, not breathless. Say what you mean, then stop.

Rules:
Subject: specific and direct, under 50 chars. NOT "Partnership Opportunity". Example: "earn 30% on your Or This? referrals", "quick idea for @handle"
Body: under 110 words, written as the founder — direct, not corporate, not fan-girling
- Reference their specific content niche
- Pitch "rate my outfit with AI" as a video content format (filming your reaction to the score)
- The core value prop is the AFFILIATE PROGRAM: 30% of every subscription ($1-2/subscriber/month, recurring)
- Include a concrete earnings example: "50 users from your link, 10% go paid = ~$20/mo passive income growing with every video"
- Their referral link tracks every install they drive — they get credit for every paid subscriber
- Simple CTA: "Reply and I'll set up your affiliate link"
- Include the App Store link: https://apps.apple.com/app/id6759472490${improvedTemplateBlock}

Return ONLY a JSON object:
{"handle1": {"subject": "...", "body": "..."}, "handle2": {"subject": "...", "body": "..."}}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[CreatorScout] Email generation failed:', err);
    return {};
  }
}

// ─── Phase 3: Warming Comments Generation ─────────────────────────────────────

async function generateWarmingComments(
  genAI: any,
  prospects: Array<{ handle: string; platform: string; niche?: string; contentStyle?: string }>,
): Promise<Record<string, string>> {
  if (prospects.length === 0) return {};

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const listText = prospects
    .map((p, i) => `${i + 1}. @${p.handle} on ${p.platform} | Niche: ${p.niche || 'fashion'} | Style: ${p.contentStyle || 'outfit content'}`)
    .join('\n');

  const prompt = `Generate 2-3 short, genuine engagement comments for each of these fashion creators. These are warming comments — pure content engagement, NO mention of Or This? or any app.

Creators:
${listText}

Rules:
- Each comment: 1-2 sentences, 15-30 words
- Specific to their niche and content style — not generic ("great post!")
- Sounds like a knowledgeable fashion enthusiast, not a brand
- Comment on craft: color blocking, layering, silhouette, proportions, texture contrast, styling choices
- Examples of good comments:
  "The color blocking here is strong — that rust tone works"
  "This layering is underrated, the texture contrast carries it"
  "The proportion play here — cropped top with wide-leg — is exactly right for this silhouette"
- Examples of bad comments (do NOT write): "Love this!", "So cute!", "Great outfit!", "Amazing content!"

Return ONLY a JSON object mapping handle to a single string with 2-3 comments separated by "|":
{"handle1": "comment 1|comment 2|comment 3", "handle2": "comment 1|comment 2"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[CreatorScout] Warming comment generation failed:', err);
    return {};
  }
}

// ─── Self-Optimization: Query Performance Analysis ────────────────────────────

async function analyzeQueryPerformance(): Promise<Record<string, number>> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const successStatuses = ['responded', 'onboarded', 'posted'];

  const successProspects = await prisma.creatorProspect.findMany({
    where: {
      status: { in: successStatuses },
      createdAt: { gte: twoWeeksAgo },
      searchQuery: { not: null },
    },
    select: { searchQuery: true },
  });

  const querySuccess: Record<string, number> = {};
  for (const p of successProspects) {
    if (p.searchQuery) {
      querySuccess[p.searchQuery] = (querySuccess[p.searchQuery] || 0) + 1;
    }
  }

  return querySuccess;
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

export async function runCreatorScout(): Promise<void> {
  console.log('[CreatorScout] Starting run...');

  if (!process.env.GEMINI_API_KEY) {
    console.log('[CreatorScout] GEMINI_API_KEY not set — skipping');
    return;
  }

  const genAI = await getGemini();
  const batchDate = new Date().toISOString().split('T')[0];

  // A5: Read creator_outreach_metrics to bias toward high-performing platforms
  let outreachBiasFilter: string | null = null;
  try {
    const outreachEntry = await getLatestBusEntry('creator_outreach_metrics');
    const outreachPayload = outreachEntry?.payload as Record<string, unknown> | null;
    if (outreachPayload?.type === 'outreach' && typeof outreachPayload.sent === 'number') {
      // If email outreach is active and sending, bias toward email-track creators
      if (outreachPayload.sent > 0) {
        outreachBiasFilter = 'email';
        console.log(`[CreatorScout] Outreach bias: email-track (${outreachPayload.sent} emails sent last run)`);
      }
    }
  } catch { /* non-fatal */ }

  // Analyze past query performance for self-optimization
  const queryPerformance = await analyzeQueryPerformance();
  const hasPerformanceData = Object.keys(queryPerformance).length > 0;

  // Daily run: 25 queries — top performers weighted + random rotation to cover all 100+
  let queriesToRun: string[];
  // If email bias active, prefer queries that are more likely to surface creators with email contact info
  const queryPool = outreachBiasFilter === 'email'
    ? SEARCH_QUERIES.filter(q => q.includes('site:') || q.includes('blogger') || q.includes('instagram') || q.includes('youtube'))
        .concat(SEARCH_QUERIES.filter(q => !q.includes('site:') && !q.includes('blogger') && !q.includes('instagram') && !q.includes('youtube')))
    : SEARCH_QUERIES;

  if (hasPerformanceData) {
    const sortedByPerformance = [...queryPool].sort((a, b) => {
      return (queryPerformance[b] || 0) - (queryPerformance[a] || 0);
    });
    // Top 10 high-performing + 15 random from the rest
    queriesToRun = [
      ...sortedByPerformance.slice(0, 10),
      ...sortedByPerformance.slice(10).sort(() => Math.random() - 0.5).slice(0, 15),
    ];
  } else {
    // First run: random 25 queries
    queriesToRun = [...queryPool].sort(() => Math.random() - 0.5).slice(0, 25);
  }

  let totalFound = 0;
  let totalSaved = 0;
  let emailTrackCount = 0;
  let dmTrackCount = 0;

  // Discover creators for each query
  const allProspects: Array<{
    platform: string; handle: string; displayName?: string; followerRange?: string;
    niche?: string; profileUrl?: string; contentStyle?: string; email?: string;
    searchQuery: string;
  }> = [];

  for (const query of queriesToRun) {
    try {
      console.log(`[CreatorScout] Searching: "${query.slice(0, 60)}..."`);
      const found = await discoverCreatorsForQuery(genAI, query);
      totalFound += found.length;

      for (const prospect of found) {
        allProspects.push({ ...prospect, searchQuery: query });
      }

      // Rate limiting: 2s between searches
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.warn(`[CreatorScout] Query failed:`, err);
    }
  }

  console.log(`[CreatorScout] Discovered ${totalFound} prospects across ${queriesToRun.length} queries`);

  // Split into email-track and DM-track
  const emailTrack = allProspects.filter(p => p.email);
  const dmTrack = allProspects.filter(p => !p.email);

  // Generate outreach content in batches of 5
  const dmBatches: typeof dmTrack[] = [];
  for (let i = 0; i < dmTrack.length; i += 5) {
    dmBatches.push(dmTrack.slice(i, i + 5));
  }

  const emailBatches: typeof emailTrack[] = [];
  for (let i = 0; i < emailTrack.length; i += 5) {
    emailBatches.push(emailTrack.slice(i, i + 5));
  }

  const allDMs: Record<string, string> = {};
  for (const batch of dmBatches) {
    const dms = await generateDMs(genAI, batch);
    Object.assign(allDMs, dms);
    await new Promise(r => setTimeout(r, 1000));
  }

  const allEmails: Record<string, { subject: string; body: string }> = {};
  for (const batch of emailBatches) {
    const emails = await generateEmails(genAI, batch);
    Object.assign(allEmails, emails);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Phase 3: Generate warming comments for DM-track prospects
  const allWarmingComments: Record<string, string> = {};
  const warmingBatches: typeof dmTrack[] = [];
  for (let i = 0; i < dmTrack.length; i += 5) {
    warmingBatches.push(dmTrack.slice(i, i + 5));
  }
  for (const batch of warmingBatches) {
    const comments = await generateWarmingComments(genAI, batch);
    Object.assign(allWarmingComments, comments);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Upsert prospects into DB
  for (const prospect of allProspects) {
    const outreachMethod = prospect.email ? 'email' : 'dm';
    const personalizedDM = allDMs[prospect.handle] || null;
    const emailContent = allEmails[prospect.handle] || null;
    const warmingComments = allWarmingComments[prospect.handle] || null;

    try {
      await prisma.creatorProspect.upsert({
        where: {
          platform_handle: {
            platform: prospect.platform,
            handle: prospect.handle,
          },
        },
        update: {
          // Only update if not yet contacted
          displayName: prospect.displayName,
          followerRange: prospect.followerRange,
          niche: prospect.niche,
          profileUrl: prospect.profileUrl,
          contentStyle: prospect.contentStyle,
          // Don't overwrite email/DM if already exists (prospect may have been updated)
        },
        create: {
          platform: prospect.platform,
          handle: prospect.handle,
          displayName: prospect.displayName,
          followerRange: prospect.followerRange,
          niche: prospect.niche,
          profileUrl: prospect.profileUrl,
          contentStyle: prospect.contentStyle,
          email: prospect.email,
          status: 'dm_ready',
          outreachMethod,
          personalizedDM,
          emailSubject: emailContent?.subject,
          emailBody: emailContent?.body,
          warmingComments,
          searchQuery: prospect.searchQuery,
          batchDate,
        },
      });
      totalSaved++;
      if (outreachMethod === 'email') emailTrackCount++;
      else dmTrackCount++;
    } catch (err) {
      // Unique constraint violations are expected (already in DB)
      if ((err as any)?.code !== 'P2002') {
        console.warn(`[CreatorScout] Failed to save @${prospect.handle}:`, err);
      }
    }
  }

  console.log(`[CreatorScout] Saved ${totalSaved} prospects (${emailTrackCount} email-track, ${dmTrackCount} DM-track)`);

  // Publish metrics to Intelligence Bus
  await publishToIntelligenceBus('creator-scout', 'creator_scout_metrics', {
    runAt: new Date().toISOString(),
    batchDate,
    queriesRun: queriesToRun.length,
    totalFound,
    totalSaved,
    emailTrackCount,
    dmTrackCount,
    queryPerformanceData: hasPerformanceData,
  });

  console.log('[CreatorScout] Run complete');
}
