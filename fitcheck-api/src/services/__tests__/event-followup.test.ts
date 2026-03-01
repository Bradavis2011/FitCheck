import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockNotificationCount = vi.hoisted(() => vi.fn());
const mockEventFollowUpCreate = vi.hoisted(() => vi.fn());
const mockEventFollowUpUpdateMany = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    notification: { count: mockNotificationCount },
    eventFollowUp: {
      create: mockEventFollowUpCreate,
      updateMany: mockEventFollowUpUpdateMany,
    },
  },
}));

import {
  generateFollowUpToken,
  canSendRelationshipNotification,
  scheduleFollowUp,
  recordFollowUpResponse,
} from '../event-followup.service.js';

beforeEach(() => {
  mockNotificationCount.mockReset();
  mockEventFollowUpCreate.mockReset();
  mockEventFollowUpUpdateMany.mockReset();
  delete process.env.FOLLOW_UP_HMAC_SECRET;
});

afterEach(() => {
  delete process.env.FOLLOW_UP_HMAC_SECRET;
});

// ─── generateFollowUpToken ────────────────────────────────────────────────────

describe('generateFollowUpToken', () => {
  it('returns empty string when FOLLOW_UP_HMAC_SECRET is not set', () => {
    expect(generateFollowUpToken('id-1', 'crushed_it')).toBe('');
  });

  it('returns a non-empty hex string when secret is set', () => {
    process.env.FOLLOW_UP_HMAC_SECRET = 'test-secret';
    const token = generateFollowUpToken('id-1', 'crushed_it');
    expect(token).toMatch(/^[0-9a-f]{64}$/); // SHA256 = 64 hex chars
  });

  it('is deterministic — same inputs produce same token', () => {
    process.env.FOLLOW_UP_HMAC_SECRET = 'test-secret';
    const t1 = generateFollowUpToken('id-1', 'felt_good');
    const t2 = generateFollowUpToken('id-1', 'felt_good');
    expect(t1).toBe(t2);
  });

  it('produces different tokens for different responses', () => {
    process.env.FOLLOW_UP_HMAC_SECRET = 'test-secret';
    const t1 = generateFollowUpToken('id-1', 'crushed_it');
    const t2 = generateFollowUpToken('id-1', 'not_great');
    expect(t1).not.toBe(t2);
  });
});

// ─── canSendRelationshipNotification ─────────────────────────────────────────

describe('canSendRelationshipNotification', () => {
  it('returns true when fewer than 3 relationship notifications were sent today', async () => {
    mockNotificationCount.mockResolvedValue(2);
    expect(await canSendRelationshipNotification('user-1')).toBe(true);
  });

  it('returns false when 3 or more were sent today', async () => {
    mockNotificationCount.mockResolvedValue(3);
    expect(await canSendRelationshipNotification('user-1')).toBe(false);
  });

  it('returns true when zero were sent today', async () => {
    mockNotificationCount.mockResolvedValue(0);
    expect(await canSendRelationshipNotification('user-1')).toBe(true);
  });

  it('queries only event_followup, style_narrative, and milestone types', async () => {
    mockNotificationCount.mockResolvedValue(0);
    await canSendRelationshipNotification('user-1');
    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ['event_followup', 'style_narrative', 'milestone'] },
        }),
      }),
    );
  });
});

// ─── scheduleFollowUp ─────────────────────────────────────────────────────────

describe('scheduleFollowUp', () => {
  it('does nothing when occasion list has no event occasions', async () => {
    await scheduleFollowUp('outfit-1', 'user-1', ['casual', 'work']);
    expect(mockEventFollowUpCreate).not.toHaveBeenCalled();
  });

  it('creates a follow-up for a recognized event occasion (Date Night)', async () => {
    mockEventFollowUpCreate.mockResolvedValue({});
    const futureEventDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    await scheduleFollowUp('outfit-1', 'user-1', ['casual', 'Date Night'], futureEventDate);

    expect(mockEventFollowUpCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outfitCheckId: 'outfit-1',
          userId: 'user-1',
          occasion: 'Date Night',
          eventDate: futureEventDate,
        }),
      }),
    );
  });

  it('picks the first matching occasion when multiple event occasions are provided', async () => {
    mockEventFollowUpCreate.mockResolvedValue({});
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await scheduleFollowUp('outfit-1', 'user-1', ['Interview', 'Date Night'], futureDate);

    const created = mockEventFollowUpCreate.mock.calls[0][0].data;
    expect(created.occasion).toBe('Interview');
  });

  it('schedules followUpAt for 9am UTC the day after eventDate', async () => {
    mockEventFollowUpCreate.mockResolvedValue({});
    const eventDate = new Date('2026-05-10T14:00:00Z'); // afternoon

    await scheduleFollowUp('outfit-1', 'user-1', ['Date Night'], eventDate);

    const { followUpAt } = mockEventFollowUpCreate.mock.calls[0][0].data;
    expect(followUpAt.getUTCDate()).toBe(11);     // day after May 10
    expect(followUpAt.getUTCHours()).toBe(9);      // 9am UTC
    expect(followUpAt.getUTCMinutes()).toBe(0);
  });

  it('advances to next 9am UTC when calculated time is already in the past', async () => {
    mockEventFollowUpCreate.mockResolvedValue({});
    // Pass a past event date — follow-up time will be in the past
    const pastEventDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    await scheduleFollowUp('outfit-1', 'user-1', ['Date Night'], pastEventDate);

    const { followUpAt } = mockEventFollowUpCreate.mock.calls[0][0].data;
    expect(followUpAt.getTime()).toBeGreaterThan(Date.now());
    expect(followUpAt.getUTCHours()).toBe(9);
  });
});

// ─── recordFollowUpResponse ───────────────────────────────────────────────────

describe('recordFollowUpResponse', () => {
  it('throws when response value is not one of the four valid options', async () => {
    await expect(recordFollowUpResponse('fu-1', 'user-1', 'amazing')).rejects.toThrow('Invalid response value');
  });

  it('throws AppError(404) when no follow-up matches the id+userId pair', async () => {
    mockEventFollowUpUpdateMany.mockResolvedValue({ count: 0 });
    await expect(recordFollowUpResponse('fu-missing', 'user-1', 'crushed_it')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Follow-up not found or unauthorized',
    });
  });

  it('marks follow-up as completed for a valid response', async () => {
    mockEventFollowUpUpdateMany.mockResolvedValue({ count: 1 });

    await expect(recordFollowUpResponse('fu-1', 'user-1', 'felt_good')).resolves.toBeUndefined();

    expect(mockEventFollowUpUpdateMany).toHaveBeenCalledWith({
      where: { id: 'fu-1', userId: 'user-1' },
      data: expect.objectContaining({ response: 'felt_good', status: 'completed' }),
    });
  });

  it('accepts all four valid response values', async () => {
    mockEventFollowUpUpdateMany.mockResolvedValue({ count: 1 });
    const valid = ['crushed_it', 'felt_good', 'meh', 'not_great'];
    for (const v of valid) {
      await expect(recordFollowUpResponse('fu-1', 'user-1', v)).resolves.toBeUndefined();
    }
  });
});
