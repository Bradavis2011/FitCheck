import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

// In-memory 5xx error counter (resets on server restart)
let _errorCount5xx = 0;

export function get5xxCount(): number { return _errorCount5xx; }
export function reset5xxCount(): void { _errorCount5xx = 0; }

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  // Express body-parser sends SyntaxError for malformed JSON
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ error: 'Invalid JSON in request body', status: 400 });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      _errorCount5xx++;
      try { Sentry.captureException(err); } catch {}
    }
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode
    });
  }

  // Default error (unhandled 500)
  _errorCount5xx++;
  try { Sentry.captureException(err); } catch {}

  res.status(500).json({
    error: 'An unexpected error occurred',
    status: 500
  });
}
