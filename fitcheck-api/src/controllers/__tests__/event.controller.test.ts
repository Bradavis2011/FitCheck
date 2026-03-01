import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockGenerateContent = vi.hoisted(() => vi.fn());

const mockEventFindMany = vi.hoisted(() => vi.fn());
const mockEventFindFirst = vi.hoisted(() => vi.fn());
const mockEventCreate = vi.hoisted(() => vi.fn());
const mockEventUpdate = vi.hoisted(() => vi.fn());
const mockEventUpdateMany = vi.hoisted(() => vi.fn());
const mockEventDelete = vi.hoisted(() => vi.fn());
const mockOutfitCheckFindFirst = vi.hoisted(() => vi.fn());
const mockEventOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockEventOutfitCreate = vi.hoisted(() => vi.fn());
const mockEventOutfitDelete = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    event: {
      findMany: mockEventFindMany,
      findFirst: mockEventFindFirst,
      create: mockEventCreate,
      update: mockEventUpdate,
      updateMany: mockEventUpdateMany,
      delete: mockEventDelete,
    },
    outfitCheck: { findFirst: mockOutfitCheckFindFirst },
    eventOutfit: {
      findFirst: mockEventOutfitFindFirst,
      create: mockEventOutfitCreate,
      delete: mockEventOutfitDelete,
    },
  },
}));

import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  addOutfitToEvent,
  removeOutfitFromEvent,
  compareOutfits,
} from '../event.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1', tier: 'pro', email: 'test@test.com' },
    userId: 'user-1',
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeFreeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'user-1', tier: 'free', email: 'test@test.com' },
    userId: 'user-1',
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

const SAMPLE_EVENT = {
  id: 'event-1',
  userId: 'user-1',
  title: 'Work Conference',
  date: new Date('2026-04-15'),
  dressCode: 'business_casual',
  type: 'conference',
  notes: null,
  status: 'upcoming',
  _count: { outfitOptions: 0 },
};

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockEventFindMany.mockReset();
  mockEventFindFirst.mockReset();
  mockEventCreate.mockReset();
  mockEventUpdate.mockReset();
  mockEventUpdateMany.mockReset();
  mockEventDelete.mockReset();
  mockOutfitCheckFindFirst.mockReset();
  mockEventOutfitFindFirst.mockReset();
  mockEventOutfitCreate.mockReset();
  mockEventOutfitDelete.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

// ─── listEvents ───────────────────────────────────────────────────────────────

describe('listEvents', () => {
  it('throws AppError(403) when tier is free', async () => {
    const req = makeFreeReq({ query: {} });
    const { res } = makeRes();
    await expect(listEvents(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns events with outfitCount field', async () => {
    mockEventUpdateMany.mockResolvedValue({ count: 0 });
    mockEventFindMany.mockResolvedValue([SAMPLE_EVENT]);
    const req = makeReq({ query: {} });
    const { res, json } = makeRes();
    await listEvents(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ outfitCount: 0 }),
        ]),
      }),
    );
  });
});

// ─── getEvent ─────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  it('throws AppError(403) when tier is free', async () => {
    const req = makeFreeReq({ params: { id: 'event-1' } });
    const { res } = makeRes();
    await expect(getEvent(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(404) when event not found', async () => {
    mockEventFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-event' } });
    const { res } = makeRes();
    await expect(getEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── createEvent ──────────────────────────────────────────────────────────────

describe('createEvent', () => {
  it('throws AppError(403) when tier is free', async () => {
    const req = makeFreeReq({ body: { title: 'Test', date: '2026-05-01T10:00:00.000Z' } });
    const { res } = makeRes();
    await expect(createEvent(req, res)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws Zod error when title is missing', async () => {
    const req = makeReq({ body: { date: '2026-05-01T10:00:00.000Z' } });
    const { res } = makeRes();
    await expect(createEvent(req, res)).rejects.toThrow();
  });

  it('creates event and responds 201', async () => {
    const created = { ...SAMPLE_EVENT, _count: { outfitOptions: 0 } };
    mockEventCreate.mockResolvedValue(created);
    const req = makeReq({
      body: { title: 'Work Conference', date: '2026-04-15T10:00:00.000Z', type: 'conference', dressCode: 'business_casual' },
    });
    const { res, json, status } = makeRes();
    await createEvent(req, res);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ outfitCount: 0 }) }),
    );
  });
});

// ─── updateEvent ──────────────────────────────────────────────────────────────

describe('updateEvent', () => {
  it('throws AppError(404) when event not found', async () => {
    mockEventFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-event' }, body: { title: 'Updated' } });
    const { res } = makeRes();
    await expect(updateEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── deleteEvent ──────────────────────────────────────────────────────────────

describe('deleteEvent', () => {
  it('throws AppError(404) when event not found', async () => {
    mockEventFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-event' } });
    const { res } = makeRes();
    await expect(deleteEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes event and returns { success: true }', async () => {
    mockEventFindFirst.mockResolvedValue(SAMPLE_EVENT);
    mockEventDelete.mockResolvedValue(SAMPLE_EVENT);
    const req = makeReq({ params: { id: 'event-1' } });
    const { res, json } = makeRes();
    await deleteEvent(req, res);
    expect(mockEventDelete).toHaveBeenCalledWith({ where: { id: 'event-1' } });
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

// ─── addOutfitToEvent ─────────────────────────────────────────────────────────

describe('addOutfitToEvent', () => {
  const validBody = { outfitCheckId: '00000000-0000-0000-0000-000000000001' };

  it('throws AppError(404) when event not found', async () => {
    mockEventFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'event-1' }, body: validBody });
    const { res } = makeRes();
    await expect(addOutfitToEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(404) when outfit not found', async () => {
    mockEventFindFirst.mockResolvedValue(SAMPLE_EVENT);
    mockOutfitCheckFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'event-1' }, body: validBody });
    const { res } = makeRes();
    await expect(addOutfitToEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(409) when outfit already attached to event', async () => {
    mockEventFindFirst.mockResolvedValue(SAMPLE_EVENT);
    mockOutfitCheckFindFirst.mockResolvedValue({ id: validBody.outfitCheckId, userId: 'user-1', isDeleted: false });
    mockEventOutfitFindFirst.mockResolvedValue({ id: 'eo-1' });
    const req = makeReq({ params: { id: 'event-1' }, body: validBody });
    const { res } = makeRes();
    await expect(addOutfitToEvent(req, res)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates eventOutfit and responds 201', async () => {
    mockEventFindFirst.mockResolvedValue(SAMPLE_EVENT);
    mockOutfitCheckFindFirst.mockResolvedValue({ id: validBody.outfitCheckId, userId: 'user-1', isDeleted: false });
    mockEventOutfitFindFirst.mockResolvedValue(null);
    const createdEventOutfit = {
      id: 'eo-new',
      eventId: 'event-1',
      outfitCheckId: validBody.outfitCheckId,
      userId: 'user-1',
      outfitCheck: { id: validBody.outfitCheckId, thumbnailUrl: null, thumbnailData: null, aiScore: 8, aiFeedback: {}, occasions: [], createdAt: new Date() },
    };
    mockEventOutfitCreate.mockResolvedValue(createdEventOutfit);
    mockEventUpdate.mockResolvedValue({});
    const req = makeReq({ params: { id: 'event-1' }, body: validBody });
    const { res, json, status } = makeRes();
    await addOutfitToEvent(req, res);
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ eventOutfit: expect.objectContaining({ id: 'eo-new' }) }),
    );
  });
});

// ─── removeOutfitFromEvent ────────────────────────────────────────────────────

describe('removeOutfitFromEvent', () => {
  it('throws AppError(404) when eventOutfit not found', async () => {
    mockEventFindFirst.mockResolvedValue(SAMPLE_EVENT);
    mockEventOutfitFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'event-1', outfitCheckId: 'outfit-1' } });
    const { res } = makeRes();
    await expect(removeOutfitFromEvent(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── compareOutfits ───────────────────────────────────────────────────────────

describe('compareOutfits', () => {
  const outfit1 = {
    outfitCheck: {
      id: '00000000-0000-0000-0000-000000000001',
      aiScore: 8,
      aiFeedback: { editorialSummary: 'Clean look', whatsRight: ['good fit'], couldImprove: ['add belt'] },
      occasions: ['conference'],
      setting: 'office',
      vibe: 'professional',
    },
  };
  const outfit2 = {
    outfitCheck: {
      id: '00000000-0000-0000-0000-000000000002',
      aiScore: 7,
      aiFeedback: { editorialSummary: 'Casual look', whatsRight: ['comfortable'], couldImprove: ['more formal'] },
      occasions: ['conference'],
      setting: 'office',
      vibe: 'smart casual',
    },
  };

  it('throws AppError(400) when fewer than 2 outfits attached', async () => {
    mockEventFindFirst.mockResolvedValue({
      ...SAMPLE_EVENT,
      outfitOptions: [outfit1],
      compareResult: null,
      compareRunAt: null,
    });
    const req = makeReq({ params: { id: 'event-1' } });
    const { res } = makeRes();
    await expect(compareOutfits(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns cached result when compareResult exists and is less than 24h old', async () => {
    const cachedResult = { winnerId: outfit1.outfitCheck.id, winnerReason: 'Best overall' };
    mockEventFindFirst.mockResolvedValue({
      ...SAMPLE_EVENT,
      outfitOptions: [outfit1, outfit2],
      compareResult: cachedResult,
      compareRunAt: new Date(), // just now — well within 24h
    });
    const req = makeReq({ params: { id: 'event-1' } });
    const { res, json } = makeRes();
    await compareOutfits(req, res);
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ cached: true, result: cachedResult }));
  });

  it('calls Gemini and returns comparison result', async () => {
    mockEventFindFirst.mockResolvedValue({
      ...SAMPLE_EVENT,
      outfitOptions: [outfit1, outfit2],
      compareResult: null,
      compareRunAt: null,
    });

    const aiResult = {
      winnerId: outfit1.outfitCheck.id,
      winnerReason: 'More professional overall.',
      rankings: [
        { outfitId: outfit1.outfitCheck.id, rank: 1, score: 8.5, notes: 'Best for conference' },
        { outfitId: outfit2.outfitCheck.id, rank: 2, score: 7.0, notes: 'Too casual' },
      ],
      stylingTip: 'Add a pocket square to elevate the look.',
      summary: 'Outfit 1 wins for this conference setting.',
    };

    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(aiResult) },
    });
    mockEventUpdate.mockResolvedValue({});

    const req = makeReq({ params: { id: 'event-1' } });
    const { res, json } = makeRes();
    await compareOutfits(req, res);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockEventUpdate).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ cached: false, result: aiResult }),
    );
  });
});
