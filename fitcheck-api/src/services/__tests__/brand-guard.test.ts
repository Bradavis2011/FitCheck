import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockAgentActionFindMany = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    agentAction: {
      findMany: mockAgentActionFindMany,
    },
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

import { checkContent, publishBrandGuardMetrics } from '../brand-guard.service.js';

// ─── beforeEach / afterEach defaults ─────────────────────────────────────────

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockAgentActionFindMany.mockReset();
  mockPublishBus.mockReset();

  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify({ approved: true, issues: [] }) },
  });
  mockAgentActionFindMany.mockResolvedValue([]);
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('GEMINI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── checkContent ─────────────────────────────────────────────────────────────

describe('checkContent', () => {
  it('returns { approved: true, issues: [] } when GEMINI_API_KEY is not set', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    const result = await checkContent('some content', 'social post');

    expect(result).toEqual({ approved: true, issues: [] });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns approved=true with empty issues for well-formed approved response', async () => {
    const result = await checkContent('a unique piece of content for this test', 'email');

    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns approved=false when Gemini returns { approved: false, issues: ["spam"] }', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ approved: false, issues: ['spam language detected'] }),
      },
    });

    const result = await checkContent(
      'BUY NOW!!! BEST DEAL EVER!!!!! LIMITED TIME OFFER!!!!',
      'push notification',
    );

    expect(result.approved).toBe(false);
    expect(result.issues).toContain('spam language detected');
  });

  it('returns approved=true when Gemini returns unparseable text (no JSON found)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'Sorry, I cannot review this content at this time.' },
    });

    const result = await checkContent('content that breaks the parser xyz-unique-1', 'email');

    expect(result).toEqual({ approved: true, issues: [] });
  });

  it('returns approved=true when Gemini throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini API quota exceeded'));

    const result = await checkContent('content that causes error abc-unique-2', 'social post');

    expect(result).toEqual({ approved: true, issues: [] });
  });

  it('includes revised field when Gemini returns it', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            approved: false,
            issues: ['too pushy'],
            revised: 'A softer, more encouraging version of the message.',
          }),
      },
    });

    const result = await checkContent(
      'HURRY UP and check your outfit NOW!!!',
      'push notification',
    );

    expect(result.revised).toBe('A softer, more encouraging version of the message.');
  });

  it('does not include revised field when Gemini omits it', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ approved: true, issues: [] }),
      },
    });

    const result = await checkContent('clean content for omit-revised-test', 'email');

    expect(result.revised).toBeUndefined();
  });

  it('does NOT call Gemini on second call for same text (cache hit)', async () => {
    const text = 'cache-test-unique-text-that-wont-collide-with-others';

    await checkContent(text, 'context-a');
    await checkContent(text, 'context-b');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('returns cached result on second call for same text', async () => {
    const text = 'cache-hit-result-test-unique-string';
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ approved: false, issues: ['off-brand tone'] }),
      },
    });

    const first = await checkContent(text, 'context-a');
    const second = await checkContent(text, 'context-b');

    expect(first.approved).toBe(false);
    expect(second.approved).toBe(false);
    expect(second.issues).toContain('off-brand tone');
  });

  it('strips markdown fences and parses the inner JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          '```json\n{"approved":false,"issues":["mentions competitor"]}\n```',
      },
    });

    const result = await checkContent('text mentioning FashionAI app unique-fence-test', 'email');

    expect(result.approved).toBe(false);
    expect(result.issues).toContain('mentions competitor');
  });

  it('defaults approved to true when Gemini omits the approved field entirely', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ issues: [] }) },
    });

    const result = await checkContent('content with no approved field unique-default-test', 'email');

    expect(result.approved).toBe(true);
  });

  it('filters non-string values out of the issues array', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ approved: false, issues: ['real issue', 42, null, 'another issue'] }),
      },
    });

    const result = await checkContent('content with mixed issues array unique-filter-test', 'email');

    expect(result.issues).toEqual(['real issue', 'another issue']);
  });
});

// ─── publishBrandGuardMetrics ─────────────────────────────────────────────────

describe('publishBrandGuardMetrics', () => {
  it('does nothing when no agent actions in last 30 days', async () => {
    mockAgentActionFindMany.mockResolvedValue([]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).not.toHaveBeenCalled();
  });

  it('does nothing when all agents have fewer than 5 actions', async () => {
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'content-calendar', status: 'auto_approved' },
      { agent: 'content-calendar', status: 'auto_approved' },
      { agent: 'content-calendar', status: 'approved' },
      { agent: 'content-calendar', status: 'rejected' },
      // only 4 — below the minimum threshold of 5
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).not.toHaveBeenCalled();
  });

  it('publishes brand_guard_metrics to bus for agents with >= 5 actions', async () => {
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'social-media-manager', status: 'auto_approved' },
      { agent: 'social-media-manager', status: 'auto_approved' },
      { agent: 'social-media-manager', status: 'approved' },
      { agent: 'social-media-manager', status: 'approved' },
      { agent: 'social-media-manager', status: 'rejected' },
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'brand-guard',
      'brand_guard_metrics',
      expect.objectContaining({
        measuredAt: expect.any(String),
        metrics: expect.arrayContaining([
          expect.objectContaining({ agent: 'social-media-manager', total: 5 }),
        ]),
      }),
    );
  });

  it('correctly computes approvalRate (approved + auto_approved / total)', async () => {
    // 3 approved/auto_approved out of 5 → approvalRate = 0.6
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'approved' },
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'rejected' },
      { agent: 'community-manager', status: 'pending' },
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'brand-guard',
      'brand_guard_metrics',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            agent: 'community-manager',
            approvalRate: 3 / 5,
            rejectionRate: 1 / 5,
          }),
        ]),
      }),
    );
  });

  it('correctly computes rejectionRate (rejected / total)', async () => {
    // 4 rejected out of 5 → rejectionRate = 0.8
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'appstore-manager', status: 'rejected' },
      { agent: 'appstore-manager', status: 'rejected' },
      { agent: 'appstore-manager', status: 'rejected' },
      { agent: 'appstore-manager', status: 'rejected' },
      { agent: 'appstore-manager', status: 'approved' },
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'brand-guard',
      'brand_guard_metrics',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            agent: 'appstore-manager',
            rejectionRate: 4 / 5,
          }),
        ]),
      }),
    );
  });

  it('identifies overFlagging agents (approvalRate > 0.95)', async () => {
    // 6 auto_approved out of 6 → approvalRate = 1.0 → over-flagging
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'outreach-agent', status: 'auto_approved' },
      { agent: 'outreach-agent', status: 'auto_approved' },
      { agent: 'outreach-agent', status: 'auto_approved' },
      { agent: 'outreach-agent', status: 'auto_approved' },
      { agent: 'outreach-agent', status: 'auto_approved' },
      { agent: 'outreach-agent', status: 'auto_approved' },
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'brand-guard',
      'brand_guard_metrics',
      expect.objectContaining({
        overFlagging: expect.arrayContaining(['outreach-agent']),
      }),
    );
  });

  it('identifies underFlagging agents (rejectionRate > 0.5)', async () => {
    // 4 rejected out of 5 → rejectionRate = 0.8 → under-flagging
    mockAgentActionFindMany.mockResolvedValue([
      { agent: 'social-media-manager', status: 'rejected' },
      { agent: 'social-media-manager', status: 'rejected' },
      { agent: 'social-media-manager', status: 'rejected' },
      { agent: 'social-media-manager', status: 'rejected' },
      { agent: 'social-media-manager', status: 'auto_approved' },
    ]);

    await publishBrandGuardMetrics();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'brand-guard',
      'brand_guard_metrics',
      expect.objectContaining({
        underFlagging: expect.arrayContaining(['social-media-manager']),
      }),
    );
  });

  it('excludes agents with < 5 actions from published metrics', async () => {
    mockAgentActionFindMany.mockResolvedValue([
      // community-manager has 5 → included
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'auto_approved' },
      { agent: 'community-manager', status: 'auto_approved' },
      // content-calendar has 3 → excluded
      { agent: 'content-calendar', status: 'approved' },
      { agent: 'content-calendar', status: 'approved' },
      { agent: 'content-calendar', status: 'rejected' },
    ]);

    await publishBrandGuardMetrics();

    const publishedMetrics = mockPublishBus.mock.calls[0][2].metrics as Array<{ agent: string }>;
    const agentNames = publishedMetrics.map((m) => m.agent);
    expect(agentNames).toContain('community-manager');
    expect(agentNames).not.toContain('content-calendar');
  });

  it('does not throw when prisma throws', async () => {
    mockAgentActionFindMany.mockRejectedValue(new Error('DB connection lost'));

    await expect(publishBrandGuardMetrics()).resolves.toBeUndefined();
    expect(mockPublishBus).not.toHaveBeenCalled();
  });
});
