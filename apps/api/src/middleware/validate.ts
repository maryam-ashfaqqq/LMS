import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { HttpError } from '../lib/httpError';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        fields[key] ??= [];
        fields[key].push(issue.message);
      }
      next(new HttpError(400, 'Check the highlighted fields.', 'VALIDATION_ERROR', fields));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
