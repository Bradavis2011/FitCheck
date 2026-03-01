import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockSafeTokenEqual  = vi.hoisted(() => vi.fn());
const mockRequireAdmin    = vi.hoisted(() => vi.fn());

const mockGetDashboard    = vi.hoisted(() => vi.fn());
const mockGetActions      = vi.hoisted(() => vi.fn());
const mockGetAllActions   = vi.hoisted(() => vi.fn());
const mockGetQueue        = vi.hoisted(() => vi.fn());
const mockApproveAction   = vi.hoisted(() => vi.fn());
const mockRejectAction    = vi.hoisted(() => vi.fn());
const mockKillAgent       = vi.hoisted(() => vi.fn());
const mockEnableAgent     = vi.hoisted(() => vi.fn());
const mockKillAllAgents   = vi.hoisted(() => vi.fn());
const mockGetSummary      = vi.hoisted(() => vi.fn());
const mockProcessApproved = vi.hoisted(() => vi.fn());

const mockSocialFindUnique = vi.hoisted(() => vi.fn());
const mockSocialUpdate     = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../utils/crypto.js', () => ({
  safeTokenEqual: mockSafeTokenEqual,
}));

vi.mock('../../utils/admin.js', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    socialPost: {
      findUnique: mockSocialFindUnique,
      update:     mockSocialUpdate,
    },
  },
}));

vi.mock('../../services/agent-manager.service.js', () => ({
  getAgentDashboard:    mockGetDashboard,
  getAgentActions:      mockGetActions,
  getAllActions:         mockGetAllActions,
  getPendingQueue:      mockGetQueue,
  approveAction:        mockApproveAction,
  rejectAction:         mockRejectAction,
  killAgent:            mockKillAgent,
  enableAgent:          mockEnableAgent,
  killAllAgents:        mockKillAllAgents,
  getDashboardSummary:  mockGetSummary,
  processApprovedActions: mockProcessApproved,
}));

import {
  verifyToken,
  listAgents,
  toggleAgent,
  approveAgentAction,
  updateSocialPost,
  rejectAgentAction,
  killAll,
  triggerAgent,
} from '../agent-admin.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'admin-1', body: {}, query: {}, params: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { json, status } as unknown as Response;
  return { res, json, status };
}

// ─── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  mockSafeTokenEqual.mockReset();
  mockRequireAdmin.mockReset();
  mockGetDashboard.mockReset();
  mockGetActions.mockReset();
  mockGetAllActions.mockReset();
  mockGetQueue.mockReset();
  mockApproveAction.mockReset();
  mockRejectAction.mockReset();
  mockKillAgent.mockReset();
  mockEnableAgent.mockReset();
  mockKillAllAgents.mockReset();
  mockGetSummary.mockReset();
  mockProcessApproved.mockReset();
  mockSocialFindUnique.mockReset();
  mockSocialUpdate.mockReset();

  // Default: requireAdmin is a no-op (admin passes)
  mockRequireAdmin.mockReturnValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

// ─── verifyToken ──────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('returns 401 when no ADMIN_DASHBOARD_TOKEN env var', async () => {
    // No env var set — adminToken will be undefined
    const req = makeReq({ body: { token: 'anything' } }) as unknown as Request;
    const { res, status } = makeRes();

    await verifyToken(req, res);

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token does not match', async () => {
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'correct-token');
    mockSafeTokenEqual.mockReturnValue(false);

    const req = makeReq({ body: { token: 'wrong-token' } }) as unknown as Request;
    const { res, status } = makeRes();

    await verifyToken(req, res);

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns { ok: true } when token matches', async () => {
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'secret-token');
    mockSafeTokenEqual.mockReturnValue(true);

    const req = makeReq({ body: { token: 'secret-token' } }) as unknown as Request;
    const { res, json } = makeRes();

    await verifyToken(req, res);

    expect(json).toHaveBeenCalledWith({ ok: true });
  });
});

// ─── listAgents ───────────────────────────────────────────────────────────────

describe('listAgents', () => {
  it('calls requireAdmin and then getAgentDashboard', async () => {
    mockGetDashboard.mockResolvedValue({ agents: [] });

    const req = makeReq();
    const { res } = makeRes();

    await listAgents(req, res);

    expect(mockRequireAdmin).toHaveBeenCalledWith(req);
    expect(mockGetDashboard).toHaveBeenCalledOnce();
  });

  it('returns dashboard result', async () => {
    const dashboardData = { agents: [{ name: 'nudger', enabled: true }], pendingCount: 0 };
    mockGetDashboard.mockResolvedValue(dashboardData);

    const req = makeReq();
    const { res, json } = makeRes();

    await listAgents(req, res);

    expect(json).toHaveBeenCalledWith(dashboardData);
  });
});

// ─── toggleAgent ──────────────────────────────────────────────────────────────

describe('toggleAgent', () => {
  it('calls enableAgent when enabled: true', async () => {
    mockEnableAgent.mockResolvedValue(undefined);

    const req = makeReq({ params: { name: 'nudger' }, body: { enabled: true } });
    const { res } = makeRes();

    await toggleAgent(req, res);

    expect(mockEnableAgent).toHaveBeenCalledWith('nudger');
    expect(mockKillAgent).not.toHaveBeenCalled();
  });

  it('calls killAgent when enabled: false', async () => {
    mockKillAgent.mockResolvedValue(undefined);

    const req = makeReq({ params: { name: 'nudger' }, body: { enabled: false } });
    const { res } = makeRes();

    await toggleAgent(req, res);

    expect(mockKillAgent).toHaveBeenCalledWith('nudger');
    expect(mockEnableAgent).not.toHaveBeenCalled();
  });

  it('returns { ok: true, agent, enabled }', async () => {
    mockEnableAgent.mockResolvedValue(undefined);

    const req = makeReq({ params: { name: 'nudger' }, body: { enabled: true } });
    const { res, json } = makeRes();

    await toggleAgent(req, res);

    expect(json).toHaveBeenCalledWith({ ok: true, agent: 'nudger', enabled: true });
  });
});

// ─── approveAgentAction ───────────────────────────────────────────────────────

describe('approveAgentAction', () => {
  it('calls approveAction with action id and userId', async () => {
    mockApproveAction.mockResolvedValue(undefined);
    mockProcessApproved.mockResolvedValue(undefined);

    const req = makeReq({ params: { id: 'action-42' }, userId: 'admin-1' });
    const { res } = makeRes();

    await approveAgentAction(req, res);

    expect(mockApproveAction).toHaveBeenCalledWith('action-42', 'admin-1');
  });

  it('calls processApprovedActions immediately after approve', async () => {
    mockApproveAction.mockResolvedValue(undefined);
    mockProcessApproved.mockResolvedValue(undefined);

    const req = makeReq({ params: { id: 'action-42' } });
    const { res } = makeRes();

    await approveAgentAction(req, res);

    expect(mockProcessApproved).toHaveBeenCalledOnce();
  });

  it('returns { ok: true, status: "approved_and_processing" } even if processApprovedActions throws', async () => {
    mockApproveAction.mockResolvedValue(undefined);
    mockProcessApproved.mockRejectedValue(new Error('execution failed'));

    const req = makeReq({ params: { id: 'action-42' } });
    const { res, json } = makeRes();

    await approveAgentAction(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, status: 'approved_and_processing' })
    );
  });
});

// ─── updateSocialPost ─────────────────────────────────────────────────────────

describe('updateSocialPost', () => {
  it('throws AppError(404) when social post not found', async () => {
    mockSocialFindUnique.mockResolvedValue(null);

    const req = makeReq({
      params: { postId: 'post-missing' },
      body: { content: 'New content here' },
    });
    const { res } = makeRes();

    await expect(updateSocialPost(req, res)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSocialUpdate).not.toHaveBeenCalled();
  });

  it('throws AppError(409) when post is not pending', async () => {
    mockSocialFindUnique.mockResolvedValue({ id: 'post-1', status: 'published' });

    const req = makeReq({
      params: { postId: 'post-1' },
      body: { content: 'New content here' },
    });
    const { res } = makeRes();

    await expect(updateSocialPost(req, res)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockSocialUpdate).not.toHaveBeenCalled();
  });

  it('updates post content and returns { ok: true }', async () => {
    mockSocialFindUnique.mockResolvedValue({ id: 'post-1', status: 'pending' });
    mockSocialUpdate.mockResolvedValue({});

    const req = makeReq({
      params: { postId: 'post-1' },
      body: { content: 'Updated caption text', hashtags: ['#fashion'] },
    });
    const { res, json } = makeRes();

    await updateSocialPost(req, res);

    expect(mockSocialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({ content: 'Updated caption text' }),
      })
    );
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});

// ─── triggerAgent ─────────────────────────────────────────────────────────────

describe('triggerAgent', () => {
  it('returns 404 JSON response for unknown agent name', async () => {
    const req = makeReq({ params: { name: 'nonexistent-agent' }, body: {} });
    const { res, status, json } = makeRes();

    await triggerAgent(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('nonexistent-agent') })
    );
  });

  it('returns { ok: true, agent, message } for valid agent name (fires and forgets)', async () => {
    const req = makeReq({ params: { name: 'growth-dashboard' }, body: {} });
    const { res, json } = makeRes();

    await triggerAgent(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        agent: 'growth-dashboard',
        message: expect.stringContaining('growth-dashboard'),
      })
    );
  });
});
