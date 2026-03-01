import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockAppReviewFindUnique = vi.hoisted(() => vi.fn());
const mockAppReviewCreate = vi.hoisted(() => vi.fn());
const mockAppReviewFindMany = vi.hoisted(() => vi.fn());
const mockAppReviewCount = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockRegisterExecutor = vi.hoisted(() => vi.fn());
const mockGetAsoSummary = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

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
    appReview: {
      findUnique: mockAppReviewFindUnique,
      create: mockAppReviewCreate,
      findMany: mockAppReviewFindMany,
      count: mockAppReviewCount,
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
  registerExecutor: mockRegisterExecutor,
}));

vi.mock('../aso-intelligence.service.js', () => ({
  getAsoSummary: mockGetAsoSummary,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runAppStoreManager, runAppStoreWeeklySummary, registerExecutors } from '../appstore-manager.service.js';

// ─── Real EC P-256 key for JWT signing in tests ────────────────────────────────
// Generated once with crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' })
const TEST_EC_PRIVATE_KEY_B64 =
  'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JR0hBZ0VBTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEJHMHdhd0lCQVFRZy9wU1M2U1FjdGxaMHZueVgKZGxlQmFCb1R1NUM1bG5xZWVDN2tVeDlDVmU2aFJBTkNBQVNObkJINVZraXAydXNST2dlTzhUbWRZdGdUKzZQNwpRcTdhYnl1TDBTTTJRM3NpWTJkcXJVd1VRVGxtYTF0bHRXWmZ6OHRlSmZ0cWxtS1Vyak5iZjF0QwotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg==';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockEmailSend.mockReset();
  mockAppReviewFindUnique.mockReset();
  mockAppReviewCreate.mockReset();
  mockAppReviewFindMany.mockReset();
  mockAppReviewCount.mockReset();
  mockExecuteOrQueue.mockReset();
  mockRegisterExecutor.mockReset();
  mockGetAsoSummary.mockReset();
  mockFetch.mockReset();

  // Sensible defaults
  mockGenerateContent.mockResolvedValue({
    response: { text: () => 'Thank you for your review!' },
  });
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
  mockAppReviewFindUnique.mockResolvedValue(null);
  mockAppReviewCreate.mockResolvedValue({ id: 'review-db-1' });
  mockAppReviewFindMany.mockResolvedValue([]);
  mockAppReviewCount.mockResolvedValue(0);
  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockRegisterExecutor.mockReturnValue(undefined);
  mockGetAsoSummary.mockResolvedValue(null);

  vi.stubGlobal('fetch', mockFetch);

  // Ensure no real env vars bleed into tests — override all service env vars to
  // empty by default; individual tests opt-in to what they need.
  vi.stubEnv('APPSTORE_KEY_ID', '');
  vi.stubEnv('APPSTORE_ISSUER_ID', '');
  vi.stubEnv('APPSTORE_PRIVATE_KEY', '');
  vi.stubEnv('APPSTORE_APP_ID', '');
  vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT', '');
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', '');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');
  vi.stubEnv('GEMINI_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─── runAppStoreManager / fetchAppleReviews ───────────────────────────────────

describe('runAppStoreManager / fetchAppleReviews', () => {
  it('skips Apple reviews when APPSTORE_KEY_ID is not set', async () => {
    await runAppStoreManager();

    const calls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    const appleCalls = calls.filter((url) => url.includes('appstoreconnect.apple.com'));
    expect(appleCalls).toHaveLength(0);
  });

  it('skips Google reviews when GOOGLE_PLAY_SERVICE_ACCOUNT is not set', async () => {
    await runAppStoreManager();

    const calls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    const googleCalls = calls.filter((url) => url.includes('androidpublisher.googleapis.com'));
    expect(googleCalls).toHaveLength(0);
  });

  it('calls the Apple API with a URL containing the configured appId when credentials are set', async () => {
    vi.stubEnv('APPSTORE_KEY_ID', 'kid');
    vi.stubEnv('APPSTORE_ISSUER_ID', 'issuer');
    vi.stubEnv('APPSTORE_PRIVATE_KEY', TEST_EC_PRIVATE_KEY_B64);
    vi.stubEnv('APPSTORE_APP_ID', 'app123');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await runAppStoreManager();

    const calls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    const appleCalls = calls.filter((url) => url.includes('appstoreconnect.apple.com'));
    expect(appleCalls).toHaveLength(1);
    expect(appleCalls[0]).toContain('app123');
  });

  it('creates AppReview record and calls executeOrQueue with high risk for a new Apple review', async () => {
    vi.stubEnv('APPSTORE_KEY_ID', 'kid');
    vi.stubEnv('APPSTORE_ISSUER_ID', 'issuer');
    vi.stubEnv('APPSTORE_PRIVATE_KEY', TEST_EC_PRIVATE_KEY_B64);
    vi.stubEnv('APPSTORE_APP_ID', 'app123');
    vi.stubEnv('GEMINI_API_KEY', ''); // use fallback reply — no Gemini needed

    const appleReview = {
      id: 'rev-apple-1',
      attributes: {
        rating: 5,
        title: 'Love it',
        body: 'Best outfit app ever',
        reviewerNickname: 'FashionFan',
        createdDate: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [appleReview] }),
    });
    mockAppReviewFindUnique.mockResolvedValue(null); // new review
    mockAppReviewCreate.mockResolvedValue({ id: 'review-db-1' });

    await runAppStoreManager();

    expect(mockAppReviewCreate).toHaveBeenCalledTimes(1);
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'appstore-manager',
      'reply_review',
      'high',
      expect.objectContaining({ store: 'apple' }),
      expect.any(Function),
      expect.any(String),
    );
  });

  it('skips creating a record when the Apple review already exists in the DB', async () => {
    vi.stubEnv('APPSTORE_KEY_ID', 'kid');
    vi.stubEnv('APPSTORE_ISSUER_ID', 'issuer');
    vi.stubEnv('APPSTORE_PRIVATE_KEY', TEST_EC_PRIVATE_KEY_B64);
    vi.stubEnv('APPSTORE_APP_ID', 'app123');

    const appleReview = {
      id: 'rev-apple-existing',
      attributes: {
        rating: 4,
        title: 'Nice',
        body: 'Good app',
        reviewerNickname: 'User1',
        createdDate: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [appleReview] }),
    });
    mockAppReviewFindUnique.mockResolvedValue({ id: 'review-db-existing' }); // already present

    await runAppStoreManager();

    expect(mockAppReviewCreate).not.toHaveBeenCalled();
  });

  it('does not throw when the Apple API returns a non-200 status', async () => {
    vi.stubEnv('APPSTORE_KEY_ID', 'kid');
    vi.stubEnv('APPSTORE_ISSUER_ID', 'issuer');
    vi.stubEnv('APPSTORE_PRIVATE_KEY', TEST_EC_PRIVATE_KEY_B64);
    vi.stubEnv('APPSTORE_APP_ID', 'app123');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(runAppStoreManager()).resolves.toBeUndefined();
    expect(mockAppReviewCreate).not.toHaveBeenCalled();
  });
});

// ─── runAppStoreWeeklySummary ─────────────────────────────────────────────────

describe('runAppStoreWeeklySummary', () => {
  it('skips without RESEND_API_KEY', async () => {
    // RESEND_API_KEY already stubbed to '' in beforeEach
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runAppStoreWeeklySummary();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips without REPORT_RECIPIENT_EMAIL', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    // REPORT_RECIPIENT_EMAIL already stubbed to '' in beforeEach

    await runAppStoreWeeklySummary();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends email with correct subject when reviews exist', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockAppReviewFindMany.mockResolvedValue([
      { rating: 5, store: 'apple' },
      { rating: 3, store: 'google' },
    ]);
    mockAppReviewCount.mockResolvedValue(1);
    mockGetAsoSummary.mockResolvedValue(null);

    await runAppStoreWeeklySummary();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const args = mockEmailSend.mock.calls[0][0] as Record<string, string>;
    // 2 reviews, avg = (5+3)/2 = 4.0
    expect(args.subject).toContain('2 review(s)');
    expect(args.subject).toContain('4.0 avg');
  });

  it('includes ASO keywords in email when asoSummary is available', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockAppReviewFindMany.mockResolvedValue([{ rating: 4, store: 'apple' }]);
    mockAppReviewCount.mockResolvedValue(0);
    mockGetAsoSummary.mockResolvedValue({
      topKeywords: ['outfit feedback', 'AI stylist'],
      keywords: [],
      biggestMovers: [],
      competitors: [],
    });

    await runAppStoreWeeklySummary();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const args = mockEmailSend.mock.calls[0][0] as Record<string, string>;
    expect(args.html).toContain('outfit feedback');
    expect(args.html).toContain('AI stylist');
  });

  it('does not throw when email send fails', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockAppReviewFindMany.mockResolvedValue([]);
    mockAppReviewCount.mockResolvedValue(0);
    mockGetAsoSummary.mockResolvedValue(null);
    mockEmailSend.mockRejectedValue(new Error('Resend down'));

    await expect(runAppStoreWeeklySummary()).resolves.toBeUndefined();
  });
});

// ─── registerExecutors ────────────────────────────────────────────────────────

describe('registerExecutors', () => {
  it('calls registerExecutor with agent name "appstore-manager" and action "reply_review"', () => {
    mockRegisterExecutor.mockReset();

    registerExecutors();

    expect(mockRegisterExecutor).toHaveBeenCalledWith(
      'appstore-manager',
      'reply_review',
      expect.any(Function),
    );
  });
});
