import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { getWeatherForCity } from './weather.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  plus: 20,
  pro: Infinity,
};

const STYLIST_VOICE = `You are Noa, the AI personal stylist at Or This?. You speak like a SoHo stylist who charges $400/hour: direct, specific, and worth every word.

Voice rules (non-negotiable):
- Be decisive. Name the specific garment. Say "the navy trousers" not "your bottoms."
- No hedging. "The olive is competing with your skin tone" not "the olive might be a bit much."
- No emoji. No "Great question!" No "I'd love to help!" Just the answer.
- Short sentences that are right, not long sentences that hedge.
- One decisive take beats three suggestions.
- If you don't have enough info, ask one targeted question.
- Never say "I". Speak like a stylist to a client, not a chatbot to a user.

Use the user's wardrobe, weather, and style history to give specific, actionable advice. Reference actual items from their wardrobe by name when relevant.`;

export interface StylistChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  metadata?: any;
  createdAt: string;
}

export interface StylistChatResponse {
  message: string;
  wardrobeItems?: string[];
  actionType?: 'outfit_suggestion' | 'shopping' | 'general';
  remainingMessages?: number;
}

export async function handleStylistMessage(
  userId: string,
  message: string,
  tier: string
): Promise<StylistChatResponse> {
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;

  // Check rate limit
  if (isFinite(limit)) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayCount = await prisma.stylistChat.count({
      where: { userId, role: 'user', createdAt: { gte: todayStart } },
    });
    if (todayCount >= limit) {
      const err = new Error('Daily message limit reached') as any;
      err.status = 429;
      throw err;
    }
  }

  // Build rich context in parallel
  const [user, wardrobeItems, styleDNA, latestNarrative, upcomingEvents, prescription] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          city: true,
          bodyType: true,
          colorSeason: true,
          fashionGoals: true,
          styleDirection: true,
          honestyLevel: true,
        },
      }),
      prisma.wardrobeItem.findMany({
        where: { userId },
        orderBy: [{ timesWorn: 'desc' }],
        take: 20,
        select: { name: true, category: true, color: true, timesWorn: true },
      }),
      prisma.styleDNA.findFirst({
        where: { outfitCheck: { userId, isDeleted: false } },
        orderBy: { createdAt: 'desc' },
        select: {
          styleArchetypes: true,
          dominantColors: true,
          colorHarmony: true,
          formalityLevel: true,
        },
      }),
      prisma.styleNarrative.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { narrative: true },
      }),
      prisma.outfitCheck.findMany({
        where: { userId, isDeleted: false, eventDate: { gt: new Date() } },
        orderBy: { eventDate: 'asc' },
        take: 3,
        select: { occasions: true, eventDate: true, setting: true },
      }),
      prisma.wardrobePrescription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { gaps: true },
      }),
    ]);

  // Get weather (non-fatal)
  const weather = user?.city
    ? await getWeatherForCity(user.city).catch(() => null)
    : null;

  // Build context sections
  const contextParts: string[] = [];

  if (user) {
    const profileLines = [
      user.bodyType ? `Body type: ${user.bodyType}` : null,
      user.colorSeason ? `Color season: ${user.colorSeason}` : null,
      user.fashionGoals?.length ? `Style goals: ${user.fashionGoals.join(', ')}` : null,
      user.styleDirection ? `Direction: ${user.styleDirection}` : null,
      user.honestyLevel ? `Feedback preference: ${user.honestyLevel}` : null,
    ].filter(Boolean);
    if (profileLines.length > 0) {
      contextParts.push(`USER PROFILE:\n${profileLines.join('\n')}`);
    }
  }

  if (weather) {
    contextParts.push(
      `TODAY'S WEATHER${user?.city ? ` (${user.city})` : ''}:\n${weather.condition}, ${weather.tempFahrenheit}°F — ${weather.description}`
    );
  }

  if (wardrobeItems.length > 0) {
    const byCategory: Record<string, string[]> = {};
    wardrobeItems.forEach((item: { name: string; category: string; color: string | null; timesWorn: number }) => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item.color ? `${item.name} (${item.color})` : item.name);
    });
    const lines = Object.entries(byCategory)
      .map(([cat, items]) => `  ${cat}: ${items.join(', ')}`)
      .join('\n');
    contextParts.push(`WARDROBE (${wardrobeItems.length} items):\n${lines}`);
  } else {
    contextParts.push('WARDROBE: No items tracked yet.');
  }

  if (styleDNA) {
    const dnaLines = [
      styleDNA.styleArchetypes?.length
        ? `Archetypes: ${styleDNA.styleArchetypes.slice(0, 3).join(', ')}`
        : null,
      styleDNA.dominantColors?.length
        ? `Colors: ${styleDNA.dominantColors.slice(0, 5).join(', ')}`
        : null,
      styleDNA.colorHarmony ? `Color harmony: ${styleDNA.colorHarmony}` : null,
      styleDNA.formalityLevel != null
        ? `Formality: ${styleDNA.formalityLevel}/10`
        : null,
    ].filter(Boolean);
    if (dnaLines.length > 0) {
      contextParts.push(`STYLE DNA:\n${dnaLines.join('\n')}`);
    }
  }

  if (upcomingEvents.length > 0) {
    const eventLines = upcomingEvents.map((e: { occasions: string[]; eventDate: Date | null; setting: string | null }) => {
      const date = e.eventDate
        ? new Date(e.eventDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : 'upcoming';
      return `  ${e.occasions.join('/')} — ${date}${e.setting ? ` (${e.setting})` : ''}`;
    });
    contextParts.push(`UPCOMING EVENTS:\n${eventLines.join('\n')}`);
  }

  if (latestNarrative) {
    contextParts.push(`RECENT STYLE OBSERVATION:\n"${latestNarrative.narrative}"`);
  }

  if (prescription) {
    const gaps = prescription.gaps as any[];
    if (Array.isArray(gaps) && gaps.length > 0) {
      const gapNames = gaps.slice(0, 3).map((g: any) => g.gap || g.name || String(g));
      contextParts.push(`WARDROBE GAPS (AI-detected):\n${gapNames.join(', ')}`);
    }
  }

  const systemPrompt =
    contextParts.length > 0
      ? `${STYLIST_VOICE}\n\n---\n\n${contextParts.join('\n\n')}`
      : STYLIST_VOICE;

  // Load conversation history (last 10 turns = 20 messages)
  const recentChats = await prisma.stylistChat.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { role: true, content: true },
  });
  recentChats.reverse();

  const history = recentChats.map((c: { role: string; content: string }) => ({
    role: c.role as 'user' | 'model',
    parts: [{ text: c.content }],
  }));

  // Call Gemini
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ],
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(message);
  const aiText = result.response.text();
  if (!aiText) throw new Error('Empty response from stylist AI');

  // Save both messages
  await prisma.stylistChat.createMany({
    data: [
      { userId, role: 'user', content: message },
      { userId, role: 'model', content: aiText },
    ],
  });

  // Recalculate remaining for free tier
  let remainingMessages: number | undefined;
  if (isFinite(limit)) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const usedCount = await prisma.stylistChat.count({
      where: { userId, role: 'user', createdAt: { gte: todayStart } },
    });
    remainingMessages = Math.max(0, limit - usedCount);
  }

  return { message: aiText, remainingMessages };
}

export async function getStylistChatHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ messages: StylistChatMessage[]; hasMore: boolean; total: number }> {
  const offset = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.stylistChat.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      select: { id: true, role: true, content: true, metadata: true, createdAt: true },
    }),
    prisma.stylistChat.count({ where: { userId } }),
  ]);

  return {
    messages: messages.map((m: { id: string; role: string; content: string; metadata: any; createdAt: Date }) => ({
      id: m.id,
      role: m.role as 'user' | 'model',
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
    })),
    hasMore: offset + limit < total,
    total,
  };
}

export async function getDailyMessageLimit(userId: string, tier: string): Promise<{
  used: number;
  limit: number | null;
  remaining: number | null;
}> {
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;
  if (!isFinite(limit)) return { used: 0, limit: null, remaining: null };

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const used = await prisma.stylistChat.count({
    where: { userId, role: 'user', createdAt: { gte: todayStart } },
  });
  return { used, limit, remaining: Math.max(0, limit - used) };
}
