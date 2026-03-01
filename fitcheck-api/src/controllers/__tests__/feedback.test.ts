import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockFeedbackCreate = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    userFeedback: { create: mockFeedbackCreate },
  },
}));

import { submitFeedback } from '../feedback.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const res = { json, status } as unknown as Response;
  // Chain: res.status(201).json(...)
  (res as any).status = vi.fn().mockReturnValue({ json });
  return { res, json };
}

beforeEach(() => {
  mockFeedbackCreate.mockReset();
  mockFeedbackCreate.mockResolvedValue({ id: 'fb-1' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitFeedback', () => {
  describe('validation', () => {
    it('throws AppError(400) when type is missing', async () => {
      const req = makeReq({ body: { text: 'Great app!' } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when type is not in the allowed list', async () => {
      const req = makeReq({ body: { type: 'invalid', text: 'Some text' } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when text is missing', async () => {
      const req = makeReq({ body: { type: 'bug' } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when text is an empty string', async () => {
      const req = makeReq({ body: { type: 'bug', text: '   ' } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws AppError(400) when text exceeds 2000 characters', async () => {
      const req = makeReq({ body: { type: 'general', text: 'a'.repeat(2001) } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts exactly 2000 characters', async () => {
      const req = makeReq({ body: { type: 'general', text: 'a'.repeat(2000) } });
      const { res } = makeRes();

      await expect(submitFeedback(req, res)).resolves.toBeUndefined();
      expect(mockFeedbackCreate).toHaveBeenCalled();
    });
  });

  describe('accepted types', () => {
    it.each(['bug', 'feature', 'general', 'complaint', 'praise'])(
      'accepts type="%s"',
      async type => {
        const req = makeReq({ body: { type, text: 'Some feedback' } });
        const { res } = makeRes();

        await expect(submitFeedback(req, res)).resolves.toBeUndefined();
        expect(mockFeedbackCreate).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ type }) }),
        );
      },
    );
  });

  describe('DB creation', () => {
    it('creates a UserFeedback record with status "open"', async () => {
      const req = makeReq({ userId: 'user-42', body: { type: 'feature', text: 'Dark mode please' } });
      const { res } = makeRes();

      await submitFeedback(req, res);

      expect(mockFeedbackCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-42',
            type: 'feature',
            text: 'Dark mode please',
            status: 'open',
          }),
        }),
      );
    });

    it('trims whitespace from the submitted text', async () => {
      const req = makeReq({ body: { type: 'bug', text: '  Crash on launch  ' } });
      const { res } = makeRes();

      await submitFeedback(req, res);

      expect(mockFeedbackCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: 'Crash on launch' }),
        }),
      );
    });

    it('responds with 201 and the created feedback id', async () => {
      mockFeedbackCreate.mockResolvedValue({ id: 'fb-99' });
      const req = makeReq({ body: { type: 'praise', text: 'Love this app!' } });
      const statusMock = vi.fn().mockReturnValue({ json: vi.fn() });
      const res = { status: statusMock } as unknown as Response;

      await submitFeedback(req, res);

      expect(statusMock).toHaveBeenCalledWith(201);
      const jsonMock = statusMock.mock.results[0].value.json;
      expect(jsonMock).toHaveBeenCalledWith({ success: true, id: 'fb-99' });
    });
  });
});
