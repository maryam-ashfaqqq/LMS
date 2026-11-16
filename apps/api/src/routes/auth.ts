import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { exec, query } from '../db/pool';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/tokens';
import { HttpError } from '../lib/httpError';
import { asBool, emptyToNull, iso } from '../lib/values';
import type { Role } from '../lib/roles';
import { asyncHandler, validateBody } from '../middleware/validate';
import { currentUser, requireAuth } from '../middleware/auth';
import { loginSchema, passwordChangeSchema, profileSchema, registerSchema } from '../schemas';

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  is_active: number;
  last_login_at: unknown;
  created_at: unknown;
};

function mapUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    bio: row.bio,
    isActive: asBool(row.is_active),
    lastLoginAt: iso(row.last_login_at),
    createdAt: iso(row.created_at),
  };
}

async function loadUser(id: string) {
  const rows = await query<UserRow>('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
  return rows[0] ?? null;
}

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: 'student' | 'instructor';
    };
    const email = body.email.toLowerCase();
    if (body.role === 'instructor') {
      const settings = await query<RowDataPacket & { setting_value: string }>(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'allow_instructor_registration' LIMIT 1`,
      );
      if (settings[0]?.setting_value === 'false') {
        throw new HttpError(403, 'Instructor registration is closed.', 'REGISTRATION_CLOSED');
      }
    }
    const existing = await query<RowDataPacket>('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
    if (existing.length > 0) {
      throw new HttpError(409, 'An account with that email already exists.', 'EMAIL_TAKEN');
    }
    const id = randomUUID();
    await exec(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
       VALUES (:id, :email, :passwordHash, :firstName, :lastName, :role)`,
      {
        id,
        email,
        passwordHash: await hashPassword(body.password),
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
      },
    );
    const user = await loadUser(id);
    if (!user) throw new HttpError(500, 'The account could not be loaded.', 'INTERNAL');
    res.status(201).json({ token: signToken(user), user: mapUser(user) });
  }),
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; password: string };
    const rows = await query<UserRow>('SELECT * FROM users WHERE email = :email LIMIT 1', {
      email: body.email.toLowerCase(),
    });
    const user = rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new HttpError(401, 'The email or password is incorrect.', 'INVALID_CREDENTIALS');
    }
    if (!user.is_active) {
      throw new HttpError(403, 'This account has been deactivated.', 'ACCOUNT_INACTIVE');
    }
    await exec('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id', { id: user.id });
    const fresh = await loadUser(user.id);
    res.json({ token: signToken(user), user: mapUser(fresh ?? user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.status(204).send();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(currentUser(req).id);
    if (!user || !user.is_active) throw new HttpError(401, 'This account is not active.', 'UNAUTHENTICATED');
    res.json({ user: mapUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validateBody(profileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      firstName: string;
      lastName: string;
      headline: string;
      bio: string;
      avatarUrl?: string | null;
    };
    const userId = currentUser(req).id;
    await exec(
      `UPDATE users
       SET first_name = :firstName, last_name = :lastName, headline = :headline, bio = :bio, avatar_url = :avatarUrl
       WHERE id = :id`,
      {
        id: userId,
        firstName: body.firstName,
        lastName: body.lastName,
        headline: emptyToNull(body.headline),
        bio: emptyToNull(body.bio),
        avatarUrl: body.avatarUrl === undefined ? (await loadUser(userId))?.avatar_url ?? null : emptyToNull(body.avatarUrl),
      },
    );
    const user = await loadUser(userId);
    if (!user) throw new HttpError(404, 'Account not found.', 'NOT_FOUND');
    res.json({ user: mapUser(user) });
  }),
);

authRouter.patch(
  '/password',
  requireAuth,
  validateBody(passwordChangeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { currentPassword: string; newPassword: string };
    const user = await loadUser(currentUser(req).id);
    if (!user) throw new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    if (!(await verifyPassword(body.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'The current password is incorrect.', 'INVALID_PASSWORD', {
        currentPassword: ['The current password is incorrect.'],
      });
    }
    await exec('UPDATE users SET password_hash = :passwordHash WHERE id = :id', {
      id: user.id,
      passwordHash: await hashPassword(body.newPassword),
    });
    res.json({ ok: true });
  }),
);
