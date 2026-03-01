import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockAgentConfigFindUnique = vi.hoisted(() => vi.fn());
const mockAgentConfigCreate = vi.hoisted(() => vi.fn());
const mockAgentConfigUpsert = vi.hoisted(() => vi.fn());
const mockAgentActionCreate = vi.hoisted(() => vi.fn());
const mockAgentActionUpdate = vi.hoisted(() => vi.fn());
const mockAgentActionCount = vi.hoisted(() => vi.fn());
const mockAgentActionFindMany = vi.hoisted(() => vi.fn());
const mockAgentActionGroupBy = vi.hoisted(() => vi.fn());
const mockCheckContent = vi.hoisted(() => vi.fn());
const mockPostToTwitter = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    agentConfig: {
      findUnique: mockAgentConfigFindUnique,
      create: mockAgentConfigCreate,
      upsert: mockAgentConfigUpsert,
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentAction: {
      create: mockAgentActionCreate,
      update: mockAgentActionUpdate,
      count: mockAgentActionCount,
      findMany: mockAgentActionFindMany,
      groupBy: mockAgentActionGroupBy,
    },
  },
}));

vi.mock('../brand-guard.service.js', () => ({
  checkContent: mockCheckContent,
}));

vi.mock('../twitter.service.js', () => ({
  postToTwitter: mockPostToTwitter,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import {
  executeOrQueue,
  processApprovedActions,
  registerExecutor,
  approveAction,
  killAllAgents,
} from '../agent-manager.service.js';

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  id: 'cfg-1',
  agent: 'test-agent',
  enabled: true,
  maxActionsPerDay: 50,
  maxActionsPerHour: 10,
  autoApproveRisk: 'medium',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  mockAgentConfigFindUnique.mockResolvedValue(DEFAULT_CONFIG);
  // checkRateLimit calls agentAction.count twice (hourly + daily) — both return 0 by default
  mockAgentActionCount.mockResolvedValue(0);
  mockAgentActionCreate.mockResolvedValue({ id: 'action-1', payload: {} });
  mockAgentActionUpdate.mockResolvedValue({});
  mockCheckContent.mockResolvedValue({ approved: true, issues: [] });
  mockAgentActionFindMany.mockResolvedValue([]);
  mockAgentActionGroupBy.mockResolvedValue([]);
  mockAgentConfigCreate.mockResolvedValue(DEFAULT_CONFIG);
  mockAgentConfigUpsert.mockResolvedValue({});
});

// ─── executeOrQueue ───────────────────────────────────────────────────────────

describe('executeOrQueue', () => {
  it('returns { status: "rejected", reason: "agent_disabled" } when agent config.enabled is false', async () => {
    mockAgentConfigFindUnique.mockResolvedValue({ ...DEFAULT_CONFIG, enabled: false });

    const result = await executeOrQueue(
      'test-agent',
      'send_email',
      'low',
      { foo: 'bar' },
      vi.fn().mockResolvedValue({}),
    );

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('agent_disabled');
  });

  it('returns { status: "rejected" } when hourly rate limit is exceeded', async () => {
    // checkRateLimit calls count twice: [hourly, daily] via Promise.all.
    // Return 10 for the first call (hourly >= maxPerHour=10) → limit exceeded.
    mockAgentActionCount
      .mockResolvedValueOnce(10) // hourly count = 10 → exceeds maxPerHour=10
      .mockResolvedValueOnce(0);  // daily count (not reached, but Promise.all resolves both)

    const result = await executeOrQueue(
      'test-agent',
      'send_email',
      'low',
      {},
      vi.fn().mockResolvedValue({}),
    );

    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('hourly_limit_exceeded');
  });

  it('returns { status: "queued" } when riskLevel="high" and autoApproveRisk="medium"', async () => {
    // high(2) > medium(1) → queued
    const result = await executeOrQueue(
      'test-agent',
      'post_social',
      'high',
      { content: 'draft post' },
      vi.fn().mockResolvedValue({}),
    );

    expect(result.status).toBe('queued');
    expect(result.actionId).toBe('action-1');
  });

  it('returns { status: "executed" } when riskLevel="low" and autoApproveRisk="medium"', async () => {
    // low(0) <= medium(1) → auto-execute
    const executeFn = vi.fn().mockResolvedValue({ sent: true });

    const result = await executeOrQueue(
      'test-agent',
      'send_push',
      'low',
      { userId: 'u1' },
      executeFn,
    );

    expect(result.status).toBe('executed');
    expect(executeFn).toHaveBeenCalledOnce();
    expect(executeFn).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('returns { status: "rejected", reason: "brand_guard: ..." } when brand guard rejects', async () => {
    mockCheckContent.mockResolvedValue({ approved: false, issues: ['offensive language'] });

    // medium risk with autoApproveRisk=medium: riskVal(1) <= autoApproveVal(1) → no queue,
    // but brand guard runs for riskVal >= RISK_LEVELS.medium(1) when contentToCheck is provided
    const result = await executeOrQueue(
      'test-agent',
      'send_email',
      'medium',
      { content: 'bad content' },
      vi.fn().mockResolvedValue({}),
      'bad content',
    );

    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('brand_guard');
    expect(result.reason).toContain('offensive language');
  });

  it('calls executeFn and marks action as "executed" on success', async () => {
    const executeFn = vi.fn().mockResolvedValue({ emailId: 'e-1' });

    const result = await executeOrQueue(
      'test-agent',
      'send_email',
      'low',
      { to: 'user@example.com' },
      executeFn,
    );

    expect(result.status).toBe('executed');
    expect(executeFn).toHaveBeenCalledOnce();
    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action-1' },
        data: expect.objectContaining({ status: 'executed' }),
      }),
    );
  });

  it('marks action as "failed" and re-throws when executeFn throws', async () => {
    const executeFn = vi.fn().mockRejectedValue(new Error('downstream failure'));

    await expect(
      executeOrQueue('test-agent', 'send_email', 'low', {}, executeFn),
    ).rejects.toThrow('downstream failure');

    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action-1' },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('creates default config via agentConfig.create when findUnique returns null', async () => {
    mockAgentConfigFindUnique.mockResolvedValue(null);
    // create returns the default config so execution can proceed
    mockAgentConfigCreate.mockResolvedValue(DEFAULT_CONFIG);

    const executeFn = vi.fn().mockResolvedValue({});

    const result = await executeOrQueue('new-agent', 'send_email', 'low', {}, executeFn);

    expect(mockAgentConfigCreate).toHaveBeenCalledOnce();
    expect(mockAgentConfigCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agent: 'new-agent',
          enabled: true,
          maxActionsPerDay: 50,
          maxActionsPerHour: 10,
          autoApproveRisk: 'medium',
        }),
      }),
    );
    // After default config is created, execution should proceed normally
    expect(result.status).toBe('executed');
  });
});

// ─── processApprovedActions ───────────────────────────────────────────────────

describe('processApprovedActions', () => {
  it('does nothing when no approved actions exist', async () => {
    mockAgentActionFindMany.mockResolvedValue([]);

    await processApprovedActions();

    expect(mockAgentActionUpdate).not.toHaveBeenCalled();
  });

  it('marks action as "executed" when a registered executor succeeds', async () => {
    const executorFn = vi.fn().mockResolvedValue({ ok: true });
    registerExecutor('my-agent', 'do_thing', executorFn);

    mockAgentActionFindMany.mockResolvedValue([
      {
        id: 'approved-1',
        agent: 'my-agent',
        actionType: 'do_thing',
        payload: { key: 'value' },
        status: 'approved',
      },
    ]);

    await processApprovedActions();

    expect(executorFn).toHaveBeenCalledOnce();
    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'approved-1' },
        data: expect.objectContaining({ status: 'executed' }),
      }),
    );
  });

  it('marks action as "failed" when no executor is registered for the key', async () => {
    mockAgentActionFindMany.mockResolvedValue([
      {
        id: 'approved-2',
        agent: 'unregistered-agent',
        actionType: 'unknown_action',
        payload: {},
        status: 'approved',
      },
    ]);

    await processApprovedActions();

    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'approved-2' },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('marks action as "failed" when executor throws', async () => {
    registerExecutor('crash-agent', 'crash_action', async () => {
      throw new Error('executor blew up');
    });

    mockAgentActionFindMany.mockResolvedValue([
      {
        id: 'approved-3',
        agent: 'crash-agent',
        actionType: 'crash_action',
        payload: {},
        status: 'approved',
      },
    ]);

    await processApprovedActions();

    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'approved-3' },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});

// ─── killAllAgents ────────────────────────────────────────────────────────────

describe('killAllAgents', () => {
  it('calls agentConfig.upsert for at least 20 agents (ALL_AGENT_NAMES has 37 entries)', async () => {
    await killAllAgents();

    expect(mockAgentConfigUpsert.mock.calls.length).toBeGreaterThanOrEqual(20);

    // Every upsert must disable the agent
    for (const call of mockAgentConfigUpsert.mock.calls) {
      expect(call[0].update).toEqual({ enabled: false });
      expect(call[0].create).toMatchObject({ enabled: false });
    }
  });
});

// ─── approveAction ────────────────────────────────────────────────────────────

describe('approveAction', () => {
  it('calls agentAction.update with status "approved"', async () => {
    await approveAction('action-99', 'admin@orthis.app');

    expect(mockAgentActionUpdate).toHaveBeenCalledOnce();
    expect(mockAgentActionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action-99' },
        data: expect.objectContaining({
          status: 'approved',
          reviewedBy: 'admin@orthis.app',
          reviewedAt: expect.any(Date),
        }),
      }),
    );
  });
});
