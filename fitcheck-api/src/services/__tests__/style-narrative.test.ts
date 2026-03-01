import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());
const mockStyleNarrativeFindUnique = vi.hoisted(() => vi.fn());
const mockStyleNarrativeCreate = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockCanSendNotification = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: {
      groupBy: mockGroupBy,
    },
    styleNarrative: {
      findUnique: mockStyleNarrativeFindUnique,
      create: mockStyleNarrativeCreate,
    },
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
    notification: {
      create: mockNotificationCreate,
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
}));

vi.mock('../event-followup.service.js', () => ({
  canSendRelationshipNotification: mockCanSendNotification,
}));

vi.mock('../../controllers/notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runStyleNarrativeAgent } from '../style-narrative.service.js';

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockGroupBy.mockReset();
  mockStyleNarrativeFindUnique.mockReset();
  mockStyleNarrativeCreate.mockReset();
  mockStyleDNAFindMany.mockReset();
  mockNotificationCreate.mockReset();
  mockExecuteOrQueue.mockReset();
  mockCanSendNotification.mockReset();
  mockCreateNotification.mockReset();

  // Sensible defaults
  mockGroupBy.mockResolvedValue([{ userId: 'user-1', _count: { id: 5 } }]);
  mockStyleNarrativeFindUnique.mockResolvedValue(null);
  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockCanSendNotification.mockResolvedValue(true);
  mockCreateNotification.mockResolvedValue({ id: 'notif-1' });
  mockStyleNarrativeCreate.mockResolvedValue({ id: 'sn-1' });
  mockStyleDNAFindMany.mockResolvedValue([]);
  mockGenerateContent.mockResolvedValue({
    response: { text: () => 'You have been gravitating toward navy lately.' },
  });
});

// ─── runStyleNarrativeAgent ───────────────────────────────────────────────────

describe('runStyleNarrativeAgent', () => {
  it('does not call executeOrQueue when no users are active (groupBy returns empty)', async () => {
    mockGroupBy.mockResolvedValue([]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('skips users with fewer than 3 outfit checks', async () => {
    mockGroupBy.mockResolvedValue([
      { userId: 'user-low-1', _count: { id: 1 } },
      { userId: 'user-low-2', _count: { id: 2 } },
    ]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('calls executeOrQueue once for a single eligible user (3+ checks)', async () => {
    mockGroupBy.mockResolvedValue([{ userId: 'user-1', _count: { id: 5 } }]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(1);
  });

  it('calls executeOrQueue with correct agent name and action type', async () => {
    mockGroupBy.mockResolvedValue([{ userId: 'user-1', _count: { id: 4 } }]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'style-narrative',
      'generate_narrative',
      'medium',
      expect.objectContaining({ userId: 'user-1' }),
      expect.any(Function),
    );
  });

  it('calls executeOrQueue once per eligible user when multiple eligible users exist', async () => {
    mockGroupBy.mockResolvedValue([
      { userId: 'user-1', _count: { id: 5 } },
      { userId: 'user-2', _count: { id: 7 } },
      { userId: 'user-3', _count: { id: 3 } },
    ]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(3);
    const calledUserIds = mockExecuteOrQueue.mock.calls.map((c) => (c[3] as { userId: string }).userId);
    expect(calledUserIds).toContain('user-1');
    expect(calledUserIds).toContain('user-2');
    expect(calledUserIds).toContain('user-3');
  });

  it('skips a user that already has a narrative for this period (findUnique returns existing)', async () => {
    mockStyleNarrativeFindUnique.mockResolvedValue({ id: 'existing-sn', narrative: 'Already written.' });

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('calls findUnique with userId and current period for each eligible user', async () => {
    mockGroupBy.mockResolvedValue([{ userId: 'user-1', _count: { id: 4 } }]);

    await runStyleNarrativeAgent();

    expect(mockStyleNarrativeFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId_period: expect.objectContaining({ userId: 'user-1' }),
        }),
      }),
    );
  });

  it('resolves without throwing even if executeOrQueue throws (error is caught per-user)', async () => {
    mockExecuteOrQueue.mockRejectedValue(new Error('Agent queue unavailable'));

    await expect(runStyleNarrativeAgent()).resolves.toBeUndefined();
  });

  it('processes the remaining users when one user throws mid-loop', async () => {
    mockGroupBy.mockResolvedValue([
      { userId: 'user-fail', _count: { id: 5 } },
      { userId: 'user-ok', _count: { id: 3 } },
    ]);

    // First findUnique call throws, second succeeds (null = no existing entry)
    mockStyleNarrativeFindUnique
      .mockRejectedValueOnce(new Error('DB blip'))
      .mockResolvedValueOnce(null);

    await expect(runStyleNarrativeAgent()).resolves.toBeUndefined();

    // user-ok should still have been attempted
    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(1);
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'style-narrative',
      'generate_narrative',
      'medium',
      expect.objectContaining({ userId: 'user-ok' }),
      expect.any(Function),
    );
  });

  it('passes outfitCount in the payload to executeOrQueue', async () => {
    mockGroupBy.mockResolvedValue([{ userId: 'user-1', _count: { id: 8 } }]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ outfitCount: 8 }),
      expect.any(Function),
    );
  });

  it('exactly 3 outfit checks qualifies as eligible (boundary check)', async () => {
    mockGroupBy.mockResolvedValue([{ userId: 'user-boundary', _count: { id: 3 } }]);

    await runStyleNarrativeAgent();

    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(1);
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ userId: 'user-boundary' }),
      expect.any(Function),
    );
  });
});
