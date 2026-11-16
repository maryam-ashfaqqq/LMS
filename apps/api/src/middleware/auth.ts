import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { query } from '../db/pool';
import { HttpError } from '../lib/httpError';
import type { Role } from '../lib/roles';
import { verifyToken } from '../lib/tokens';

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  role: Role;
  is_active: number;
};

async function attachUser(req: Request, token: string): Promise<void> {
  const payload = verifyToken(token);
  const rows = await query<UserRow>(
    'SELECT id, email, role, is_active FROM users WHERE id = :id LIMIT 1',
    { id: payload.sub },
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    throw new HttpError(401, 'This account is not active.', 'UNAUTHENTICATED');
  }
  req.user = { id: user.id, email: user.email, role: user.role };
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      next(new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED'));
      return;
    }
    await attachUser(req, token);
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, 'Your session has expired. Sign in again.', 'UNAUTHENTICATED'));
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    next();
    return;
  }
  try {
    await attachUser(req, token);
  } catch {
    // A public page should still render when the stored token is stale.
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'You do not have access to this action.', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function currentUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
  return req.user;
}
