import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const VALID_DRESS_CODES = ['casual', 'smart_casual', 'business_casual', 'formal', 'black_tie'] as const;
const VALID_EVENT_TYPES = ['wedding', 'job_interview', 'date_night', 'conference', 'party', 'vacation', 'other'] as const;

function requirePro(req: AuthenticatedRequest) {
  if (!req.user || req.user.tier !== 'pro') {
    throw new AppError(403, 'Event planning mode requires a Pro subscription.');
  }
}

const CreateEventSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().datetime(),
  dressCode: z.enum(VALID_DRESS_CODES).optional(),
  type: z.enum(VALID_EVENT_TYPES).optional(),
  notes: z.string().max(1000).optional(),
});

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  date: z.string().datetime().optional(),
  dressCode: z.enum(VALID_DRESS_CODES).optional().nullable(),
  type: z.enum(VALID_EVENT_TYPES).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['upcoming', 'past']).optional(),
});

const AddOutfitSchema = z.object({
  outfitCheckId: z.string().uuid(),
});

// GET /api/events?status=upcoming|past
export async function listEvents(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const status = (req.query.status as string) || undefined;

  const where: { userId: string; status?: string } = { userId };
  if (status === 'upcoming' || status === 'past') where.status = status;

  // Auto-transition events whose date has passed
  await prisma.event.updateMany({
    where: { userId, status: 'upcoming', date: { lte: new Date() } },
    data: { status: 'past' },
  });

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      _count: { select: { outfitOptions: true } },
    },
  });

  res.json({
    events: events.map((e) => ({ ...e, outfitCount: e._count.outfitOptions })),
  });
}

// GET /api/events/:id
export async function getEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id } = req.params;

  const event = await prisma.event.findFirst({
    where: { id, userId },
    include: {
      outfitOptions: {
        orderBy: { addedAt: 'asc' },
        include: {
          outfitCheck: {
            select: {
              id: true,
              thumbnailUrl: true,
              thumbnailData: true,
              aiScore: true,
              aiFeedback: true,
              occasions: true,
              setting: true,
              weather: true,
              vibe: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!event) throw new AppError(404, 'Event not found');

  res.json({ event });
}

// POST /api/events
export async function createEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const body = CreateEventSchema.parse(req.body);

  const event = await prisma.event.create({
    data: {
      userId,
      title: body.title,
      date: new Date(body.date),
      dressCode: body.dressCode ?? null,
      type: body.type ?? null,
      notes: body.notes ?? null,
      status: new Date(body.date) <= new Date() ? 'past' : 'upcoming',
    },
    include: { _count: { select: { outfitOptions: true } } },
  });

  res.status(201).json({ event: { ...event, outfitCount: event._count.outfitOptions } });
}

// PUT /api/events/:id
export async function updateEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id } = req.params;
  const body = UpdateEventSchema.parse(req.body);

  const existing = await prisma.event.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Event not found');

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.dressCode !== undefined && { dressCode: body.dressCode }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  res.json({ event });
}

// DELETE /api/events/:id
export async function deleteEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.event.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, 'Event not found');

  await prisma.event.delete({ where: { id } });
  res.json({ success: true });
}

// POST /api/events/:id/outfits  — attach an outfit check to an event
export async function addOutfitToEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id: eventId } = req.params;
  const { outfitCheckId } = AddOutfitSchema.parse(req.body);

  const event = await prisma.event.findFirst({ where: { id: eventId, userId } });
  if (!event) throw new AppError(404, 'Event not found');

  const outfit = await prisma.outfitCheck.findFirst({
    where: { id: outfitCheckId, userId, isDeleted: false },
  });
  if (!outfit) throw new AppError(404, 'Outfit not found or does not belong to you');

  const existing = await prisma.eventOutfit.findFirst({
    where: { eventId, outfitCheckId },
  });
  if (existing) throw new AppError(409, 'This outfit is already attached to the event');

  const eventOutfit = await prisma.eventOutfit.create({
    data: { eventId, outfitCheckId, userId },
    include: {
      outfitCheck: {
        select: {
          id: true,
          thumbnailUrl: true,
          thumbnailData: true,
          aiScore: true,
          aiFeedback: true,
          occasions: true,
          createdAt: true,
        },
      },
    },
  });

  // Invalidate any cached comparison since the outfit list changed
  await prisma.event.update({
    where: { id: eventId },
    data: { compareResult: Prisma.JsonNull, compareRunAt: null },
  });

  res.status(201).json({ eventOutfit });
}

// DELETE /api/events/:id/outfits/:outfitCheckId
export async function removeOutfitFromEvent(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id: eventId, outfitCheckId } = req.params;

  const event = await prisma.event.findFirst({ where: { id: eventId, userId } });
  if (!event) throw new AppError(404, 'Event not found');

  const eventOutfit = await prisma.eventOutfit.findFirst({
    where: { eventId, outfitCheckId },
  });
  if (!eventOutfit) throw new AppError(404, 'Outfit not attached to this event');

  await prisma.eventOutfit.delete({ where: { id: eventOutfit.id } });

  // Invalidate cached comparison
  await prisma.event.update({
    where: { id: eventId },
    data: { compareResult: Prisma.JsonNull, compareRunAt: null },
  });

  res.json({ success: true });
}

// POST /api/events/:id/compare  — AI comparison of all attached outfits
export async function compareOutfits(req: AuthenticatedRequest, res: Response) {
  requirePro(req);
  const userId = req.user!.id;
  const { id: eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, userId },
    include: {
      outfitOptions: {
        orderBy: { addedAt: 'asc' },
        include: {
          outfitCheck: {
            select: {
              id: true,
              aiScore: true,
              aiFeedback: true,
              occasions: true,
              setting: true,
              vibe: true,
            },
          },
        },
      },
    },
  });

  if (!event) throw new AppError(404, 'Event not found');
  if (event.outfitOptions.length < 2) {
    throw new AppError(400, 'Add at least 2 outfits to get an AI comparison');
  }

  // Return cached result if run in last 24h and outfit list unchanged
  if (event.compareResult && event.compareRunAt) {
    const age = Date.now() - new Date(event.compareRunAt).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      res.json({ result: event.compareResult, cached: true });
      return;
    }
  }

  // Build prompt from stored AI feedback — no image re-upload needed
  const outfitSummaries = event.outfitOptions.map((eo, i) => {
    const oc = eo.outfitCheck;
    const fb = oc.aiFeedback as any;
    // Support both v3.0 (editorialSummary / whatsRight / couldImprove) and legacy v2.0 formats
    const summary = fb?.editorialSummary ?? fb?.summary ?? 'No AI summary available';
    const score = oc.aiScore ?? 'Unknown';
    const working = Array.isArray(fb?.whatsRight)
      ? fb.whatsRight.join(', ')
      : (fb?.whatsWorking?.map((w: any) => w.point).join(', ') ?? '');
    const concerns = Array.isArray(fb?.couldImprove)
      ? fb.couldImprove.join(', ')
      : (fb?.consider?.map((c: any) => c.point).join(', ') ?? '');
    return `Outfit ${i + 1} (ID: ${oc.id}):
  - AI Score: ${score}/10
  - Summary: ${summary}
  - What's working: ${working || 'N/A'}
  - Points to consider: ${concerns || 'N/A'}
  - Occasions tagged: ${oc.occasions?.join(', ') || 'N/A'}
  - Vibe: ${oc.vibe || 'N/A'}`;
  }).join('\n\n');

  const eventContext = [
    `Event: ${event.title}`,
    `Date: ${new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    event.type ? `Type: ${event.type.replace(/_/g, ' ')}` : '',
    event.dressCode ? `Dress code: ${event.dressCode.replace(/_/g, ' ')}` : '',
    event.notes ? `Notes: ${event.notes}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are a professional personal stylist. A user is deciding what to wear to an event.

${eventContext}

Here are the outfits they are considering (with existing AI analysis):

${outfitSummaries}

Provide a structured comparison with:
1. A clear winner recommendation with reasoning specific to the event
2. A brief ranking of all outfits (best to worst for this specific event)
3. One actionable styling tip to elevate the winning outfit for this occasion

Respond in JSON with this exact structure:
{
  "winnerId": "<outfit check ID>",
  "winnerReason": "<1-2 sentence explanation why this outfit wins for this specific event>",
  "rankings": [
    { "outfitId": "<ID>", "rank": 1, "score": <1-10 float>, "notes": "<why this ranks here>" }
  ],
  "stylingTip": "<one specific tip to elevate the winner for this event>",
  "summary": "<2-3 sentence overall summary of the comparison>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let compareResult: object;
  try {
    compareResult = JSON.parse(jsonText);
  } catch {
    throw new AppError(500, 'AI returned an unexpected response format. Please try again.');
  }

  // Cache the result
  await prisma.event.update({
    where: { id: eventId },
    data: { compareResult, compareRunAt: new Date() },
  });

  res.json({ result: compareResult, cached: false });
}
