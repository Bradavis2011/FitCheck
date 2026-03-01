import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockStyleDNAFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockChallengeFindMany = vi.hoisted(() => vi.fn());
const mockChallengeCreate = vi.hoisted(() => vi.fn());
const mockFollowFindMany = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockRegisterExecutor = vi.hoisted(() => vi.fn());
const mockSendPush = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

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
    styleDNA: {
      findMany: mockStyleDNAFindMany,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
      findFirst: mockOutfitFindFirst,
    },
    challenge: {
      findMany: mockChallengeFindMany,
      create: mockChallengeCreate,
    },
    follow: {
      findMany: mockFollowFindMany,
    },
    notification: {
      count: mockNotificationCount,
      create: mockNotificationCreate,
      findFirst: mockNotificationFindFirst,
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
  registerExecutor: mockRegisterExecutor,
}));

vi.mock('../push.service.js', () => ({
  pushService: { sendPushNotification: mockSendPush },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runCommunityManagerWeekly, runCommunityManagerDaily } from '../community-manager.service.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // getTrendData defaults
  mockStyleDNAFindMany.mockResolvedValue([
    { styleArchetypes: ['casual', 'minimalist'], dominantColors: ['navy', 'white'] },
  ]);

  // Gemini default: valid JSON challenge
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () =>
        JSON.stringify({
          title: 'Monochrome Monday',
          description: 'Wear one color head to toe for a week.',
          theme: 'monochrome',
          prize: 'Featured on feed',
        }),
    },
  });

  mockChallengeCreate.mockResolvedValue({ id: 'challenge-1', title: 'Monochrome Monday' });
  mockChallengeFindMany.mockResolvedValue([]);

  // highlightTopOutfits defaults — no top outfits
  mockOutfitFindMany.mockResolvedValue([]);
  mockFollowFindMany.mockResolvedValue([]);
  mockNotificationCount.mockResolvedValue(0);
  mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });

  // welcomeNewPublicMembers defaults
  mockOutfitFindFirst.mockResolvedValue(null);
  mockNotificationFindFirst.mockResolvedValue(null);

  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockSendPush.mockResolvedValue(undefined);
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runCommunityManagerWeekly ────────────────────────────────────────────────

describe('runCommunityManagerWeekly', () => {
  it('skips when GEMINI_API_KEY is not set', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    await runCommunityManagerWeekly();

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('calls Gemini once with a trend summary prompt', async () => {
    await runCommunityManagerWeekly();

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [promptArg] = mockGenerateContent.mock.calls[0];
    // Prompt should mention our style data
    expect(typeof promptArg).toBe('string');
    expect(promptArg).toContain('Or This?');
  });

  it('calls executeOrQueue with "medium" risk when Gemini returns valid JSON', async () => {
    await runCommunityManagerWeekly();

    expect(mockExecuteOrQueue).toHaveBeenCalledOnce();
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'community-manager',
      'create_challenge',
      'medium',
      expect.objectContaining({ title: 'Monochrome Monday', theme: 'monochrome' }),
      expect.any(Function),
      expect.any(String),
    );
  });

  it('does not throw when Gemini fails — error is caught', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini quota exceeded'));

    await expect(runCommunityManagerWeekly()).resolves.toBeUndefined();
    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });

  it('does not call executeOrQueue when Gemini returns malformed JSON (no JSON object found)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Sorry, I cannot generate that right now.',
      },
    });

    await runCommunityManagerWeekly();

    expect(mockExecuteOrQueue).not.toHaveBeenCalled();
  });
});

// ─── runCommunityManagerDaily ─────────────────────────────────────────────────

describe('runCommunityManagerDaily', () => {
  it('calls outfitCheck.findMany to find top outfits', async () => {
    await runCommunityManagerDaily();

    expect(mockOutfitFindMany).toHaveBeenCalled();
    const firstCall = mockOutfitFindMany.mock.calls[0][0];
    expect(firstCall.where).toMatchObject({ isPublic: true, isDeleted: false });
    expect(firstCall.orderBy).toMatchObject({ aiScore: 'desc' });
  });

  it('calls executeOrQueue for each follower of an owner with a top outfit', async () => {
    mockOutfitFindMany.mockResolvedValueOnce([
      {
        id: 'outfit-1',
        userId: 'owner-1',
        aiScore: 9.5,
        isPublic: true,
        isDeleted: false,
        createdAt: new Date(),
        user: { id: 'owner-1', username: 'styleking', name: 'Style King' },
      },
    ]);
    mockFollowFindMany.mockResolvedValue([
      { followerId: 'follower-1' },
      { followerId: 'follower-2' },
    ]);
    mockNotificationCount.mockResolvedValue(0);

    await runCommunityManagerDaily();

    // welcomeNewPublicMembers also calls outfitFindMany — we only care about executeOrQueue from highlight
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'community-manager',
      'highlight_outfit',
      'low',
      expect.objectContaining({ followerId: 'follower-1', outfitId: 'outfit-1' }),
      expect.any(Function),
    );
    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'community-manager',
      'highlight_outfit',
      'low',
      expect.objectContaining({ followerId: 'follower-2', outfitId: 'outfit-1' }),
      expect.any(Function),
    );
  });

  it('does NOT call executeOrQueue for a follower who already has 5 community_highlight notifications today', async () => {
    mockOutfitFindMany.mockResolvedValueOnce([
      {
        id: 'outfit-2',
        userId: 'owner-2',
        aiScore: 8.8,
        isPublic: true,
        isDeleted: false,
        createdAt: new Date(),
        user: { id: 'owner-2', username: 'trendsetter', name: 'Trend Setter' },
      },
    ]);
    mockFollowFindMany.mockResolvedValue([{ followerId: 'follower-capped' }]);
    // Already at the 5-notification cap
    mockNotificationCount.mockResolvedValue(5);

    await runCommunityManagerDaily();

    const highlightCalls = mockExecuteOrQueue.mock.calls.filter(
      ([, action]) => action === 'highlight_outfit',
    );
    expect(highlightCalls).toHaveLength(0);
  });

  it('calls executeOrQueue for a first-time public member welcome', async () => {
    // highlightTopOutfits returns no outfits
    mockOutfitFindMany
      .mockResolvedValueOnce([]) // highlightTopOutfits
      .mockResolvedValueOnce([{ userId: 'user-new' }]); // welcomeNewPublicMembers distinct query

    mockOutfitFindFirst.mockResolvedValue(null); // no prior public outfit
    mockNotificationFindFirst.mockResolvedValue(null); // not yet welcomed

    await runCommunityManagerDaily();

    expect(mockExecuteOrQueue).toHaveBeenCalledWith(
      'community-manager',
      'welcome_public',
      'low',
      expect.objectContaining({ userId: 'user-new' }),
      expect.any(Function),
    );
  });

  it('does NOT welcome a user who has a prior public outfit before the 24h window', async () => {
    mockOutfitFindMany
      .mockResolvedValueOnce([]) // highlightTopOutfits
      .mockResolvedValueOnce([{ userId: 'user-veteran' }]); // welcomeNewPublicMembers distinct query

    // This user had a public outfit older than 24h → not their first
    mockOutfitFindFirst.mockResolvedValue({ id: 'old-outfit', userId: 'user-veteran' });

    await runCommunityManagerDaily();

    const welcomeCalls = mockExecuteOrQueue.mock.calls.filter(
      ([, action]) => action === 'welcome_public',
    );
    expect(welcomeCalls).toHaveLength(0);
  });
});
