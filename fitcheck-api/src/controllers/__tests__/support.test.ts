import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockHandleSupportQuestion = vi.hoisted(() => vi.fn());

vi.mock('../../services/support-bot.service.js', () => ({
  handleSupportQuestion: mockHandleSupportQuestion,
}));

import { askSupport } from '../support.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

beforeEach(() => {
  mockHandleSupportQuestion.mockReset();
  mockHandleSupportQuestion.mockResolvedValue({
    response: 'You get 3 outfit checks per day.',
    escalated: false,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('askSupport', () => {
  describe('validation', () => {
    it('throws AppError(400) when question is missing', async () => {
      const req = makeReq({ body: {} });
      const { res } = makeRes();

      await expect(askSupport(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when question is an empty string', async () => {
      const req = makeReq({ body: { question: '   ' } });
      const { res } = makeRes();

      await expect(askSupport(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when question exceeds 1000 characters', async () => {
      const req = makeReq({ body: { question: 'q'.repeat(1001) } });
      const { res } = makeRes();

      await expect(askSupport(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts a question of exactly 1000 characters', async () => {
      const req = makeReq({ body: { question: 'q'.repeat(1000) } });
      const { res } = makeRes();

      await expect(askSupport(req, res)).resolves.toBeUndefined();
      expect(mockHandleSupportQuestion).toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('calls handleSupportQuestion with the trimmed question and userId', async () => {
      const req = makeReq({
        userId: 'user-42',
        body: { question: '  How many checks do I get?  ' },
      });
      const { res } = makeRes();

      await askSupport(req, res);

      expect(mockHandleSupportQuestion).toHaveBeenCalledWith(
        'user-42',
        'How many checks do I get?',
      );
    });

    it('returns the service result directly as JSON', async () => {
      mockHandleSupportQuestion.mockResolvedValue({
        response: 'You get 3 checks per day.',
        escalated: false,
      });
      const req = makeReq({ body: { question: 'How many checks?' } });
      const { res, json } = makeRes();

      await askSupport(req, res);

      expect(json).toHaveBeenCalledWith({
        response: 'You get 3 checks per day.',
        escalated: false,
      });
    });

    it('passes through escalated=true responses unchanged', async () => {
      mockHandleSupportQuestion.mockResolvedValue({
        response: 'ESCALATE - billing dispute',
        escalated: true,
      });
      const req = makeReq({ body: { question: 'I was charged twice!' } });
      const { res, json } = makeRes();

      await askSupport(req, res);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ escalated: true }),
      );
    });
  });
});
