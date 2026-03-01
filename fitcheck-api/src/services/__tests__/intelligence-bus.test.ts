import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockBusCreate = vi.hoisted(() => vi.fn());
const mockBusFindMany = vi.hoisted(() => vi.fn());
const mockBusFindFirst = vi.hoisted(() => vi.fn());
const mockBusUpdate = vi.hoisted(() => vi.fn());
const mockBusDeleteMany = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    intelligenceBusEntry: {
      create: mockBusCreate,
      findMany: mockBusFindMany,
      findFirst: mockBusFindFirst,
      update: mockBusUpdate,
      deleteMany: mockBusDeleteMany,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  publishToIntelligenceBus,
  readFromIntelligenceBus,
  purgeExpiredBusEntries,
  getLatestBusEntry,
} from '../intelligence-bus.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockBusCreate.mockReset();
  mockBusFindMany.mockReset();
  mockBusFindFirst.mockReset();
  mockBusUpdate.mockReset();
  mockBusDeleteMany.mockReset();

  mockBusCreate.mockResolvedValue({ id: 'entry-1' });
  mockBusFindMany.mockResolvedValue([]);
  mockBusFindFirst.mockResolvedValue(null);
  mockBusUpdate.mockResolvedValue({});
  mockBusDeleteMany.mockResolvedValue({ count: 0 });
});

// ─── publishToIntelligenceBus ─────────────────────────────────────────────────

describe('publishToIntelligenceBus', () => {
  it('returns the created entry id', async () => {
    mockBusCreate.mockResolvedValue({ id: 'entry-42' });

    const result = await publishToIntelligenceBus('agent-x', 'trend_signal', { key: 'val' });

    expect(result).toBe('entry-42');
  });

  it('calls create with correct agent, entryType, and payload', async () => {
    const payload = { score: 9, trend: 'coral' };

    await publishToIntelligenceBus('content-calendar', 'trend_signal', payload);

    expect(mockBusCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agent: 'content-calendar',
          entryType: 'trend_signal',
          payload,
        }),
      }),
    );
  });

  it('sets expiresAt approximately 14 days in the future', async () => {
    const before = Date.now();

    await publishToIntelligenceBus('nudger', 'nudge_metrics', {});

    const call = mockBusCreate.mock.calls[0][0];
    const expiresAt: Date = call.data.expiresAt;

    expect(expiresAt).toBeInstanceOf(Date);
    // Must be at least 13 days from now (allowing for test execution time)
    const thirteenDaysMs = 13 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(before + thirteenDaysMs);
  });
});

// ─── readFromIntelligenceBus ──────────────────────────────────────────────────

describe('readFromIntelligenceBus', () => {
  it('returns mapped array with id, agent, payload, and createdAt', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    mockBusFindMany.mockResolvedValue([
      { id: 'e-1', agent: 'agent-a', payload: { x: 1 }, createdAt },
    ]);

    const result = await readFromIntelligenceBus('consumer-1', 'email_metrics');

    expect(result).toEqual([
      { id: 'e-1', agent: 'agent-a', payload: { x: 1 }, createdAt },
    ]);
  });

  it('includes consumedBy filter when unreadOnly is true', async () => {
    await readFromIntelligenceBus('consumer-1', 'nudge_metrics', { unreadOnly: true });

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consumedBy: { not: { has: 'consumer-1' } },
        }),
      }),
    );
  });

  it('marks each entry consumed when unreadOnly is true and entries are returned', async () => {
    const createdAt = new Date();
    mockBusFindMany.mockResolvedValue([
      { id: 'e-1', agent: 'a', payload: {}, createdAt },
      { id: 'e-2', agent: 'b', payload: {}, createdAt },
    ]);

    await readFromIntelligenceBus('consumer-X', 'email_metrics', { unreadOnly: true });

    expect(mockBusUpdate).toHaveBeenCalledTimes(2);
    expect(mockBusUpdate).toHaveBeenCalledWith({
      where: { id: 'e-1' },
      data: { consumedBy: { push: 'consumer-X' } },
    });
    expect(mockBusUpdate).toHaveBeenCalledWith({
      where: { id: 'e-2' },
      data: { consumedBy: { push: 'consumer-X' } },
    });
  });

  it('does NOT call update when unreadOnly is false', async () => {
    mockBusFindMany.mockResolvedValue([
      { id: 'e-1', agent: 'a', payload: {}, createdAt: new Date() },
    ]);

    await readFromIntelligenceBus('consumer-1', 'email_metrics', { unreadOnly: false });

    expect(mockBusUpdate).not.toHaveBeenCalled();
  });

  it('does NOT call update when unreadOnly is true but no entries are found', async () => {
    mockBusFindMany.mockResolvedValue([]);

    await readFromIntelligenceBus('consumer-1', 'email_metrics', { unreadOnly: true });

    expect(mockBusUpdate).not.toHaveBeenCalled();
  });

  it('respects the limit option (take: N)', async () => {
    await readFromIntelligenceBus('consumer-1', 'social_metrics', { limit: 5 });

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('defaults to take: 50 when no limit is provided', async () => {
    await readFromIntelligenceBus('consumer-1', 'social_metrics');

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('respects the sinceDate option (createdAt gte filter)', async () => {
    const since = new Date('2026-01-15T00:00:00Z');

    await readFromIntelligenceBus('consumer-1', 'ops_critique', { sinceDate: since });

    expect(mockBusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: since },
        }),
      }),
    );
  });
});

// ─── purgeExpiredBusEntries ───────────────────────────────────────────────────

describe('purgeExpiredBusEntries', () => {
  it('calls deleteMany with expiresAt lt current time', async () => {
    const before = Date.now();

    await purgeExpiredBusEntries();

    const call = mockBusDeleteMany.mock.calls[0][0];
    const lt: Date = call.where.expiresAt.lt;

    expect(lt).toBeInstanceOf(Date);
    expect(lt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('returns the count of deleted entries', async () => {
    mockBusDeleteMany.mockResolvedValue({ count: 7 });

    const result = await purgeExpiredBusEntries();

    expect(result).toBe(7);
  });

  it('returns 0 when no expired entries exist', async () => {
    mockBusDeleteMany.mockResolvedValue({ count: 0 });

    const result = await purgeExpiredBusEntries();

    expect(result).toBe(0);
  });
});

// ─── getLatestBusEntry ────────────────────────────────────────────────────────

describe('getLatestBusEntry', () => {
  it('returns null when no entry is found', async () => {
    mockBusFindFirst.mockResolvedValue(null);

    const result = await getLatestBusEntry('calibration_drift');

    expect(result).toBeNull();
  });

  it('returns payload and createdAt when an entry is found', async () => {
    const createdAt = new Date('2026-02-10T08:00:00Z');
    mockBusFindFirst.mockResolvedValue({
      id: 'e-99',
      entryType: 'calibration_drift',
      payload: { drift: 0.12 },
      createdAt,
      expiresAt: new Date(Date.now() + 1000000),
    });

    const result = await getLatestBusEntry('calibration_drift');

    expect(result).toEqual({ payload: { drift: 0.12 }, createdAt });
  });

  it('queries with the correct entryType filter and descending createdAt order', async () => {
    await getLatestBusEntry('token_usage');

    expect(mockBusFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entryType: 'token_usage' }),
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('queries only non-expired entries (expiresAt gt now)', async () => {
    await getLatestBusEntry('brand_guard_metrics');

    const call = mockBusFindFirst.mock.calls[0][0];
    const gt: Date = call.where.expiresAt.gt;

    expect(gt).toBeInstanceOf(Date);
    // The gt value should be approximately now (within a few seconds)
    expect(gt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
