import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockSocialPostFindUnique = vi.hoisted(() => vi.fn());
const mockSocialPostCreate = vi.hoisted(() => vi.fn());
const mockSocialPostUpdate = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockRegisterExecutor = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    socialPost: {
      findUnique: mockSocialPostFindUnique,
      create: mockSocialPostCreate,
      update: mockSocialPostUpdate,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
    // Additional tables queried by social content generators
    wardrobeItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        agent: 'social-media-manager',
        enabled: true,
        maxActionsPerDay: 50,
        maxActionsPerHour: 10,
        autoApproveRisk: 'medium',
      }),
    },
    agentAction: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'action-1' }),
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
  registerExecutor: mockRegisterExecutor,
}));

// Mock the social content engine — all 7 generators return a single test post
vi.mock('../social-content-engine.service.js', () => ({
  generateFounderStory: vi.fn().mockResolvedValue([
    { text: 'Great outfit!', hashtags: ['fashion'], platform: 'twitter', contentType: 'founder_story', content: 'Great outfit!' },
  ]),
  generateFashionNewsTake: vi.fn().mockResolvedValue([
    { text: 'Fashion news', hashtags: ['style'], platform: 'twitter', contentType: 'fashion_news', content: 'Fashion news' },
  ]),
  generateCommunitySpotlight: vi.fn().mockResolvedValue([
    { text: 'Community', hashtags: ['community'], platform: 'twitter', contentType: 'community_spotlight', content: 'Community' },
  ]),
  generateStyleDataDrop: vi.fn().mockResolvedValue([
    { text: 'Style data', hashtags: ['data'], platform: 'twitter', contentType: 'style_data', content: 'Style data' },
  ]),
  generateConversationStarter: vi.fn().mockResolvedValue([
    { text: 'Question?', hashtags: ['fashion'], platform: 'twitter', contentType: 'conversation_starter', content: 'Question?' },
  ]),
  generateWardrobeInsight: vi.fn().mockResolvedValue([
    { text: 'Wardrobe tip', hashtags: ['wardrobe'], platform: 'twitter', contentType: 'wardrobe_insight', content: 'Wardrobe tip' },
  ]),
  generateBehindTheScenes: vi.fn().mockResolvedValue([
    { text: 'Behind scenes', hashtags: ['bts'], platform: 'twitter', contentType: 'behind_the_scenes', content: 'Behind scenes' },
  ]),
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { postToInstagram, runSocialMediaManager } from '../social-media-manager.service.js';

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockSocialPostFindUnique.mockReset();
  mockSocialPostCreate.mockReset();
  mockSocialPostUpdate.mockReset();
  mockOutfitFindMany.mockReset();
  mockUserFindMany.mockReset();
  mockStyleDNAFindMany.mockReset();
  mockExecuteOrQueue.mockReset();
  mockRegisterExecutor.mockReset();
  mockFetch.mockReset();

  mockGenerateContent.mockResolvedValue({
    response: {
      text: () =>
        JSON.stringify([
          { text: 'Great outfit!', hashtags: ['fashion'], platform: 'twitter', contentType: 'tip' },
        ]),
    },
  });
  mockSocialPostFindUnique.mockResolvedValue({
    id: 'sp-1',
    content: 'Great outfit!',
    hashtags: ['fashion'],
    status: 'pending',
    trackingUrl: null,
  });
  mockSocialPostCreate.mockResolvedValue({ id: 'sp-1' });
  mockSocialPostUpdate.mockResolvedValue({});
  mockOutfitFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
  mockStyleDNAFindMany.mockResolvedValue([]);
  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockRegisterExecutor.mockReturnValue(undefined);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'ig-container-1' }),
  });

  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── postToInstagram ──────────────────────────────────────────────────────────

describe('postToInstagram', () => {
  it('returns { posted: false, error: "..." } when INSTAGRAM_ACCESS_TOKEN is not set', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', '');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');

    const result = await postToInstagram('sp-1');

    expect(result.posted).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns { posted: false, error: "..." } when INSTAGRAM_BUSINESS_ACCOUNT_ID is not set', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', '');

    const result = await postToInstagram('sp-1');

    expect(result.posted).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns { posted: false, error: "Post not found" } when socialPost is not in DB', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue(null);

    const result = await postToInstagram('sp-missing');

    expect(result.posted).toBe(false);
    expect(result.error).toBe('Post not found');
  });

  it('returns { posted: false, error: "Instagram posts require a public image URL" } when trackingUrl is not http', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue({
      id: 'sp-1',
      content: 'Great outfit!',
      hashtags: ['fashion'],
      status: 'pending',
      trackingUrl: null, // empty string after || ''  → does not start with 'http'
    });

    const result = await postToInstagram('sp-1');

    expect(result.posted).toBe(false);
    expect(result.error).toBe('Instagram posts require a public image URL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('makes two fetch calls (create container + publish) when post has a valid image URL', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue({
      id: 'sp-1',
      content: 'Great outfit!',
      hashtags: ['fashion'],
      status: 'pending',
      trackingUrl: 'https://orthis.app?utm_source=twitter',
    });
    // First call: create container → returns container id
    // Second call: publish → returns published id
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-published-1' }) });

    await postToInstagram('sp-1');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns { posted: true, postId: ... } when both fetch calls succeed', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue({
      id: 'sp-1',
      content: 'Great outfit!',
      hashtags: ['fashion'],
      status: 'pending',
      trackingUrl: 'https://orthis.app?utm_source=twitter',
    });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-published-1' }) });

    const result = await postToInstagram('sp-1');

    expect(result.posted).toBe(true);
    expect(result.postId).toBe('ig-published-1');
  });

  it('returns { posted: false, error: ... } when create container response has no id', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue({
      id: 'sp-1',
      content: 'Great outfit!',
      hashtags: ['fashion'],
      status: 'pending',
      trackingUrl: 'https://orthis.app?utm_source=twitter',
    });
    // First fetch: container creation fails (no id in response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: 'Invalid image URL' } }),
    });

    const result = await postToInstagram('sp-1');

    expect(result.posted).toBe(false);
    expect(result.error).toBeTruthy();
    // Should only have called fetch once — stopped after container failure
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('updates the socialPost status to posted on success', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'tok-abc');
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', 'acct-123');
    mockSocialPostFindUnique.mockResolvedValue({
      id: 'sp-1',
      content: 'Great outfit!',
      hashtags: ['fashion'],
      status: 'pending',
      trackingUrl: 'https://orthis.app?utm_source=twitter',
    });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-published-1' }) });

    await postToInstagram('sp-1');

    expect(mockSocialPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sp-1' },
        data: expect.objectContaining({ status: 'posted' }),
      }),
    );
  });
});

// ─── runSocialMediaManager ────────────────────────────────────────────────────

describe('runSocialMediaManager', () => {
  it('returns early when GEMINI_API_KEY is not set', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    await runSocialMediaManager({ force: true });

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
    expect(mockSocialPostCreate).not.toHaveBeenCalled();
  });

  it('returns early on a non-content day (not Mon/Wed/Fri) when force is not set', async () => {
    // We cannot reliably control UTC day without mocking Date, so we exercise the
    // guard indirectly: when force is absent and the current day is not a content
    // day the function must short-circuit.  We verify by ensuring that if we ARE
    // on a content day the function runs, which means the guard can only be tested
    // by observing that on non-content days no posts are created.
    //
    // Strategy: run without force, then check whether executeOrQueue was called.
    // If today happens to be Mon/Wed/Fri the test would fail — so we mock Date to
    // force a Sunday (day 0) which is never a content day.
    const OriginalDate = globalThis.Date;
    const fixedSunday = new Date('2026-03-01T12:00:00Z'); // Sunday UTC
    const MockDate = class extends OriginalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fixedSunday.getTime());
        } else {
          // @ts-expect-error spread of unknown args
          super(...args);
        }
      }
      static now() { return fixedSunday.getTime(); }
    } as unknown as typeof Date;

    vi.stubGlobal('Date', MockDate);

    try {
      await runSocialMediaManager(); // no force
      expect(mockExecuteOrQueue).not.toHaveBeenCalled();
    } finally {
      vi.stubGlobal('Date', OriginalDate);
    }
  });

  it('runs all 7 generators when force=true is passed', async () => {
    // mockSocialPostCreate returns a record with id so queueGeneratedPost can proceed
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-1' });

    await runSocialMediaManager({ force: true });

    // 7 generators × 1 post each = 7 creates
    expect(mockSocialPostCreate).toHaveBeenCalledTimes(7);
  });

  it('calls executeOrQueue for each successfully generated post when force=true', async () => {
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-1' });

    await runSocialMediaManager({ force: true });

    // 7 generators → 7 executeOrQueue calls
    expect(mockExecuteOrQueue).toHaveBeenCalledTimes(7);
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'social-media-manager',
      'post_social',
      'high',
      expect.any(Object),
      expect.any(Function),
      expect.any(String),
    );
  });

  it('does not throw when a generator fails — failure is isolated', async () => {
    const { generateFounderStory } = await import('../social-content-engine.service.js');
    (generateFounderStory as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Gemini quota exceeded'),
    );
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-1' });

    await expect(runSocialMediaManager({ force: true })).resolves.toBeUndefined();

    // The remaining 6 generators should still produce posts
    expect(mockSocialPostCreate).toHaveBeenCalledTimes(6);
  });

  it('does not throw when executeOrQueue fails for a post — failure is isolated', async () => {
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-1' });
    mockExecuteOrQueue.mockRejectedValue(new Error('Agent queue full'));

    await expect(runSocialMediaManager({ force: true })).resolves.toBeUndefined();
  });

  it('stores UTM tracking URL on the socialPost record after creation', async () => {
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-created-1' });

    await runSocialMediaManager({ force: true });

    // The second call to socialPost.update adds the trackingUrl
    expect(mockSocialPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sp-created-1' },
        data: expect.objectContaining({
          trackingUrl: expect.stringContaining('utm_source='),
        }),
      }),
    );
  });

  it('creates each socialPost record with status "draft"', async () => {
    mockSocialPostCreate.mockResolvedValue({ id: 'sp-draft-1' });

    await runSocialMediaManager({ force: true });

    const createCalls = mockSocialPostCreate.mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);
    for (const [arg] of createCalls) {
      expect(arg.data.status).toBe('draft');
    }
  });
});
