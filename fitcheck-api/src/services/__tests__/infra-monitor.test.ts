import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockAgentActionCount = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    agentAction: { count: mockAgentActionCount },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

import { runInfraMonitor, getInfraSummary } from '../infra-monitor.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockAgentActionCount.mockReset();
  mockPublishBus.mockReset();

  mockAgentActionCount.mockResolvedValue(2);
  mockPublishBus.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runInfraMonitor', () => {
  it('publishes infra_metrics to the intelligence bus', async () => {
    await runInfraMonitor();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'infra-monitor',
      'infra_metrics',
      expect.objectContaining({
        heapUsedMB: expect.any(Number),
        heapTotalMB: expect.any(Number),
        heapUsedPct: expect.any(Number),
        failedActionsLastHour: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('includes the failed agent action count in the payload', async () => {
    mockAgentActionCount.mockResolvedValue(7);

    await runInfraMonitor();

    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.failedActionsLastHour).toBe(7);
  });

  it('queries failed actions in the last hour', async () => {
    await runInfraMonitor();

    const where = mockAgentActionCount.mock.calls[0][0].where;
    expect(where.status).toBe('failed');
    expect(where.createdAt.gte).toBeInstanceOf(Date);

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const diff = Math.abs(where.createdAt.gte.getTime() - oneHourAgo);
    expect(diff).toBeLessThan(2000); // within 2 seconds
  });

  it('still publishes when the agentAction count query fails', async () => {
    mockAgentActionCount.mockRejectedValue(new Error('DB unavailable'));

    await runInfraMonitor();

    // failedActionsLastHour defaults to 0 on error
    const payload = mockPublishBus.mock.calls[0][2];
    expect(payload.failedActionsLastHour).toBe(0);
  });

  it('resolves without throwing when bus publish fails', async () => {
    mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

    await expect(runInfraMonitor()).resolves.toBeUndefined();
  });
});

describe('getInfraSummary', () => {
  it('returns heapUsedPct and failedActionsLastHour', async () => {
    mockAgentActionCount.mockResolvedValue(5);

    const result = await getInfraSummary();

    expect(result.heapUsedPct).toBeGreaterThan(0);
    expect(result.heapUsedPct).toBeLessThanOrEqual(1);
    expect(result.failedActionsLastHour).toBe(5);
  });

  it('returns failedActionsLastHour=0 when DB query fails', async () => {
    mockAgentActionCount.mockRejectedValue(new Error('DB error'));

    const result = await getInfraSummary();

    expect(result.failedActionsLastHour).toBe(0);
  });

  it('heapUsedPct is between 0 and 1 (ratio, not percentage)', async () => {
    mockAgentActionCount.mockResolvedValue(0);

    const result = await getInfraSummary();

    expect(result.heapUsedPct).toBeGreaterThan(0);
    expect(result.heapUsedPct).toBeLessThanOrEqual(1);
  });
});
