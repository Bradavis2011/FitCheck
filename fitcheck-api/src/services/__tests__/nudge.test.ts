import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockNudgeVariantFindMany = vi.hoisted(() => vi.fn());
const mockNudgeVariantUpdate = vi.hoisted(() => vi.fn());
const mockNudgeVariantUpdateMany = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockOutfitCheckFindFirst = vi.hoisted(() => vi.fn());
const mockOutfitCheckFindMany = vi.hoisted(() => vi.fn());
const mockOutfitCheckGroupBy = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockUserStatsFindMany = vi.hoisted(() => vi.fn());
const mockSendPush = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    nudgeVariant: {
      findMany: mockNudgeVariantFindMany,
      update: mockNudgeVariantUpdate,
      updateMany: mockNudgeVariantUpdateMany,
    },
    notification: {
      findFirst: mockNotificationFindFirst,
      create: mockNotificationCreate,
      findMany: mockNotificationFindMany,
    },
    outfitCheck: {
      findFirst: mockOutfitCheckFindFirst,
      findMany: mockOutfitCheckFindMany,
      groupBy: mockOutfitCheckGroupBy,
    },
    user: {
      findMany: mockUserFindMany,
      update: mockUserUpdate,
    },
    userStats: {
      findMany: mockUserStatsFindMany,
    },
  },
}));

vi.mock('../push.service.js', () => ({
  pushService: {
    sendPushNotification: mockSendPush,
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  measureNudgeMetrics,
  promoteNudgeWinners,
  runEngagementNudger,
  computePreferredNudgeHours,
  runPersonalizedNudge,
} from '../nudge.service.js';

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  mockNudgeVariantFindMany.mockReset();
  mockNudgeVariantUpdate.mockReset();
  mockNudgeVariantUpdateMany.mockReset();
  mockNotificationFindFirst.mockReset();
  mockNotificationCreate.mockReset();
  mockNotificationFindMany.mockReset();
  mockOutfitCheckFindFirst.mockReset();
  mockOutfitCheckFindMany.mockReset();
  mockOutfitCheckGroupBy.mockReset();
  mockUserFindMany.mockReset();
  mockUserUpdate.mockReset();
  mockUserStatsFindMany.mockReset();
  mockSendPush.mockReset();
  mockPublishBus.mockReset();

  // Sensible defaults — no variants, no users, no notifications
  mockNudgeVariantFindMany.mockResolvedValue([]);
  mockNudgeVariantUpdate.mockResolvedValue({ id: 'v-1' });
  mockNudgeVariantUpdateMany.mockResolvedValue({ count: 0 });
  mockNotificationFindFirst.mockResolvedValue(null); // no nudge today → eligible to send
  mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });
  mockNotificationFindMany.mockResolvedValue([]); // no recent nudges for conversion tracking
  mockOutfitCheckFindFirst.mockResolvedValue(null);
  mockOutfitCheckFindMany.mockResolvedValue([]);
  mockOutfitCheckGroupBy.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
  mockUserUpdate.mockResolvedValue({ id: 'u-1' });
  mockUserStatsFindMany.mockResolvedValue([]);
  mockSendPush.mockResolvedValue(undefined);
  mockPublishBus.mockResolvedValue(undefined);
});

// ─── measureNudgeMetrics ──────────────────────────────────────────────────────

describe('measureNudgeMetrics', () => {
  it('calls nudgeVariant.findMany once per segment (4 segments → 4 calls)', async () => {
    await measureNudgeMetrics();

    expect(mockNudgeVariantFindMany).toHaveBeenCalledTimes(4);
    const segments = mockNudgeVariantFindMany.mock.calls.map((c) => c[0].where.segment);
    expect(segments).toContain('new_no_outfit');
    expect(segments).toContain('inactive_3d');
    expect(segments).toContain('streak_risk');
    expect(segments).toContain('churning_paid');
  });

  it('publishes to intelligence bus with nudge_metrics type', async () => {
    await measureNudgeMetrics();

    expect(mockPublishBus).toHaveBeenCalledOnce();
    expect(mockPublishBus).toHaveBeenCalledWith(
      'nudge',
      'nudge_metrics',
      expect.objectContaining({
        measuredAt: expect.any(String),
        segments: expect.any(Object),
        worstSegment: null,
      }),
    );
  });

  it('calculates rate correctly: 10 conversions / 100 impressions = 0.1', async () => {
    // Return variants only for new_no_outfit, empty for the rest
    mockNudgeVariantFindMany
      .mockResolvedValueOnce([{ impressions: 100, conversions: 10 }]) // new_no_outfit
      .mockResolvedValueOnce([]) // inactive_3d
      .mockResolvedValueOnce([]) // streak_risk
      .mockResolvedValueOnce([]); // churning_paid

    await measureNudgeMetrics();

    const publishedPayload = mockPublishBus.mock.calls[0][2];
    expect(publishedPayload.segments.new_no_outfit.rate).toBe(0.1);
    expect(publishedPayload.segments.new_no_outfit.impressions).toBe(100);
    expect(publishedPayload.segments.new_no_outfit.conversions).toBe(10);
  });

  it('worstSegment is null when no segment has >= 10 impressions', async () => {
    // All segments have fewer than 10 impressions
    mockNudgeVariantFindMany
      .mockResolvedValueOnce([{ impressions: 5, conversions: 1 }])  // new_no_outfit
      .mockResolvedValueOnce([{ impressions: 3, conversions: 0 }])  // inactive_3d
      .mockResolvedValueOnce([{ impressions: 2, conversions: 0 }])  // streak_risk
      .mockResolvedValueOnce([{ impressions: 9, conversions: 2 }]); // churning_paid

    await measureNudgeMetrics();

    const publishedPayload = mockPublishBus.mock.calls[0][2];
    expect(publishedPayload.worstSegment).toBeNull();
  });

  it('worstSegment is the segment with lowest rate when multiple have >= 10 impressions', async () => {
    mockNudgeVariantFindMany
      .mockResolvedValueOnce([{ impressions: 100, conversions: 20 }]) // new_no_outfit → rate 0.2
      .mockResolvedValueOnce([{ impressions: 50, conversions: 2 }])  // inactive_3d → rate 0.04 ← worst
      .mockResolvedValueOnce([{ impressions: 30, conversions: 6 }])  // streak_risk → rate 0.2
      .mockResolvedValueOnce([{ impressions: 20, conversions: 5 }]); // churning_paid → rate 0.25

    await measureNudgeMetrics();

    const publishedPayload = mockPublishBus.mock.calls[0][2];
    expect(publishedPayload.worstSegment).toBe('inactive_3d');
  });
});

// ─── promoteNudgeWinners ──────────────────────────────────────────────────────

describe('promoteNudgeWinners', () => {
  it('skips segment if fewer than 2 variants are found', async () => {
    // Only 1 variant per segment — not enough to compare
    mockNudgeVariantFindMany.mockResolvedValue([
      { id: 'v-1', impressions: 50, conversions: 10, isActive: true, title: 'Control', body: 'Body' },
    ]);

    await promoteNudgeWinners();

    expect(mockNudgeVariantUpdate).not.toHaveBeenCalled();
  });

  it('skips if fewer than 2 variants have >= 20 impressions', async () => {
    // 2 variants but only 1 has >= 20 impressions
    mockNudgeVariantFindMany.mockResolvedValue([
      { id: 'v-1', impressions: 25, conversions: 5, isActive: true, title: 'A', body: 'B' },
      { id: 'v-2', impressions: 10, conversions: 2, isActive: true, title: 'C', body: 'D' }, // below min
    ]);

    await promoteNudgeWinners();

    expect(mockNudgeVariantUpdate).not.toHaveBeenCalled();
  });

  it('retires non-winner variants when 2+ variants have >= 20 impressions', async () => {
    // v-1 has better rate (0.4) than v-2 (0.1) — v-1 wins, v-2 is retired
    mockNudgeVariantFindMany.mockResolvedValue([
      { id: 'v-1', impressions: 25, conversions: 10, isActive: true, title: 'Winner', body: 'Body' },
      { id: 'v-2', impressions: 20, conversions: 2, isActive: true, title: 'Loser', body: 'Body' },
    ]);

    await promoteNudgeWinners();

    // v-2 should be retired — nudgeVariant.update called with isActive: false
    expect(mockNudgeVariantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-2' },
        data: { isActive: false },
      }),
    );
  });

  it('does NOT retire the winner variant', async () => {
    // v-1 wins (rate 0.4 > 0.1)
    mockNudgeVariantFindMany.mockResolvedValue([
      { id: 'v-1', impressions: 25, conversions: 10, isActive: true, title: 'Winner', body: 'Body' },
      { id: 'v-2', impressions: 20, conversions: 2, isActive: true, title: 'Loser', body: 'Body' },
    ]);

    await promoteNudgeWinners();

    const retiredIds = mockNudgeVariantUpdate.mock.calls.map((c) => c[0].where.id);
    expect(retiredIds).not.toContain('v-1');
  });
});

// ─── runEngagementNudger ──────────────────────────────────────────────────────

describe('runEngagementNudger', () => {
  it('morning run: does NOT call userStats.findMany (segment 3 streak_risk skipped)', async () => {
    await runEngagementNudger(false); // morning run

    expect(mockUserStatsFindMany).not.toHaveBeenCalled();
  });

  it('evening run: calls userStats.findMany for streak-at-risk segment', async () => {
    await runEngagementNudger(true); // evening run

    expect(mockUserStatsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currentStreak: { gt: 0 } }),
      }),
    );
  });

  it('sends nudge for eligible user during evening run (streak at risk)', async () => {
    // User has a streak and has NOT checked in today
    mockUserStatsFindMany.mockResolvedValue([
      { userId: 'user-streak', currentStreak: 5 },
    ]);
    // checkedToday: empty — user has not checked in today
    mockOutfitCheckFindMany.mockResolvedValue([]);
    // No nudge received today
    mockNotificationFindFirst.mockResolvedValue(null);

    await runEngagementNudger(true);

    expect(mockSendPush).toHaveBeenCalledWith(
      'user-streak',
      expect.objectContaining({
        title: expect.any(String),
        body: expect.any(String),
      }),
    );
  });

  it('does not send nudge if user already has a nudge_push notification today', async () => {
    // User has a streak and has NOT checked in today
    mockUserStatsFindMany.mockResolvedValue([
      { userId: 'user-already-nudged', currentStreak: 3 },
    ]);
    mockOutfitCheckFindMany.mockResolvedValue([]); // not checked today
    // But they already received a nudge today
    mockNotificationFindFirst.mockResolvedValue({ id: 'existing-nudge-notif' });

    await runEngagementNudger(true);

    expect(mockSendPush).not.toHaveBeenCalled();
  });
});
