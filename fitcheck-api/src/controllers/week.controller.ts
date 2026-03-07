import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { getWeatherForCity } from '../services/weather.service.js';
import { matchEventsToUser } from '../services/fashion-events.service.js';

/**
 * GET /api/week
 *
 * Returns a personalised "Your Week" payload:
 *   - weather: current forecast for user's city (null when city not set)
 *   - upcomingEvents: EventFollowUp rows whose eventDate is within the next 7 days
 *   - suggestions: 1-2 short proactive copy strings built from wardrobe + weather
 *
 * Gated to Plus / Pro on the frontend; the endpoint itself is auth-only so it
 * can be called without a separate subscription check middleware.
 */
export async function getYourWeek(req: Request, res: Response) {
  const userId = (req as any).user.id;

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ── Parallel queries ────────────────────────────────────────────────────────
  const [user, upcomingFollowUps] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { city: true },
    }),
    prisma.eventFollowUp.findMany({
      where: {
        userId,
        status: 'pending',
        eventDate: { gte: now, lte: sevenDaysOut },
      },
      include: {
        outfitCheck: { select: { aiScore: true, thumbnailUrl: true } },
      },
      orderBy: { eventDate: 'asc' },
      take: 5,
    }),
  ]);

  // ── Weather ─────────────────────────────────────────────────────────────────
  const weather = user?.city ? await getWeatherForCity(user.city).catch(() => null) : null;

  // ── Upcoming events ─────────────────────────────────────────────────────────
  const upcomingEvents = upcomingFollowUps.map((fu) => ({
    id: fu.id,
    occasion: fu.occasion,
    eventDate: fu.eventDate?.toISOString() ?? null,
    outfitScore: (fu.outfitCheck as any)?.aiScore ?? null,
    thumbnailUrl: (fu.outfitCheck as any)?.thumbnailUrl ?? null,
    followUpAt: fu.followUpAt.toISOString(),
  }));

  // ── Local fashion events ─────────────────────────────────────────────────────
  const localEvents = await matchEventsToUser(userId).catch(() => []);

  // ── Suggestions ─────────────────────────────────────────────────────────────
  // Short, proactive copy strings surfaced in the "Your Week" card.
  const suggestions: string[] = [];

  if (weather) {
    suggestions.push(weather.promptText);
  }

  if (upcomingEvents.length > 0) {
    const next = upcomingEvents[0];
    const dayLabel = getDayLabel(next.eventDate ? new Date(next.eventDate) : null);
    const scoreText = next.outfitScore ? ` (${next.outfitScore.toFixed(1)}/10)` : '';
    suggestions.push(`${next.occasion} ${dayLabel}. Your look${scoreText} is locked in.`);
  }

  res.json({ weather, upcomingEvents, localEvents, suggestions });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDayLabel(date: Date | null): string {
  if (!date) return 'this week';
  const now = new Date();
  const diff = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `on ${days[date.getDay()]}`;
}
