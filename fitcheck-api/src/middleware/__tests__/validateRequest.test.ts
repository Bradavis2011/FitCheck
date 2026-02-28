import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../validateRequest.js';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

const next = vi.fn() as unknown as NextFunction;

describe('validateRequest', () => {
  it('calls next() when body passes validation', () => {
    const middleware = validateRequest({ body: z.object({ name: z.string() }) });
    const req = makeReq({ body: { name: 'test' } });
    const { res } = makeRes();
    const nextSpy = vi.fn();

    middleware(req, res, nextSpy);

    expect(nextSpy).toHaveBeenCalled();
  });

  it('returns 400 with fieldErrors when body fails validation', () => {
    const middleware = validateRequest({ body: z.object({ name: z.string() }) });
    const req = makeReq({ body: {} });
    const { res, status, json } = makeRes();

    middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        status: 400,
        fieldErrors: expect.arrayContaining([
          expect.objectContaining({ source: 'body', field: 'name' }),
        ]),
      })
    );
  });

  it('replaces req.body with parsed output so coercion and defaults apply', () => {
    const schema = z.object({
      count: z.coerce.number().default(5),
    });
    const middleware = validateRequest({ body: schema });
    const req = makeReq({ body: { count: '42' } });
    const { res } = makeRes();
    const nextSpy = vi.fn();

    middleware(req, res, nextSpy);

    expect(nextSpy).toHaveBeenCalled();
    expect((req as any).body.count).toBe(42);
  });

  it('applies defaults to req.query', () => {
    const schema = z.object({
      limit: z.coerce.number().default(50),
      offset: z.coerce.number().default(0),
    });
    const middleware = validateRequest({ query: schema });
    const req = makeReq({ query: {} });
    const { res } = makeRes();
    const nextSpy = vi.fn();

    middleware(req, res, nextSpy);

    expect(nextSpy).toHaveBeenCalled();
    expect((req as any).query.limit).toBe(50);
    expect((req as any).query.offset).toBe(0);
  });

  it('validates multiple sources and collects all errors', () => {
    const middleware = validateRequest({
      body: z.object({ name: z.string() }),
      query: z.object({ page: z.coerce.number().min(1) }),
    });
    const req = makeReq({ body: {}, query: { page: '0' } });
    const { res, json } = makeRes();

    middleware(req, res, next);

    const call = json.mock.calls[0][0];
    expect(call.fieldErrors.length).toBeGreaterThanOrEqual(2);
    expect(call.fieldErrors.some((e: any) => e.source === 'body')).toBe(true);
    expect(call.fieldErrors.some((e: any) => e.source === 'query')).toBe(true);
  });

  it('does not call next() when validation fails', () => {
    const middleware = validateRequest({ body: z.object({ required: z.string() }) });
    const req = makeReq({ body: {} });
    const { res } = makeRes();
    const nextSpy = vi.fn();

    middleware(req, res, nextSpy);

    expect(nextSpy).not.toHaveBeenCalled();
  });
});
