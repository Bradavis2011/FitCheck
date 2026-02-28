import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZodError, ZodIssueCode } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted ensures these are initialized before vi.mock factories run
const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/node', () => ({
  captureException: mockCaptureException,
}));

import { errorHandler, AppError, reset5xxCount, get5xxCount } from '../errorHandler.js';

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  reset5xxCount();
  mockCaptureException.mockReset();
});

describe('errorHandler — AppError', () => {
  it('sends the AppError status code and message as JSON', () => {
    const { res, status, json } = makeRes();
    const err = new AppError(400, 'Bad request');
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Bad request', status: 400 });
  });

  it('does not increment 5xx counter for a 4xx AppError', () => {
    const { res } = makeRes();
    errorHandler(new AppError(422, 'Unprocessable'), req, res, next);
    expect(get5xxCount()).toBe(0);
  });

  it('increments 5xx counter and calls Sentry for a 500 AppError', () => {
    const { res } = makeRes();
    const err = new AppError(500, 'Server error');
    errorHandler(err, req, res, next);
    expect(get5xxCount()).toBe(1);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });

  it('increments counter for each 5xx AppError', () => {
    const { res: res1 } = makeRes();
    const { res: res2 } = makeRes();
    errorHandler(new AppError(500, 'first'), req, res1, next);
    errorHandler(new AppError(503, 'second'), req, res2, next);
    expect(get5xxCount()).toBe(2);
  });
});

describe('errorHandler — generic Error', () => {
  it('returns 500 for an unhandled generic Error', () => {
    const { res, status, json } = makeRes();
    errorHandler(new Error('Something went wrong'), req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'An unexpected error occurred', status: 500 });
  });

  it('increments 5xx counter and calls Sentry for a generic Error', () => {
    const { res } = makeRes();
    const err = new Error('Boom');
    errorHandler(err, req, res, next);
    expect(get5xxCount()).toBe(1);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });
});

describe('errorHandler — ZodError', () => {
  function makeZodError(issues: { path: (string | number)[]; message: string }[]): ZodError {
    return new ZodError(
      issues.map(({ path, message }) => ({
        code: ZodIssueCode.custom,
        path,
        message,
      }))
    );
  }

  it('returns 400 with fieldErrors for a ZodError', () => {
    const { res, status, json } = makeRes();
    const err = makeZodError([{ path: ['question'], message: 'Required' }]);
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'Validation failed',
      status: 400,
      fieldErrors: [{ field: 'question', message: 'Required' }],
    });
  });

  it('does not increment 5xx counter for a ZodError', () => {
    const { res } = makeRes();
    errorHandler(makeZodError([{ path: ['x'], message: 'Bad' }]), req, res, next);
    expect(get5xxCount()).toBe(0);
  });

  it('does not call Sentry for a ZodError', () => {
    const { res } = makeRes();
    errorHandler(makeZodError([{ path: ['x'], message: 'Bad' }]), req, res, next);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe('errorHandler — SyntaxError with status 400', () => {
  it('returns 400 "Invalid JSON" for a body-parser SyntaxError', () => {
    const { res, status, json } = makeRes();
    const syntaxErr = new SyntaxError('Unexpected token') as SyntaxError & { status: number };
    syntaxErr.status = 400;
    errorHandler(syntaxErr, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid JSON in request body', status: 400 });
  });

  it('does not increment 5xx counter for a JSON parse error', () => {
    const { res } = makeRes();
    const syntaxErr = new SyntaxError('bad json') as SyntaxError & { status: number };
    syntaxErr.status = 400;
    errorHandler(syntaxErr, req, res, next);
    expect(get5xxCount()).toBe(0);
  });
});
