import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateRequest(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fieldErrors: { source: string; field: string; message: string }[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const e of result.error.errors) {
          fieldErrors.push({ source: 'body', field: e.path.join('.'), message: e.message });
        }
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const e of result.error.errors) {
          fieldErrors.push({ source: 'query', field: e.path.join('.'), message: e.message });
        }
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const e of result.error.errors) {
          fieldErrors.push({ source: 'params', field: e.path.join('.'), message: e.message });
        }
      } else {
        req.params = result.data as typeof req.params;
      }
    }

    if (fieldErrors.length > 0) {
      res.status(400).json({ error: 'Validation failed', status: 400, fieldErrors });
      return;
    }

    next();
  };
}
