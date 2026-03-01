import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDailyFindUnique = vi.hoisted(() => vi.fn());
const mockDailyFindMany = vi.hoisted(() => vi.fn());
const mockDailyCreate = vi.hoisted(() => vi.fn());
const mockDailyUpdate = vi.hoisted(() => vi.fn());
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    dailyTokenUsage: {
      findUnique: mockDailyFindUnique,
      findMany: mockDailyFindMany,
      create: mockDailyCreate,
      update: mockDailyUpdate,
    },
  },
}));

import {
  hasLearningBudget,
  reserveTokens,
  recordTokenUsage,
  trackedGenerateContent,
  recordUserTokens,
  getTodayUsage,
  resetDailyBudget,
} from '../token-budget.service.js';

// Default record returned by findUnique in most tests:
// totalUsed = userTokens + learningTokens + reservedTokens = 50000 + 100000 + 10000 = 160000
// hardCap = budget * 1.05 = 500000 * 1.05 = 525000
const DEFAULT_RECORD = {
  date: '2026-03-01',
  budget: 500000,
  learningBudget: 300000,
  userTokens: 50000,
  learningTokens: 100000,
  reservedTokens: 10000,
  breakdown: {},
};

beforeEach(() => {
  mockDailyFindUnique.mockReset();
  mockDailyFindMany.mockReset();
  mockDailyCreate.mockReset();
  mockDailyUpdate.mockReset();
  mockGenerateContent.mockReset();

  // Use mockImplementation to return a fresh deep copy each call, preventing
  // in-place mutation of DEFAULT_RECORD.breakdown from bleeding between tests.
  mockDailyFindUnique.mockImplementation(() =>
    Promise.resolve(JSON.parse(JSON.stringify(DEFAULT_RECORD))),
  );
  mockDailyFindMany.mockResolvedValue([]);
  mockDailyCreate.mockResolvedValue({ date: '2026-03-01', budget: 500000, learningBudget: 375000 });
  mockDailyUpdate.mockResolvedValue({});

  vi.stubEnv('ENABLE_LEARNING_SYSTEM', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── hasLearningBudget ────────────────────────────────────────────────────────

describe('hasLearningBudget', () => {
  it('returns false when ENABLE_LEARNING_SYSTEM=false', async () => {
    vi.stubEnv('ENABLE_LEARNING_SYSTEM', 'false');
    const result = await hasLearningBudget(1);
    expect(result).toBe(false);
  });

  it('returns true for priority 1 when learningBudget is 0', async () => {
    // P1 threshold = 0, so any learningBudget (even 0) satisfies it
    mockDailyFindUnique.mockResolvedValue({ ...DEFAULT_RECORD, learningBudget: 0 });
    const result = await hasLearningBudget(1);
    expect(result).toBe(true);
  });

  it('returns true for priority 2 when learningBudget >= 100000', async () => {
    mockDailyFindUnique.mockResolvedValue({ ...DEFAULT_RECORD, learningBudget: 100000 });
    const result = await hasLearningBudget(2);
    expect(result).toBe(true);
  });

  it('returns false for priority 2 when learningBudget < 100000', async () => {
    mockDailyFindUnique.mockResolvedValue({ ...DEFAULT_RECORD, learningBudget: 80000 });
    const result = await hasLearningBudget(2);
    expect(result).toBe(false);
  });

  it('returns true for priority 4 when learningBudget >= 250000', async () => {
    mockDailyFindUnique.mockResolvedValue({ ...DEFAULT_RECORD, learningBudget: 250000 });
    const result = await hasLearningBudget(4);
    expect(result).toBe(true);
  });

  it('returns false for priority 5 when learningBudget < 350000', async () => {
    mockDailyFindUnique.mockResolvedValue({ ...DEFAULT_RECORD, learningBudget: 300000 });
    const result = await hasLearningBudget(5);
    expect(result).toBe(false);
  });

  it('returns true for priority 1 on DB failure (fail-safe)', async () => {
    mockDailyFindUnique.mockRejectedValue(new Error('DB connection failed'));
    const result = await hasLearningBudget(1);
    expect(result).toBe(true);
  });

  it('returns false for priority 2 on DB failure (fail-safe)', async () => {
    mockDailyFindUnique.mockRejectedValue(new Error('DB connection failed'));
    const result = await hasLearningBudget(2);
    expect(result).toBe(false);
  });
});

// ─── reserveTokens ────────────────────────────────────────────────────────────

describe('reserveTokens', () => {
  it('returns true when estimated + totalUsed is within hard cap (budget * 1.05)', async () => {
    // totalUsed = 160000, estimated = 100000 → 260000 < 525000 → allowed
    const result = await reserveTokens(100000, 'test_category');
    expect(result).toBe(true);
  });

  it('returns false when estimated + totalUsed exceeds hard cap for learning calls', async () => {
    // totalUsed = 160000, estimated = 400000 → 560000 > 525000 → blocked
    const result = await reserveTokens(400000, 'test_category');
    expect(result).toBe(false);
  });

  it('returns true for user calls (isUserCall=true) even when over hard cap', async () => {
    // totalUsed = 160000, estimated = 400000 → would exceed cap but user calls bypass
    const result = await reserveTokens(400000, 'outfit_analysis', true);
    expect(result).toBe(true);
  });

  it('calls dailyTokenUsage.update with { reservedTokens: { increment: estimated } }', async () => {
    await reserveTokens(5000, 'style_trends');
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reservedTokens: { increment: 5000 } },
      }),
    );
  });

  it('returns true for user calls even when DB update fails', async () => {
    mockDailyUpdate.mockRejectedValue(new Error('DB write failed'));
    const result = await reserveTokens(10000, 'outfit_analysis', true);
    expect(result).toBe(true);
  });

  it('returns false for learning calls when DB update fails', async () => {
    mockDailyUpdate.mockRejectedValue(new Error('DB write failed'));
    const result = await reserveTokens(10000, 'style_trends', false);
    expect(result).toBe(false);
  });
});

// ─── recordTokenUsage ─────────────────────────────────────────────────────────

describe('recordTokenUsage', () => {
  it('updates learningTokens for non-user calls', async () => {
    await recordTokenUsage(5000, 3000, 'style_analysis');
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learningTokens: { increment: 3000 },
        }),
      }),
    );
  });

  it('updates userTokens for user calls (isUserCall=true)', async () => {
    await recordTokenUsage(5000, 3000, 'outfit_analysis', true);
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userTokens: { increment: 3000 },
        }),
      }),
    );
  });

  it('decrements reservedTokens by the estimate', async () => {
    await recordTokenUsage(5000, 3000, 'style_analysis');
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservedTokens: { decrement: 5000 },
        }),
      }),
    );
  });

  it('updates breakdown with category and actual tokens', async () => {
    // DEFAULT_RECORD.breakdown is {} so the category entry will be 0 + 3000 = 3000
    await recordTokenUsage(5000, 3000, 'style_analysis');
    const callArgs = mockDailyUpdate.mock.calls[0][0];
    expect(callArgs.data.breakdown['style_analysis']).toBe(3000);
  });

  it('does not throw when DB update fails', async () => {
    mockDailyUpdate.mockRejectedValue(new Error('DB write failed'));
    await expect(recordTokenUsage(5000, 3000, 'style_analysis')).resolves.toBeUndefined();
  });
});

// ─── trackedGenerateContent ───────────────────────────────────────────────────

describe('trackedGenerateContent', () => {
  it('returns null when reserveTokens returns false (budget exhausted)', async () => {
    // Set usage so high that any estimate pushes past the hard cap
    mockDailyFindUnique.mockResolvedValue({
      ...DEFAULT_RECORD,
      userTokens: 300000,
      learningTokens: 200000,
      reservedTokens: 30000,
      // totalUsed = 530000 > hardCap 525000, so even a small estimate overflows
    });

    const fakeModel = { generateContent: mockGenerateContent } as any;
    const result = await trackedGenerateContent(fakeModel, 'test prompt', 1000, 'style_trends');

    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('calls generateContent and returns { text, inputTokens, outputTokens } on success', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Great outfit!',
        usageMetadata: {
          promptTokenCount: 600,
          candidatesTokenCount: 400,
        },
      },
    });

    const fakeModel = { generateContent: mockGenerateContent } as any;
    const result = await trackedGenerateContent(fakeModel, 'test prompt', 1000, 'style_trends');

    expect(mockGenerateContent).toHaveBeenCalledWith('test prompt');
    expect(result).toEqual({ text: 'Great outfit!', inputTokens: 600, outputTokens: 400 });
  });

  it('uses usageMetadata when available for token counts', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Looks good!',
        usageMetadata: {
          promptTokenCount: 750,
          candidatesTokenCount: 250,
        },
      },
    });

    const fakeModel = { generateContent: mockGenerateContent } as any;
    const result = await trackedGenerateContent(fakeModel, 'prompt', 1000, 'trend_analysis');

    expect(result?.inputTokens).toBe(750);
    expect(result?.outputTokens).toBe(250);
  });

  it('falls back to estimated breakdown when usageMetadata is absent', async () => {
    // estimated = 1000 → inputTokens = floor(1000 * 0.6) = 600, outputTokens = floor(1000 * 0.4) = 400
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Nice look!',
        usageMetadata: undefined,
      },
    });

    const fakeModel = { generateContent: mockGenerateContent } as any;
    const result = await trackedGenerateContent(fakeModel, 'prompt', 1000, 'trend_analysis');

    expect(result?.inputTokens).toBe(600);
    expect(result?.outputTokens).toBe(400);
  });

  it('calls recordTokenUsage with actual tokens on success', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Stylish!',
        usageMetadata: {
          promptTokenCount: 300,
          candidatesTokenCount: 200,
        },
      },
    });

    const fakeModel = { generateContent: mockGenerateContent } as any;
    await trackedGenerateContent(fakeModel, 'prompt', 500, 'trend_analysis');

    // recordTokenUsage calls findUnique (for breakdown) then update
    // The update should include the actual total (300 + 200 = 500) as a learningTokens increment
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learningTokens: { increment: 500 },
          reservedTokens: { decrement: 500 },
        }),
      }),
    );
  });

  it('calls recordTokenUsage with 0 tokens on Gemini failure, then rethrows', async () => {
    const geminiError = new Error('Gemini API timeout');
    mockGenerateContent.mockRejectedValue(geminiError);

    const fakeModel = { generateContent: mockGenerateContent } as any;

    await expect(
      trackedGenerateContent(fakeModel, 'prompt', 500, 'trend_analysis'),
    ).rejects.toThrow('Gemini API timeout');

    // Should have called update with 0 actual tokens (learningTokens increment 0)
    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learningTokens: { increment: 0 },
          reservedTokens: { decrement: 500 },
        }),
      }),
    );
  });
});

// ─── recordUserTokens ─────────────────────────────────────────────────────────

describe('recordUserTokens', () => {
  it('calls recordTokenUsage with isUserCall=true and correct total', async () => {
    // recordUserTokens(100, 200) → recordTokenUsage(0, 300, 'outfit_analysis', true)
    // → update with { userTokens: { increment: 300 }, reservedTokens: { decrement: 0 } }
    await recordUserTokens(100, 200);

    expect(mockDailyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userTokens: { increment: 300 },
          reservedTokens: { decrement: 0 },
        }),
      }),
    );
  });
});

// ─── getTodayUsage ────────────────────────────────────────────────────────────

describe('getTodayUsage', () => {
  it('returns the existing daily record', async () => {
    const result = await getTodayUsage();
    expect(result).toEqual(DEFAULT_RECORD);
  });

  it('creates a new record when none exists for today', async () => {
    mockDailyFindUnique.mockResolvedValue(null);
    await getTodayUsage();
    expect(mockDailyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ budget: 500000 }),
      }),
    );
  });
});

// ─── resetDailyBudget ─────────────────────────────────────────────────────────

describe('resetDailyBudget', () => {
  it('ensures today\'s record exists without throwing', async () => {
    await expect(resetDailyBudget()).resolves.toBeUndefined();
    expect(mockDailyFindUnique).toHaveBeenCalled();
  });

  it('creates a new record if none exists', async () => {
    mockDailyFindUnique.mockResolvedValue(null);
    await resetDailyBudget();
    expect(mockDailyCreate).toHaveBeenCalled();
  });
});
