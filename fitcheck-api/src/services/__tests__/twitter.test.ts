import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockSocialPostFindUnique = vi.hoisted(() => vi.fn());
const mockSocialPostUpdate = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    socialPost: {
      findUnique: mockSocialPostFindUnique,
      update: mockSocialPostUpdate,
    },
  },
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { postToTwitter } from '../twitter.service.js';

// ─── Default mock post ────────────────────────────────────────────────────────

const DEFAULT_POST = {
  id: 'post-1',
  content: 'Check this outfit!',
  hashtags: ['fashion', 'ootd'],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSocialPostFindUnique.mockReset();
  mockSocialPostUpdate.mockReset();
  mockFetch.mockReset();

  // Default: all four Twitter env vars are set
  vi.stubEnv('TWITTER_API_KEY', 'api-key');
  vi.stubEnv('TWITTER_API_SECRET', 'api-secret');
  vi.stubEnv('TWITTER_ACCESS_TOKEN', 'token');
  vi.stubEnv('TWITTER_ACCESS_TOKEN_SECRET', 'token-secret');

  // Default: post exists, fetch succeeds, update resolves
  mockSocialPostFindUnique.mockResolvedValue(DEFAULT_POST);
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { id: 'tweet-123' } }),
    text: () => Promise.resolve(''),
  });
  mockSocialPostUpdate.mockResolvedValue({});

  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─── postToTwitter — missing credentials ──────────────────────────────────────

describe('postToTwitter — missing Twitter credentials', () => {
  it('returns { posted: false, error: "twitter_keys_not_configured" } when TWITTER_API_KEY is not set', async () => {
    vi.stubEnv('TWITTER_API_KEY', '');

    const result = await postToTwitter('post-1');

    expect(result).toEqual({ posted: false, error: 'twitter_keys_not_configured' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns { posted: false, error: "twitter_keys_not_configured" } when TWITTER_ACCESS_TOKEN is not set', async () => {
    vi.stubEnv('TWITTER_ACCESS_TOKEN', '');

    const result = await postToTwitter('post-1');

    expect(result).toEqual({ posted: false, error: 'twitter_keys_not_configured' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── postToTwitter — post not found ──────────────────────────────────────────

describe('postToTwitter — post not found', () => {
  it('returns { posted: false, error: "post_not_found" } when socialPost does not exist', async () => {
    mockSocialPostFindUnique.mockResolvedValue(null);

    const result = await postToTwitter('post-missing');

    expect(result).toEqual({ posted: false, error: 'post_not_found' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── postToTwitter — API request ─────────────────────────────────────────────

describe('postToTwitter — Twitter API interaction', () => {
  it('makes a POST request to the Twitter API URL', async () => {
    await postToTwitter('post-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twitter.com/2/tweets');
    expect(options.method).toBe('POST');
  });
});

// ─── postToTwitter — success path ────────────────────────────────────────────

describe('postToTwitter — success', () => {
  it('returns { posted: true, tweetId: "tweet-123" } on success', async () => {
    const result = await postToTwitter('post-1');

    expect(result).toEqual({ posted: true, tweetId: 'tweet-123' });
  });

  it('updates socialPost to status="posted" and externalId="tweet-123" on success', async () => {
    await postToTwitter('post-1');

    expect(mockSocialPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({
          status: 'posted',
          externalId: 'tweet-123',
        }),
      }),
    );
  });
});

// ─── postToTwitter — API error path ──────────────────────────────────────────

describe('postToTwitter — Twitter API error response', () => {
  it('returns { posted: false } when Twitter API responds with non-ok status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
      json: () => Promise.resolve({}),
    });

    const result = await postToTwitter('post-1');

    expect(result.posted).toBe(false);
  });

  it('updates socialPost to status="rejected" when Twitter API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
      json: () => Promise.resolve({}),
    });

    await postToTwitter('post-1');

    expect(mockSocialPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      }),
    );
  });
});

// ─── postToTwitter — network error ───────────────────────────────────────────

describe('postToTwitter — network failure', () => {
  it('returns { posted: false } when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable'));

    const result = await postToTwitter('post-1');

    expect(result.posted).toBe(false);
  });
});
