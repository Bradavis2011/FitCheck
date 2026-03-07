/**
 * Fashion Events Service
 *
 * Discovers local and global fashion events relevant to each user's city.
 * Surfaces event cards in "Your Week" and sends nudges before events.
 *
 * Flow:
 *  1. runFashionEventDiscovery() — weekly cron (Wed 8am UTC)
 *     → Queries Gemini for local events + merges known major events
 *     → Stores in FashionEvent table (deduped by name+date)
 *  2. matchEventsToUser(userId) — called by week.controller + nudge cron
 *     → Scores relevance by occasion + archetype alignment
 *     → Returns top 3 upcoming events within 14 days
 *  3. runFashionEventNudge() — daily 8:30am UTC (Plus/Pro only)
 *     → Sends push to users with matching events in next 7 days
 *     → Tracks engagement via event_metrics bus publication
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { pushService } from './push.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { trackServerEvent } from '../lib/posthog.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Seed list: major recurring fashion events ─────────────────────────────

interface SeedEvent {
  name: string;
  city: string;
  region: string;
  eventType: string;
  dressCode: string;
  description: string;
  months: number[]; // 1-12
}

const SEED_EVENTS: SeedEvent[] = [
  { name: 'New York Fashion Week', city: 'New York', region: 'NYC', eventType: 'fashion_week', dressCode: 'cocktail', description: 'Biannual showcase of top American designers.', months: [2, 9] },
  { name: 'Paris Fashion Week', city: 'Paris', region: 'Paris', eventType: 'fashion_week', dressCode: 'cocktail', description: 'The pinnacle of haute couture and ready-to-wear.', months: [3, 10] },
  { name: 'Milan Fashion Week', city: 'Milan', region: 'Milan', eventType: 'fashion_week', dressCode: 'cocktail', description: 'Italian luxury fashion at its finest.', months: [2, 9] },
  { name: 'London Fashion Week', city: 'London', region: 'London', eventType: 'fashion_week', dressCode: 'cocktail', description: 'Cutting-edge British fashion talent.', months: [2, 9] },
  { name: 'Met Gala', city: 'New York', region: 'NYC', eventType: 'awards', dressCode: 'black_tie', description: "Fashion's biggest night at the Metropolitan Museum of Art.", months: [5] },
  { name: 'Coachella Music & Arts Festival', city: 'Indio', region: 'Southern California', eventType: 'cultural', dressCode: 'casual', description: 'Iconic music festival with distinctive boho fashion.', months: [4] },
  { name: 'Academy Awards', city: 'Los Angeles', region: 'LA', eventType: 'awards', dressCode: 'black_tie', description: "Hollywood's biggest night — red carpet fashion.", months: [3] },
  { name: 'Grammy Awards', city: 'Los Angeles', region: 'LA', eventType: 'awards', dressCode: 'formal', description: "Music's biggest night — eclectic red carpet fashion.", months: [2] },
  { name: 'Golden Globe Awards', city: 'Beverly Hills', region: 'LA', eventType: 'awards', dressCode: 'formal', description: 'Film and TV awards with glamorous fashion.', months: [1] },
];

// ─── Single city event discovery ──────────────────────────────────────────

async function discoverEventsForCity(city: string): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  const now = new Date();
  const threeWeeksOut = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const currentMonth = now.getMonth() + 1;

  // Upsert relevant seed events for this time window
  for (const seed of SEED_EVENTS) {
    const nearestMonth = seed.months.reduce((best, m) =>
      Math.abs(m - currentMonth) < Math.abs(best - currentMonth) ? m : best,
    );
    if (Math.abs(nearestMonth - currentMonth) > 2) continue;

    const eventDate = new Date(now.getFullYear(), nearestMonth - 1, 15);
    if (eventDate < now || eventDate > threeWeeksOut) continue;

    try {
      await (prisma as any).fashionEvent.upsert({
        where: { name_date: { name: seed.name, date: eventDate } },
        create: {
          name: seed.name,
          city: seed.city,
          region: seed.region,
          date: eventDate,
          eventType: seed.eventType,
          dressCode: seed.dressCode,
          description: seed.description,
          source: 'seed',
          relevanceScore: 1.0,
        },
        update: {},
      });
    } catch { /* constraint violation — skip */ }
  }

  // Ask Gemini for local events specific to this city
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    });

    const prompt = `You are a fashion event calendar. For ${city}, list verifiable fashion-relevant events in the next 3 weeks (${now.toISOString().slice(0, 10)} to ${threeWeeksOut.toISOString().slice(0, 10)}).

Include: sample sales, pop-up shops, gallery openings, seasonal markets, trunk shows.
Only include events you are confident actually exist — return empty array if unsure.

Return JSON array only (no markdown), max 5 events:
[{"name":"...","date":"YYYY-MM-DD","eventType":"sample_sale|popup|gallery|cultural","dressCode":"casual|smart_casual|cocktail|formal|null","description":"1 sentence"}]`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return;

    const events = JSON.parse(match[0]) as Array<{
      name: string;
      date: string;
      eventType: string;
      dressCode?: string | null;
      description?: string;
    }>;

    for (const ev of events) {
      if (!ev.name || !ev.date) continue;
      const eventDate = new Date(ev.date);
      if (isNaN(eventDate.getTime())) continue;

      try {
        await (prisma as any).fashionEvent.upsert({
          where: { name_date: { name: ev.name, date: eventDate } },
          create: {
            name: ev.name,
            city,
            date: eventDate,
            eventType: ev.eventType || 'cultural',
            dressCode: ev.dressCode ?? null,
            description: ev.description ?? null,
            source: 'gemini',
            relevanceScore: 0.7,
          },
          update: {},
        });
      } catch { /* skip duplicates */ }
    }
  } catch (err) {
    console.error(`[FashionEvents] Gemini discovery failed for ${city}:`, err);
  }
}

// ─── Match events to user ──────────────────────────────────────────────────

export interface LocalFashionEvent {
  id: string;
  name: string;
  city: string;
  date: string;
  eventType: string;
  dressCode: string | null;
  description: string | null;
  relevanceScore: number;
}

const OCCASION_DRESS_CODE_MAP: Record<string, string[]> = {
  work: ['smart_casual', 'formal'],
  'date night': ['cocktail', 'smart_casual'],
  formal: ['formal', 'black_tie', 'cocktail'],
  casual: ['casual', 'smart_casual'],
  event: ['cocktail', 'formal', 'black_tie'],
  interview: ['formal', 'smart_casual'],
};

export async function matchEventsToUser(userId: string): Promise<LocalFashionEvent[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { city: true, primaryOccasions: true },
  });

  if (!user?.city) return [];

  const now = new Date();
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const cityLower = user.city.toLowerCase();

  const allEvents = await (prisma as any).fashionEvent.findMany({
    where: { date: { gte: now, lte: fourteenDaysOut } },
    orderBy: { date: 'asc' },
    take: 30,
  }) as Array<{
    id: string;
    name: string;
    city: string;
    region: string | null;
    date: Date;
    eventType: string;
    dressCode: string | null;
    description: string | null;
    relevanceScore: number;
  }>;

  // Filter: events in user's city or global major events
  const cityEvents = allEvents.filter(ev => {
    const evCity = ev.city.toLowerCase();
    const evRegion = (ev.region || '').toLowerCase();
    const isLocal = evCity.includes(cityLower) || cityLower.includes(evCity) || evRegion.includes(cityLower);
    const isGlobal = ev.eventType === 'fashion_week' || ev.eventType === 'awards';
    return isLocal || isGlobal;
  });

  // Score relevance by dress code vs occasion alignment
  const scoredEvents = cityEvents.map(ev => {
    let score = ev.relevanceScore;
    for (const occasion of (user.primaryOccasions ?? [])) {
      const matchCodes = OCCASION_DRESS_CODE_MAP[occasion.toLowerCase()] ?? [];
      if (ev.dressCode && matchCodes.includes(ev.dressCode)) score += 0.2;
    }
    return { ...ev, relevanceScore: Math.min(score, 2) };
  });

  scoredEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scoredEvents.slice(0, 3).map(ev => ({
    id: ev.id,
    name: ev.name,
    city: ev.city,
    date: ev.date.toISOString(),
    eventType: ev.eventType,
    dressCode: ev.dressCode,
    description: ev.description,
    relevanceScore: ev.relevanceScore,
  }));
}

// ─── Weekly discovery cron ─────────────────────────────────────────────────

export async function runFashionEventDiscovery(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      tier: { in: ['plus', 'pro'] },
      city: { not: null },
      updatedAt: { gte: thirtyDaysAgo },
    },
    select: { city: true },
    distinct: ['city'],
  });

  const cities = [...new Set(users.map(u => u.city!).filter(Boolean))];
  console.log(`[FashionEvents] Discovering events for ${cities.length} cities`);

  for (const city of cities) {
    await discoverEventsForCity(city).catch(err =>
      console.error(`[FashionEvents] Failed for ${city}:`, err),
    );
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('[FashionEvents] Discovery cycle complete');
}

// ─── Daily event nudge ─────────────────────────────────────────────────────

export async function runFashionEventNudge(): Promise<void> {
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const eligibleUsers = await prisma.user.findMany({
    where: { tier: { in: ['plus', 'pro'] }, city: { not: null } },
    select: { id: true, city: true },
  });

  let nudgesSent = 0;
  let nudgesSkipped = 0;

  for (const user of eligibleUsers) {
    if (!user.city) continue;

    try {
      const events = await matchEventsToUser(user.id);
      const soonEvents = events.filter(ev => {
        const d = new Date(ev.date);
        return d >= now && d <= sevenDaysOut;
      });

      if (soonEvents.length === 0) { nudgesSkipped++; continue; }

      // Check if already nudged today for fashion events
      const alreadyNudged = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: 'fashion_event',
          createdAt: { gte: oneDayAgo },
        },
      });

      if (alreadyNudged) { nudgesSkipped++; continue; }

      const topEvent = soonEvents[0];
      const daysUntil = Math.round((new Date(topEvent.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      const dressPart = topEvent.dressCode
        ? ` (${topEvent.dressCode.replace(/_/g, ' ')} attire)`
        : '';

      const title = topEvent.name;
      const body = `${topEvent.name}${dressPart} is ${daysText}. Get your look ready.`;

      await pushService.sendPushNotification(user.id, {
        title,
        body,
        data: { type: 'fashion_event', eventId: topEvent.id },
      });

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'fashion_event',
          title,
          body,
          metadata: { eventId: topEvent.id, eventType: topEvent.eventType, daysUntil },
        },
      });

      trackServerEvent(user.id, 'fashion_event_nudge_sent', {
        eventName: topEvent.name,
        eventType: topEvent.eventType,
        daysUntil,
      });

      nudgesSent++;
    } catch (err) {
      console.error(`[FashionEvents] Nudge failed for user ${user.id}:`, err);
    }
  }

  await publishToIntelligenceBus('fashion-events', 'event_metrics', {
    measuredAt: now.toISOString(),
    nudgesSent,
    nudgesSkipped,
    eligibleUsers: eligibleUsers.length,
  });

  console.log(`[FashionEvents] Event nudge: ${nudgesSent} sent, ${nudgesSkipped} skipped`);
}
