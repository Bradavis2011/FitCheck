import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockHasBudget = vi.hoisted(() => vi.fn());
const mockFeedbackFindMany = vi.hoisted(() => vi.fn());
const mockFeedbackUpdateMany = vi.hoisted(() => vi.fn());
const mockFeedbackCount = vi.hoisted(() => vi.fn());
const mockFeedbackFindFirst = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    userFeedback: {
      findMany: mockFeedbackFindMany,
      updateMany: mockFeedbackUpdateMany,
      count: mockFeedbackCount,
      findFirst: mockFeedbackFindFirst,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.mock('../token-budget.service.js', () => ({
  hasLearningBudget: mockHasBudget,
}));

import { runFeedbackAnalyst, getFeedbackSummary } from '../feedback-analyst.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGeminiResponse(json: object) {
  return { response: { text: () => JSON.stringify(json) } };
}

function makeFeedbackItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fb-${i}`,
    text: `Feedback item ${i + 1}`,
  }));
}

const DEFAULT_ANALYST_RESULT = {
  themes: [
    { theme: 'AI accuracy', count: 3, examples: ['item 1', 'item 2'] },
    { theme: 'Speed', count: 2, examples: ['item 3'] },
  ],
  criticalBugs: [],
  sentiment: 'positive' as const,
};

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockHasBudget.mockReset();
  mockFeedbackFindMany.mockReset();
  mockFeedbackUpdateMany.mockReset();
  mockFeedbackCount.mockReset();
  mockFeedbackFindFirst.mockReset();
  mockPublishBus.mockReset();
  mockEmailSend.mockReset();

  // Default: budget available
  mockHasBudget.mockResolvedValue(true);
  // Default: 10 open feedback items
  mockFeedbackFindMany.mockResolvedValue(makeFeedbackItems(10));
  // Default: Gemini returns clean result with no critical bugs
  mockGenerateContent.mockResolvedValue(makeGeminiResponse(DEFAULT_ANALYST_RESULT));
  // Default: DB operations succeed
  mockFeedbackUpdateMany.mockResolvedValue({ count: 10 });
  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
  mockFeedbackCount.mockResolvedValue(5);
  mockFeedbackFindFirst.mockResolvedValue(null);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runFeedbackAnalyst', () => {
  describe('early-exit guards', () => {
    it('skips analysis when fewer than 5 open items exist', async () => {
      mockFeedbackFindMany.mockResolvedValue(makeFeedbackItems(4));

      await runFeedbackAnalyst();

      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(mockPublishBus).not.toHaveBeenCalled();
    });

    it('skips analysis when there are exactly 0 open items', async () => {
      mockFeedbackFindMany.mockResolvedValue([]);

      await runFeedbackAnalyst();

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('skips analysis when the token budget is exhausted', async () => {
      mockHasBudget.mockResolvedValue(false);

      await runFeedbackAnalyst();

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('proceeds when there are exactly 5 open items', async () => {
      mockFeedbackFindMany.mockResolvedValue(makeFeedbackItems(5));

      await runFeedbackAnalyst();

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gemini integration', () => {
    it('calls generateContent with feedback item texts', async () => {
      const items = makeFeedbackItems(5);
      mockFeedbackFindMany.mockResolvedValue(items);

      await runFeedbackAnalyst();

      const prompt = mockGenerateContent.mock.calls[0][0] as string;
      items.forEach(item => {
        expect(prompt).toContain(item.text);
      });
    });

    it('returns without crashing when Gemini throws a network error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network error'));

      await expect(runFeedbackAnalyst()).resolves.toBeUndefined();

      // Should not publish or update since analysis failed
      expect(mockPublishBus).not.toHaveBeenCalled();
    });

    it('returns without crashing when Gemini returns non-JSON text', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Sorry, I cannot analyse this.' },
      });

      await expect(runFeedbackAnalyst()).resolves.toBeUndefined();

      expect(mockPublishBus).not.toHaveBeenCalled();
    });

    it('extracts JSON object even when wrapped in extra text', async () => {
      const json = JSON.stringify(DEFAULT_ANALYST_RESULT);
      mockGenerateContent.mockResolvedValue({
        response: { text: () => `Sure! Here is the result:\n${json}\nDone.` },
      });

      await runFeedbackAnalyst();

      expect(mockPublishBus).toHaveBeenCalled();
    });
  });

  describe('post-analysis actions', () => {
    it('marks analysed items as reviewed with the detected sentiment', async () => {
      const items = makeFeedbackItems(7);
      mockFeedbackFindMany.mockResolvedValue(items);
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({ ...DEFAULT_ANALYST_RESULT, sentiment: 'negative' }),
      );

      await runFeedbackAnalyst();

      expect(mockFeedbackUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'reviewed', sentiment: 'negative' }),
        }),
      );
    });

    it('updates the correct item IDs in the updateMany call', async () => {
      const items = makeFeedbackItems(5);
      mockFeedbackFindMany.mockResolvedValue(items);

      await runFeedbackAnalyst();

      const updateCall = mockFeedbackUpdateMany.mock.calls[0][0];
      const updatedIds = updateCall.where.id.in;
      expect(updatedIds).toEqual(items.map(i => i.id));
    });

    it('publishes product_feedback to the intelligence bus', async () => {
      await runFeedbackAnalyst();

      expect(mockPublishBus).toHaveBeenCalledWith(
        'feedback-analyst',
        'product_feedback',
        expect.objectContaining({
          themes: DEFAULT_ANALYST_RESULT.themes,
          sentiment: 'positive',
          itemsAnalysed: expect.any(Number),
        }),
      );
    });

    it('includes criticalBugsCount in the bus payload', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({
          ...DEFAULT_ANALYST_RESULT,
          criticalBugs: ['App crashes on launch', 'Login loop'],
        }),
      );

      await runFeedbackAnalyst();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.criticalBugsCount).toBe(2);
    });
  });

  describe('critical bug email', () => {
    it('sends an alert email when critical bugs are found', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_key');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({
          ...DEFAULT_ANALYST_RESULT,
          criticalBugs: ['App crashes on startup'],
        }),
      );

      await runFeedbackAnalyst();

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      vi.unstubAllEnvs();
    });

    it('does not send email when there are no critical bugs', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_key');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

      await runFeedbackAnalyst();

      expect(mockEmailSend).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('does not send email when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({
          ...DEFAULT_ANALYST_RESULT,
          criticalBugs: ['Critical crash'],
        }),
      );

      await runFeedbackAnalyst();

      expect(mockEmailSend).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('does not send email when REPORT_RECIPIENT_EMAIL is missing', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_key');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({
          ...DEFAULT_ANALYST_RESULT,
          criticalBugs: ['Critical crash'],
        }),
      );

      await runFeedbackAnalyst();

      expect(mockEmailSend).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('still publishes to bus even when email sending fails', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_key');
      vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({
          ...DEFAULT_ANALYST_RESULT,
          criticalBugs: ['Bug'],
        }),
      );
      mockEmailSend.mockRejectedValue(new Error('Email service down'));

      await expect(runFeedbackAnalyst()).resolves.toBeUndefined();

      expect(mockPublishBus).toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });

  describe('DB error resilience', () => {
    it('returns without crashing when updateMany fails', async () => {
      mockFeedbackUpdateMany.mockRejectedValue(new Error('DB error'));

      await expect(runFeedbackAnalyst()).resolves.toBeUndefined();
    });

    it('still publishes to bus even when updateMany fails', async () => {
      mockFeedbackUpdateMany.mockRejectedValue(new Error('DB error'));

      await runFeedbackAnalyst();

      expect(mockPublishBus).toHaveBeenCalled();
    });
  });
});

describe('getFeedbackSummary', () => {
  it('returns the current open feedback count', async () => {
    mockFeedbackCount.mockResolvedValue(12);
    mockFeedbackFindFirst.mockResolvedValue(null);

    const result = await getFeedbackSummary();

    expect(result.openCount).toBe(12);
  });

  it('returns the most recent reviewed sentiment', async () => {
    mockFeedbackCount.mockResolvedValue(3);
    mockFeedbackFindFirst.mockResolvedValue({ sentiment: 'negative' });

    const result = await getFeedbackSummary();

    expect(result.sentiment).toBe('negative');
  });

  it('returns null sentiment when no reviewed items exist', async () => {
    mockFeedbackCount.mockResolvedValue(0);
    mockFeedbackFindFirst.mockResolvedValue(null);

    const result = await getFeedbackSummary();

    expect(result.sentiment).toBeNull();
  });
});
