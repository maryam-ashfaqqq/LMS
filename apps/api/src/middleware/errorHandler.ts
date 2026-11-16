import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/httpError';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: `No route matches ${req.method} ${req.path}.`,
      code: 'NOT_FOUND',
    },
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    });
    return;
  }

  const maybeMulter = error as { name?: string; code?: string; type?: string; status?: number };
  if (maybeMulter.type === 'entity.parse.failed' || (error instanceof SyntaxError && maybeMulter.status === 400)) {
    res.status(400).json({
      error: {
        message: 'The request body must be valid JSON.',
        code: 'BAD_JSON',
      },
    });
    return;
  }

  if (maybeMulter.name === 'MulterError') {
    res.status(400).json({
      error: {
        message: 'The upload was rejected. Check the file type and size.',
        code: 'UPLOAD_ERROR',
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      message: 'Something went wrong on the server.',
      code: 'INTERNAL',
    },
  });
}
