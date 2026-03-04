import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockHasBudget = vi.hoisted(() => vi.fn());
const mockReserveTokens = vi.hoisted(() => vi.fn());
const mockRecordTokenUsage = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockBlogDraftFindUnique = vi.hoisted(() => vi.fn());
const mockBlogDraftCreate = vi.hoisted(() => vi.fn());
const mockBlogDraftCount = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockGetTrendData = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    outfitCheck: { findMany: mockOutfitFindMany },
    blogDraft: {
      findUnique: mockBlogDraftFindUnique,
      create: mockBlogDraftCreate,
      count: mockBlogDraftCount,
    },
  },
}));

vi.mock('../token-budget.service.js', () => ({
  hasLearningBudget: mockHasBudget,
  reserveTokens: mockReserveTokens,
  recordTokenUsage: mockRecordTokenUsage,
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.mock('../content-calendar.service.js', () => ({
  getTrendData: mockGetTrendData,
}));

import { runSeoContentAgent, getSeoSummary } from '../seo-content.service.js';

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_BLOG = {
  title: 'What to Wear to Work in 2026',
  content: '## Introduction\nFashion advice here.',
  metaDescription: 'A guide to work outfits for 2026',
  ogTitle: 'Work Outfit Guide 2026',
};

function makeGeminiResponse(json: object) {
  return {
    response: {
      text: () => JSON.stringify(json),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 1000 },
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockHasBudget.mockReset();
  mockReserveTokens.mockReset();
  mockRecordTokenUsage.mockReset();
  mockOutfitFindMany.mockReset();
  mockBlogDraftFindUnique.mockReset();
  mockBlogDraftCreate.mockReset();
  mockBlogDraftCount.mockReset();
  mockExecuteOrQueue.mockReset();
  mockPublishBus.mockReset();
  mockGetTrendData.mockReset();

  // Defaults
  mockHasBudget.mockResolvedValue(true);
  mockReserveTokens.mockResolvedValue(true);
  mockRecordTokenUsage.mockResolvedValue(undefined);
  mockOutfitFindMany.mockResolvedValue([]); // no occasion data → fallback to hardcoded
  mockBlogDraftFindUnique.mockResolvedValue(null); // slug is unique
  mockBlogDraftCreate.mockResolvedValue({ id: 'draft-1' });
  mockBlogDraftCount.mockResolvedValue(3);
  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockPublishBus.mockResolvedValue(undefined);
  mockGetTrendData.mockResolvedValue({ topStyles: ['minimalist', 'boho'], trends: [] });
  mockGenerateContent.mockResolvedValue(makeGeminiResponse(SAMPLE_BLOG));

  vi.stubEnv('GEMINI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runSeoContentAgent', () => {
  describe('budget guard', () => {
    it('returns early without calling Gemini when hasLearningBudget(4) returns false', async () => {
      mockHasBudget.mockResolvedValue(false);

      await runSeoContentAgent();

      expect(mockHasBudget).toHaveBeenCalledWith(4);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('does not create any DB records when budget is insufficient', async () => {
      mockHasBudget.mockResolvedValue(false);

      await runSeoContentAgent();

      expect(mockBlogDraftCreate).not.toHaveBeenCalled();
    });

    it('does not publish to intelligence bus when budget is insufficient', async () => {
      mockHasBudget.mockResolvedValue(false);

      await runSeoContentAgent();

      expect(mockPublishBus).not.toHaveBeenCalled();
    });
  });

  describe('data fetching', () => {
    it('calls getTrendData when budget is OK', async () => {
      await runSeoContentAgent();

      expect(mockGetTrendData).toHaveBeenCalledTimes(1);
    });

    it('calls outfitCheck.findMany when budget is OK', async () => {
      await runSeoContentAgent();

      expect(mockOutfitFindMany).toHaveBeenCalledTimes(1);
    });

    it('fetches top occasions with isDeleted: false and 30-day window', async () => {
      await runSeoContentAgent();

      const call = mockOutfitFindMany.mock.calls[0][0];
      expect(call.where.isDeleted).toBe(false);
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.select).toEqual({ occasions: true });
      expect(call.take).toBe(200);
    });
  });

  describe('fallback occasions', () => {
    it('uses hardcoded occasions when outfitCheck.findMany returns empty array', async () => {
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      // Should still generate 3 topics using hardcoded fallback occasions
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('uses "Work" as topOccasion when no occasion data exists', async () => {
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      const firstPrompt = mockGenerateContent.mock.calls[0][0] as string;
      expect(firstPrompt).toContain('Work');
    });

    it('uses "Casual Friday" as evergreen topic when no occasion data exists', async () => {
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      const thirdPrompt = mockGenerateContent.mock.calls[2][0] as string;
      expect(thirdPrompt).toContain('Casual Friday');
    });

    it('uses occasion data from DB when outfitCheck.findMany returns results', async () => {
      mockOutfitFindMany.mockResolvedValue([
        { occasions: ['Date Night', 'Wedding'] },
        { occasions: ['Date Night'] },
        { occasions: ['Wedding'] },
      ]);

      await runSeoContentAgent();

      // topOccasion should be 'Date Night' (2 occurrences vs 2 for Wedding — Date Night appears first)
      const firstPrompt = mockGenerateContent.mock.calls[0][0] as string;
      expect(firstPrompt).toContain('Date Night');
    });
  });

  describe('topic generation', () => {
    it('generates exactly 3 blog post topics', async () => {
      await runSeoContentAgent();

      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('generates an occasion-guide topic using topOccasion', async () => {
      mockGetTrendData.mockResolvedValue({ topStyles: ['minimalist'], trends: [] });
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      const firstPrompt = mockGenerateContent.mock.calls[0][0] as string;
      expect(firstPrompt).toContain('occasion-guide');
      expect(firstPrompt).toContain('What to wear to Work');
    });

    it('generates a trend-guide topic using topTrend', async () => {
      mockGetTrendData.mockResolvedValue({ topStyles: ['minimalist', 'boho'], trends: [] });

      await runSeoContentAgent();

      const secondPrompt = mockGenerateContent.mock.calls[1][0] as string;
      expect(secondPrompt).toContain('trend-guide');
      expect(secondPrompt).toContain('minimalist');
    });

    it('generates an evergreen topic using the second occasion', async () => {
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      const thirdPrompt = mockGenerateContent.mock.calls[2][0] as string;
      expect(thirdPrompt).toContain('evergreen');
      expect(thirdPrompt).toContain('Casual Friday');
    });

    it('uses "minimalist" as topTrend fallback when topStyles is empty', async () => {
      mockGetTrendData.mockResolvedValue({ topStyles: [], trends: [] });

      await runSeoContentAgent();

      const secondPrompt = mockGenerateContent.mock.calls[1][0] as string;
      expect(secondPrompt).toContain('minimalist');
    });
  });

  describe('blog draft creation', () => {
    it('calls blogDraft.findUnique to check slug uniqueness for each topic', async () => {
      await runSeoContentAgent();

      // 3 topics → 3 slug checks
      expect(mockBlogDraftFindUnique).toHaveBeenCalledTimes(3);
    });

    it('calls blogDraft.create for each generated topic', async () => {
      await runSeoContentAgent();

      expect(mockBlogDraftCreate).toHaveBeenCalledTimes(3);
    });

    it('creates drafts with status: pending_review', async () => {
      await runSeoContentAgent();

      for (const call of mockBlogDraftCreate.mock.calls) {
        expect(call[0].data.status).toBe('pending_review');
      }
    });

    it('creates drafts with the correct title from Gemini response', async () => {
      await runSeoContentAgent();

      expect(mockBlogDraftCreate.mock.calls[0][0].data.title).toBe(SAMPLE_BLOG.title);
    });

    it('creates drafts with metaDescription truncated to 160 chars', async () => {
      const longMeta = 'A'.repeat(200);
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse({ ...SAMPLE_BLOG, metaDescription: longMeta }),
      );

      await runSeoContentAgent();

      expect(mockBlogDraftCreate.mock.calls[0][0].data.metaDescription.length).toBeLessThanOrEqual(160);
    });

    it('includes topic and category in sourceData', async () => {
      await runSeoContentAgent();

      const sourceData = mockBlogDraftCreate.mock.calls[0][0].data.sourceData;
      expect(sourceData).toHaveProperty('topic');
      expect(sourceData).toHaveProperty('category');
      expect(sourceData).toHaveProperty('generatedAt');
    });

    it('calls executeOrQueue with medium risk level for each created draft', async () => {
      await runSeoContentAgent();

      expect(mockExecuteOrQueue).toHaveBeenCalledTimes(3);
      for (const call of mockExecuteOrQueue.mock.calls) {
        expect(call[2]).toBe('medium');
      }
    });

    it('calls executeOrQueue with correct agent name and action type', async () => {
      await runSeoContentAgent();

      expect(mockExecuteOrQueue).toHaveBeenCalledWith(
        'seo-content',
        'publish_draft',
        'medium',
        expect.objectContaining({ blogDraftId: 'draft-1' }),
        expect.any(Function),
        expect.any(String),
      );
    });
  });

  describe('slug deduplication', () => {
    it('appends -1 suffix when slug already exists', async () => {
      // First call finds existing slug, second call finds it's free
      mockBlogDraftFindUnique
        .mockResolvedValueOnce({ id: 'existing-draft' }) // slug taken
        .mockResolvedValueOnce(null)                      // slug + '-1' is free
        .mockResolvedValue(null);                         // remaining topics are free

      await runSeoContentAgent();

      const firstCreateCall = mockBlogDraftCreate.mock.calls[0][0];
      expect(firstCreateCall.data.slug).toMatch(/-1$/);
    });

    it('uses the base slug when no conflict exists', async () => {
      mockBlogDraftFindUnique.mockResolvedValue(null); // all slugs free

      await runSeoContentAgent();

      // The slug should be the slugified title without any suffix
      const expectedSlug = SAMPLE_BLOG.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);

      expect(mockBlogDraftCreate.mock.calls[0][0].data.slug).toBe(expectedSlug);
    });
  });

  describe('invalid Gemini JSON', () => {
    it('skips a topic gracefully when Gemini returns invalid JSON', async () => {
      // First topic: invalid JSON; second and third: valid
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            text: () => 'Not valid JSON at all',
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
          },
        })
        .mockResolvedValue(makeGeminiResponse(SAMPLE_BLOG));

      await runSeoContentAgent();

      // Only 2 of 3 topics should produce drafts
      expect(mockBlogDraftCreate).toHaveBeenCalledTimes(2);
    });

    it('still processes remaining topics when one has invalid JSON', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            text: () => 'Bad JSON',
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
          },
        })
        .mockResolvedValue(makeGeminiResponse(SAMPLE_BLOG));

      await runSeoContentAgent();

      // Remaining 2 topics still call executeOrQueue
      expect(mockExecuteOrQueue).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all topics return invalid JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Not JSON',
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
        },
      });

      await expect(runSeoContentAgent()).resolves.toBeUndefined();
    });

    it('publishes seo_metrics with draftsCreated: 0 when all topics fail', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Not JSON',
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
        },
      });

      await runSeoContentAgent();

      expect(mockPublishBus).toHaveBeenCalledWith(
        'seo-content',
        'seo_metrics',
        expect.objectContaining({ draftsCreated: 0 }),
      );
    });
  });

  describe('reserveTokens failure', () => {
    it('skips a topic when reserveTokens returns false', async () => {
      // First topic: reservation fails; second and third: succeed
      mockReserveTokens
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      await runSeoContentAgent();

      // Only 2 of 3 topics generate content (Gemini not called for the failed one)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockBlogDraftCreate).toHaveBeenCalledTimes(2);
    });

    it('continues processing other topics when one reserveTokens fails', async () => {
      mockReserveTokens
        .mockResolvedValueOnce(false)  // topic 1 fails
        .mockResolvedValueOnce(true)   // topic 2 succeeds
        .mockResolvedValueOnce(true);  // topic 3 succeeds

      await runSeoContentAgent();

      expect(mockExecuteOrQueue).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all reserveTokens calls fail', async () => {
      mockReserveTokens.mockResolvedValue(false);

      await expect(runSeoContentAgent()).resolves.toBeUndefined();
    });
  });

  describe('seo_metrics bus publish', () => {
    it('publishes seo_metrics to the intelligence bus', async () => {
      await runSeoContentAgent();

      expect(mockPublishBus).toHaveBeenCalledWith(
        'seo-content',
        'seo_metrics',
        expect.objectContaining({
          draftsCreated: expect.any(Number),
          topics: expect.any(Array),
        }),
      );
    });

    it('includes correct draftsCreated count in metrics', async () => {
      await runSeoContentAgent();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.draftsCreated).toBe(3);
    });

    it('includes created topic titles in metrics', async () => {
      await runSeoContentAgent();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.topics).toHaveLength(3);
      expect(payload.topics[0]).toBe(SAMPLE_BLOG.title);
    });

    it('includes topOccasion in metrics payload', async () => {
      mockOutfitFindMany.mockResolvedValue([]);

      await runSeoContentAgent();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.topOccasion).toBe('Work');
    });

    it('includes topTrend in metrics payload', async () => {
      mockGetTrendData.mockResolvedValue({ topStyles: ['minimalist'], trends: [] });

      await runSeoContentAgent();

      const payload = mockPublishBus.mock.calls[0][2];
      expect(payload.topTrend).toBe('minimalist');
    });

    it('does not throw when bus publish fails', async () => {
      mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

      await expect(runSeoContentAgent()).resolves.toBeUndefined();
    });

    it('still completes draft creation even when bus publish fails', async () => {
      mockPublishBus.mockRejectedValue(new Error('Bus unavailable'));

      await runSeoContentAgent();

      expect(mockBlogDraftCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Gemini throws an error', () => {
    it('skips the topic and continues when Gemini throws', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Gemini network error'))
        .mockResolvedValue(makeGeminiResponse(SAMPLE_BLOG));

      await runSeoContentAgent();

      expect(mockBlogDraftCreate).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all Gemini calls fail', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini down'));

      await expect(runSeoContentAgent()).resolves.toBeUndefined();
    });

    it('records zero actual tokens when Gemini throws', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Gemini error'));
      mockGenerateContent.mockResolvedValue(makeGeminiResponse(SAMPLE_BLOG));

      await runSeoContentAgent();

      // First call to recordTokenUsage (for the failed topic) should use 0 actual tokens
      expect(mockRecordTokenUsage).toHaveBeenCalledWith(2000, 0, 'seo_content');
    });
  });

  describe('token usage recording', () => {
    it('calls recordTokenUsage for each topic that was reserved', async () => {
      await runSeoContentAgent();

      // 3 topics, each calls recordTokenUsage once
      expect(mockRecordTokenUsage).toHaveBeenCalledTimes(3);
    });

    it('records the correct actual token count from usageMetadata', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(SAMPLE_BLOG),
          usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 1000 },
        },
      });

      await runSeoContentAgent();

      // actual = 500 + 1000 = 1500
      expect(mockRecordTokenUsage).toHaveBeenCalledWith(2000, 1500, 'seo_content');
    });
  });
});

// ─── getSeoSummary ────────────────────────────────────────────────────────────

describe('getSeoSummary', () => {
  it('returns pendingDrafts and publishedDrafts counts', async () => {
    mockBlogDraftCount.mockResolvedValueOnce(7).mockResolvedValueOnce(12);

    const result = await getSeoSummary();

    expect(result).toEqual({ pendingDrafts: 7, publishedDrafts: 12 });
  });

  it('queries pending_review and published counts', async () => {
    await getSeoSummary();

    expect(mockBlogDraftCount).toHaveBeenCalledWith({ where: { status: 'pending_review' } });
    expect(mockBlogDraftCount).toHaveBeenCalledWith({ where: { status: 'published' } });
  });

  it('returns zeros when count returns 0', async () => {
    mockBlogDraftCount.mockResolvedValue(0);

    const result = await getSeoSummary();

    expect(result).toEqual({ pendingDrafts: 0, publishedDrafts: 0 });
  });

  it('returns default mock value for both counts', async () => {
    // mockBlogDraftCount defaults to 3 in beforeEach
    const result = await getSeoSummary();

    expect(result.pendingDrafts).toBe(3);
    expect(result.publishedDrafts).toBe(3);
  });
});
