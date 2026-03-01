import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockOutfitCheckFindMany = vi.hoisted(() => vi.fn());
const mockCalibrationSnapshotUpsert = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: {
      findMany: mockOutfitCheckFindMany,
    },
    calibrationSnapshot: {
      upsert: mockCalibrationSnapshotUpsert,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runCalibrationSnapshot } from '../calibration-snapshot.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePairs(n: number, aiBase = 7.5, communityBase = 7.0) {
  return Array.from({ length: n }, (_, i) => ({
    aiScore: aiBase + (i % 3 - 1) * 0.5,
    communityAvgScore: communityBase + (i % 3 - 1) * 0.3,
  }));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockOutfitCheckFindMany.mockReset();
  mockCalibrationSnapshotUpsert.mockReset();
  mockPublishBus.mockReset();

  mockCalibrationSnapshotUpsert.mockResolvedValue({});
  mockPublishBus.mockResolvedValue('bus-entry-1');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─── runCalibrationSnapshot ───────────────────────────────────────────────────

describe('runCalibrationSnapshot — early return', () => {
  it('returns early without upserting when fewer than 10 valid pairs are available', async () => {
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(8));

    await runCalibrationSnapshot();

    expect(mockCalibrationSnapshotUpsert).not.toHaveBeenCalled();
  });
});

describe('runCalibrationSnapshot — upsert behaviour', () => {
  it('calls calibrationSnapshot.upsert when >= 10 valid pairs are available', async () => {
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(15));

    await runCalibrationSnapshot();

    expect(mockCalibrationSnapshotUpsert).toHaveBeenCalledTimes(1);
  });

  it('upserted data includes sampleSize, avgAiScore, avgCommunity, delta, correlation fields', async () => {
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(15));

    await runCalibrationSnapshot();

    const call = mockCalibrationSnapshotUpsert.mock.calls[0][0];
    const createData = call.create;

    expect(createData).toHaveProperty('sampleSize', 15);
    expect(createData).toHaveProperty('avgAiScore');
    expect(createData).toHaveProperty('avgCommunity');
    expect(createData).toHaveProperty('delta');
    expect(createData).toHaveProperty('correlation');
    expect(typeof createData.avgAiScore).toBe('number');
    expect(typeof createData.avgCommunity).toBe('number');
    expect(typeof createData.delta).toBe('number');
  });
});

describe('runCalibrationSnapshot — intelligence bus', () => {
  it('does NOT publish to bus when |delta| <= 0.5', async () => {
    // aiBase=7.0, communityBase=6.9 → delta ≈ 0.1 — well within threshold
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(12, 7.0, 6.9));

    await runCalibrationSnapshot();

    // publishToIntelligenceBus is called with .catch() — give microtasks a tick
    await Promise.resolve();

    expect(mockPublishBus).not.toHaveBeenCalled();
  });

  it('publishes to bus when |delta| > 0.5', async () => {
    // aiBase=8.0, communityBase=7.0 → delta = 1.0 — exceeds threshold
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(12, 8.0, 7.0));

    await runCalibrationSnapshot();

    // Give the .catch() promise chain a chance to resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'calibration-snapshot',
      'calibration_drift',
      expect.objectContaining({
        delta: expect.any(Number),
        avgAiScore: expect.any(Number),
        avgCommunity: expect.any(Number),
        sampleSize: expect.any(Number),
      }),
    );
  });
});

describe('runCalibrationSnapshot — error handling', () => {
  it('does not throw when prisma.outfitCheck.findMany fails', async () => {
    mockOutfitCheckFindMany.mockRejectedValue(new Error('DB connection lost'));

    await expect(runCalibrationSnapshot()).resolves.toBeUndefined();
  });

  it('does not throw when prisma.calibrationSnapshot.upsert fails', async () => {
    mockOutfitCheckFindMany.mockResolvedValue(makePairs(15));
    mockCalibrationSnapshotUpsert.mockRejectedValue(new Error('Upsert failed'));

    await expect(runCalibrationSnapshot()).resolves.toBeUndefined();
  });
});

describe('runCalibrationSnapshot — data filtering', () => {
  it('filters out pairs where communityAvgScore is null even when aiScore is present', async () => {
    const mixedData = [
      // 9 valid pairs
      ...makePairs(9, 7.5, 7.0),
      // 5 records with communityAvgScore = null — should be excluded
      ...Array.from({ length: 5 }, () => ({ aiScore: 8.0, communityAvgScore: null })),
    ];
    mockOutfitCheckFindMany.mockResolvedValue(mixedData);

    await runCalibrationSnapshot();

    // Only 9 valid pairs remain — below threshold of 10 → no upsert
    expect(mockCalibrationSnapshotUpsert).not.toHaveBeenCalled();
  });
});
