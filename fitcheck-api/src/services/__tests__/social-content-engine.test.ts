import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockSocialPromptVariantFindFirst = vi.hoisted(() => vi.fn());
const mockSocialPostFindMany = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockOutfitCheckFindMany = vi.hoisted(() => vi.fn());
const mockOutfitCheckGroupBy = vi.hoisted(() => vi.fn());
const mockOutfitCheckCount = vi.hoisted(() => vi.fn());
const mockOutfitCheckAggregate = vi.hoisted(() => vi.fn());
const mockWardrobeItemCount = vi.hoisted(() => vi.fn());
const mockWardrobeItemFindFirst = vi.hoisted(() => vi.fn());
const mockWardrobeItemGroupBy = vi.hoisted(() => vi.fn());
const mockGetTrendData = vi.hoisted(() => vi.fn());
const mockGetFashionTrendText = vi.hoisted(() => vi.fn());
const mockGetGrowthSummary = vi.hoisted(() => vi.fn());
const mockGetAsoKeywordHint = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    socialPromptVariant: { findFirst: mockSocialPromptVariantFindFirst },
    socialPost: { findMany: mockSocialPostFindMany },
    styleDNA: { findMany: mockStyleDNAFindMany },
    outfitCheck: {
      findMany: mockOutfitCheckFindMany,
      groupBy: mockOutfitCheckGroupBy,
      count: mockOutfitCheckCount,
      aggregate: mockOutfitCheckAggregate,
    },
    wardrobeItem: {
      count: mockWardrobeItemCount,
      findFirst: mockWardrobeItemFindFirst,
      groupBy: mockWardrobeItemGroupBy,
    },
  },
}));

vi.mock('../content-calendar.service.js', () => ({
  getTrendData: mockGetTrendData,
}));

vi.mock('../fashion-trends.service.js', () => ({
  getLatestFashionTrendText: mockGetFashionTrendText,
}));

vi.mock('../growth-dashboard.service.js', () => ({
  getGrowthSummary: mockGetGrowthSummary,
}));

vi.mock('../aso-intelligence.service.js', () => ({
  getAsoKeywordHint: mockGetAsoKeywordHint,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  generateFounderStory,
  generateFashionNewsTake,
  generateCommunitySpotlight,
  generateStyleDataDrop,
  generateWardrobeInsight,
  generateConversationStarter,
  generateBehindTheScenes,
} from '../social-content-engine.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGeminiResponse(text: string) {
  return { response: { text: () => text } };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('GEMINI_API_KEY', 'gemini-key-test');

  // Default Gemini response
  mockGenerateContent.mockResolvedValue(
    makeGeminiResponse('Generated post content #fashion #style'),
  );

  // Default: no DB prompt variant
  mockSocialPromptVariantFindFirst.mockResolvedValue(null);

  // Default: no recent posts (dedup block)
  mockSocialPostFindMany.mockResolvedValue([]);

  // Default DB responses
  mockStyleDNAFindMany.mockResolvedValue([]);
  mockOutfitCheckFindMany.mockResolvedValue([]);
  mockOutfitCheckGroupBy.mockResolvedValue([]);
  mockOutfitCheckCount.mockResolvedValue(0);
  mockOutfitCheckAggregate.mockResolvedValue({
    _count: { id: 0 },
    _avg: { aiScore: null },
  });
  mockWardrobeItemCount.mockResolvedValue(0);
  mockWardrobeItemFindFirst.mockResolvedValue(null);
  mockWardrobeItemGroupBy.mockResolvedValue([]);

  // Default service mocks
  mockGetTrendData.mockResolvedValue({
    topStyles: ['minimalism', 'coastal'],
    popularOccasions: ['Work', 'Date Night'],
    colorTrends: ['black', 'cream'],
  });
  mockGetFashionTrendText.mockResolvedValue('Quiet luxury is trending');
  mockGetGrowthSummary.mockResolvedValue({
    totalUsers: 100,
    dau: 30,
    newSignups7d: 5,
  });
  mockGetAsoKeywordHint.mockResolvedValue('outfit feedback, AI stylist');

  // Default fetch: GitHub returns empty commits, RSS returns empty feed
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
    text: async () => '<rss><channel></channel></rss>',
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─── generateFounderStory ─────────────────────────────────────────────────────

describe('generateFounderStory', () => {
  it('returns GeneratedPost array with required fields when GitHub returns commits', async () => {
    // First fetch call = list commits; subsequent calls = commit detail + merged PRs + file content
    mockFetch
      .mockResolvedValueOnce({
        // fetchRecentCommits — list
        ok: true,
        json: async () => [
          {
            sha: 'abc1234',
            commit: {
              message: 'Add feature X: improve outfit scoring algorithm',
              author: { date: new Date().toISOString() },
            },
          },
        ],
        text: async () => '',
      })
      // fetchCommitDetail for sha abc1234
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc1234',
          commit: {
            message: 'Add feature X: improve outfit scoring algorithm',
            author: { date: new Date().toISOString() },
          },
          files: [{ filename: 'src/services/ai-feedback.service.ts' }],
          stats: { additions: 42, deletions: 10 },
        }),
        text: async () => '',
      })
      // fetchMergedPRs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        text: async () => '',
      })
      // fetchFileContent calls (KNOWN_MD_FILES rotation — 2 files)
      .mockResolvedValue({
        ok: false,
        json: async () => null,
        text: async () => '',
      });

    const result = await generateFounderStory();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const post = result[0];
    expect(post).toHaveProperty('platform');
    expect(post).toHaveProperty('content');
    expect(post).toHaveProperty('hashtags');
    expect(post).toHaveProperty('contentType');
    expect(['twitter', 'tiktok', 'pinterest']).toContain(post.platform);
    expect(typeof post.content).toBe('string');
    expect(Array.isArray(post.hashtags)).toBe(true);
    expect(post.contentType).toBe('founder_story');
  });

  it('returns empty array when GitHub fetch throws an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateFounderStory();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when GitHub returns ok: false', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
      json: async () => null,
    });

    const result = await generateFounderStory();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns post with platform twitter or tiktok', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            sha: 'def5678',
            commit: {
              message: 'Fix: resolve scoring edge case for casual outfits',
              author: { date: new Date().toISOString() },
            },
          },
        ],
        text: async () => '',
      })
      .mockResolvedValue({
        ok: false,
        json: async () => null,
        text: async () => '',
      });

    const result = await generateFounderStory();

    // May return 0 if build context degrades, but if posts come back they must be valid platforms
    for (const post of result) {
      expect(['twitter', 'tiktok', 'pinterest']).toContain(post.platform);
    }
  });
});

// ─── generateFashionNewsTake ──────────────────────────────────────────────────

describe('generateFashionNewsTake', () => {
  it('calls Gemini with fashion headline content and returns posts', async () => {
    const rssXml = `<rss><channel>
      <item>
        <title><![CDATA[Quiet Luxury Is Taking Over Street Style]]></title>
        <link>https://vogue.com/article/quiet-luxury</link>
      </item>
      <item>
        <title>Gen Z Embraces Thrifting Over Fast Fashion</title>
        <link>https://wwd.com/gen-z-thrift</link>
      </item>
    </channel></rss>`;

    // All 3 RSS feeds return the same XML for simplicity
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => rssXml,
      json: async () => [],
    });

    // First Gemini call = pick headline ("1"), second = tweet, third = tiktok
    mockGenerateContent
      .mockResolvedValueOnce(makeGeminiResponse('1'))
      .mockResolvedValueOnce(makeGeminiResponse('quiet luxury is everywhere and honestly I get it now'))
      .mockResolvedValueOnce(makeGeminiResponse('Hook: wait is quiet luxury actually just wearing beige?'));

    const result = await generateFashionNewsTake();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockGenerateContent).toHaveBeenCalled();

    const firstPost = result[0];
    expect(firstPost.contentType).toBe('fashion_news');
    expect(firstPost.content).toBeTruthy();
  });

  it('returns empty array when all RSS feeds return empty feeds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<rss><channel></channel></rss>',
      json: async () => [],
    });

    const result = await generateFashionNewsTake();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ─── generateCommunitySpotlight ───────────────────────────────────────────────

describe('generateCommunitySpotlight', () => {
  it('calls Gemini and returns posts when community data is available', async () => {
    // Provide meaningful data so the guard passes (totalChecks > 0)
    mockOutfitCheckAggregate.mockResolvedValue({
      _count: { id: 47 },
      _avg: { aiScore: 7.4 },
    });

    mockGetTrendData.mockResolvedValue({
      topStyles: ['minimalism', 'coastal', 'streetwear'],
      popularOccasions: ['Work', 'Date Night', 'Brunch'],
      colorTrends: ['black', 'cream', 'olive'],
    });

    const result = await generateCommunitySpotlight();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockGenerateContent).toHaveBeenCalled();

    const post = result[0];
    expect(post.contentType).toBe('community_spotlight');
    expect(post.platform).toBe('twitter');
    expect(typeof post.content).toBe('string');
    expect(Array.isArray(post.hashtags)).toBe(true);
  });

  it('returns empty array when there is no community data at all', async () => {
    // totalChecks = 0, topStyles = []
    mockOutfitCheckAggregate.mockResolvedValue({
      _count: { id: 0 },
      _avg: { aiScore: null },
    });
    mockGetTrendData.mockResolvedValue({
      topStyles: [],
      popularOccasions: [],
      colorTrends: [],
    });

    const result = await generateCommunitySpotlight();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('still returns posts when fashion trend text is unavailable but checks exist', async () => {
    mockOutfitCheckAggregate.mockResolvedValue({
      _count: { id: 20 },
      _avg: { aiScore: 6.8 },
    });
    mockGetFashionTrendText.mockRejectedValue(new Error('trend service down'));
    // topStyles empty but totalChecks > 0 — should still proceed
    mockGetTrendData.mockResolvedValue({
      topStyles: [],
      popularOccasions: [],
      colorTrends: [],
    });

    const result = await generateCommunitySpotlight();

    expect(Array.isArray(result)).toBe(true);
    // totalChecks=20, topStyles=[] → totalChecks > 0, so it should NOT return []
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── generateStyleDataDrop ────────────────────────────────────────────────────

describe('generateStyleDataDrop', () => {
  it('returns GeneratedPost array with Gemini content', async () => {
    mockOutfitCheckCount.mockResolvedValue(50);
    mockOutfitCheckFindMany.mockResolvedValue([
      { occasions: ['Work', 'Casual'], aiScore: 7.5 },
      { occasions: ['Work'], aiScore: 8.0 },
      { occasions: ['Date Night'], aiScore: 6.5 },
    ]);
    mockStyleDNAFindMany.mockResolvedValue([
      { colorHarmony: 'analogous', silhouetteType: 'fitted' },
      { colorHarmony: 'analogous', silhouetteType: 'relaxed' },
    ]);

    const result = await generateStyleDataDrop();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockGenerateContent).toHaveBeenCalled();

    const post = result[0];
    expect(post.contentType).toBe('style_data_drop');
    expect(post.platform).toBe('twitter');
  });

  it('calls Gemini with stats data including outfit count', async () => {
    mockOutfitCheckCount.mockResolvedValue(73);
    mockOutfitCheckFindMany.mockResolvedValue([
      { occasions: ['Brunch'], aiScore: 9.0 },
      { occasions: ['Brunch'], aiScore: 8.5 },
    ]);
    mockStyleDNAFindMany.mockResolvedValue([]);

    await generateStyleDataDrop();

    expect(mockGenerateContent).toHaveBeenCalled();
    const callArgs = mockGenerateContent.mock.calls[0][0] as string;
    expect(callArgs).toContain('73');
  });

  it('returns empty array when total checks is below minimum (< 5)', async () => {
    mockOutfitCheckCount.mockResolvedValue(3);
    mockOutfitCheckFindMany.mockResolvedValue([
      { occasions: ['Work'], aiScore: 7.0 },
    ]);
    mockStyleDNAFindMany.mockResolvedValue([]);

    const result = await generateStyleDataDrop();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ─── generateWardrobeInsight ──────────────────────────────────────────────────

describe('generateWardrobeInsight', () => {
  it('returns posts when wardrobe item data exists', async () => {
    mockWardrobeItemCount.mockResolvedValue(120);
    mockWardrobeItemGroupBy
      // categoryStats call (by: ['category'])
      .mockResolvedValueOnce([
        { category: 'tops', _count: { id: 50 } },
        { category: 'bottoms', _count: { id: 30 } },
      ])
      // colorStats call (by: ['color'])
      .mockResolvedValueOnce([
        { color: 'black', _count: { id: 40 } },
        { color: 'white', _count: { id: 25 } },
      ]);
    mockWardrobeItemFindFirst.mockResolvedValue({
      normalizedName: 'black t-shirt',
      name: 'Black Tee',
      category: 'tops',
      timesWorn: 47,
      color: 'black',
    });

    const result = await generateWardrobeInsight();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockGenerateContent).toHaveBeenCalled();

    const post = result[0];
    expect(post.contentType).toBe('wardrobe_insight');
    expect(post.platform).toBe('twitter');
  });

  it('returns empty array when total wardrobe items is below minimum (< 10)', async () => {
    mockWardrobeItemCount.mockResolvedValue(5);

    const result = await generateWardrobeInsight();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    // Should bail out early — no groupBy calls needed
    expect(mockWardrobeItemGroupBy).not.toHaveBeenCalled();
  });
});

// ─── generateConversationStarter ─────────────────────────────────────────────

describe('generateConversationStarter', () => {
  it('returns at least one post with content from Gemini', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse('honest question: do you dress for yourself or for the version of yourself you want others to see'),
    );

    const result = await generateConversationStarter();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const post = result[0];
    expect(post.content).toBeTruthy();
    expect(post.contentType).toBe('conversation_starter');
    expect(post.platform).toBe('twitter');
    expect(Array.isArray(post.hashtags)).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalled();
  });
});

// ─── generateBehindTheScenes ──────────────────────────────────────────────────

describe('generateBehindTheScenes', () => {
  it('calls getGrowthSummary and passes metrics data to Gemini', async () => {
    mockGetGrowthSummary.mockResolvedValue({
      totalUsers: 250,
      dau: 45,
      newSignups7d: 12,
    });

    // Stub fetch for buildBuildContext — return empty commits
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
    });

    await generateBehindTheScenes();

    expect(mockGetGrowthSummary).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();

    // The tweet prompt should mention user count from growth metrics
    const promptArg = mockGenerateContent.mock.calls[0][0] as string;
    expect(promptArg).toContain('250');
  });

  it('returns posts even when growth data has zero values', async () => {
    mockGetGrowthSummary.mockResolvedValue({
      totalUsers: 0,
      dau: 0,
      newSignups7d: 0,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
    });

    const result = await generateBehindTheScenes();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const post = result[0];
    expect(post.contentType).toBe('behind_the_scenes');
    expect(['twitter', 'tiktok']).toContain(post.platform);
  });

  it('still returns posts when getGrowthSummary rejects', async () => {
    mockGetGrowthSummary.mockRejectedValue(new Error('metrics service down'));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
    });

    const result = await generateBehindTheScenes();

    // Uses fallback minimal context — should still produce output
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Prompt variant injection ─────────────────────────────────────────────────

describe('prompt variant augmentation', () => {
  it('uses variant-augmented prompt when socialPromptVariant exists in DB', async () => {
    mockSocialPromptVariantFindFirst.mockResolvedValue({
      contentType: 'conversation_starter',
      promptText: 'Be more humorous and self-deprecating',
      isActive: true,
      createdAt: new Date(),
    });

    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse('unpopular opinion: wearing the same outfit twice is a power move'),
    );

    const result = await generateConversationStarter();

    expect(result.length).toBeGreaterThan(0);
    // The variant lookup must be called for this content type
    expect(mockSocialPromptVariantFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contentType: 'conversation_starter' }),
      }),
    );
    // Gemini must still be called — augmented prompt was built and passed through
    expect(mockGenerateContent).toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('generateConversationStarter propagates Gemini errors (no internal catch)', async () => {
    // The service does not wrap callGemini in try/catch, so errors propagate.
    mockGenerateContent.mockRejectedValue(new Error('Gemini timeout'));

    await expect(generateConversationStarter()).rejects.toThrow('Gemini timeout');
  });

  it('generateStyleDataDrop propagates Gemini error when count is sufficient', async () => {
    mockOutfitCheckCount.mockResolvedValue(50);
    mockOutfitCheckFindMany.mockResolvedValue([
      { occasions: ['Work'], aiScore: 7.0 },
    ]);
    mockStyleDNAFindMany.mockResolvedValue([]);
    // Gemini fails after the data guard passes
    mockGenerateContent.mockRejectedValue(new Error('Gemini timeout'));

    await expect(generateStyleDataDrop()).rejects.toThrow('Gemini timeout');
  });

  it('generateCommunitySpotlight resolves to defined even when getTrendData fails', async () => {
    mockOutfitCheckAggregate.mockResolvedValue({
      _count: { id: 30 },
      _avg: { aiScore: 7.0 },
    });
    mockGetTrendData.mockRejectedValue(new Error('trend service unavailable'));

    // Should fall back to empty trends — totalChecks > 0 so it should proceed and call Gemini
    await expect(generateCommunitySpotlight()).resolves.toBeDefined();
  });

  it('generateFashionNewsTake resolves to empty array when all RSS fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));

    const result = await generateFashionNewsTake();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});
