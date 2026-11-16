import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { findCourseById, findCourseBySlug, listCourses } from '../db/catalog';
import { exec, query } from '../db/pool';
import { getSettings, saveSettings, type SettingKey } from '../db/settings';
import { hashPassword } from '../lib/password';
import { HttpError } from '../lib/httpError';
import { slugify } from '../lib/slug';
import { asBool, asNumber, iso } from '../lib/values';
import type { Role } from '../lib/roles';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, validateBody } from '../middleware/validate';
import {
  adminUserPatchSchema,
  adminUserSchema,
  categorySchema,
  enrollmentStatusSchema,
  grantEnrollmentSchema,
  rejectSchema,
  settingsSchema,
} from '../schemas';
import { activateEnrollment } from './learning';

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: number;
  created_at: unknown;
  last_login_at: unknown;
  headline: string | null;
};

function mapAdminUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    headline: row.headline,
    isActive: asBool(row.is_active),
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

async function uniqueCategorySlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (true) {
    const rows = await query<RowDataPacket>('SELECT id FROM categories WHERE slug = :slug LIMIT 1', { slug });
    if (rows.length === 0) return slug;
    slug = `${base.slice(0, 70)}-${suffix}`;
    suffix += 1;
  }
}

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    const totals = await query<
      RowDataPacket & {
        users: number;
        students: number;
        instructors: number;
        admins: number;
        draft: number;
        pending: number;
        published: number;
        rejected: number;
        active_enrollments: number;
        completed_enrollments: number;
        cancelled_enrollments: number;
        certificates: number;
        revenue: number;
      }
    >(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
         (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS instructors,
         (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
         (SELECT COUNT(*) FROM courses WHERE status = 'draft') AS draft,
         (SELECT COUNT(*) FROM courses WHERE status = 'pending') AS pending,
         (SELECT COUNT(*) FROM courses WHERE status = 'published') AS published,
         (SELECT COUNT(*) FROM courses WHERE status = 'rejected') AS rejected,
         (SELECT COUNT(*) FROM enrollments WHERE status = 'active') AS active_enrollments,
         (SELECT COUNT(*) FROM enrollments WHERE status = 'completed') AS completed_enrollments,
         (SELECT COUNT(*) FROM enrollments WHERE status = 'cancelled') AS cancelled_enrollments,
         (SELECT COUNT(*) FROM certificates) AS certificates,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded') AS revenue`,
    );
    const recentUsers = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, is_active, headline, created_at, last_login_at
       FROM users ORDER BY created_at DESC LIMIT 6`,
    );
    const recentCourses = await listCourses({ publicOnly: false, pageSize: 6, sort: 'newest' });
    const row = totals[0];
    res.json({
      users: {
        total: asNumber(row?.users),
        students: asNumber(row?.students),
        instructors: asNumber(row?.instructors),
        admins: asNumber(row?.admins),
      },
      courses: {
        draft: asNumber(row?.draft),
        pending: asNumber(row?.pending),
        published: asNumber(row?.published),
        rejected: asNumber(row?.rejected),
      },
      enrollments: {
        active: asNumber(row?.active_enrollments),
        completed: asNumber(row?.completed_enrollments),
        cancelled: asNumber(row?.cancelled_enrollments),
      },
      certificates: asNumber(row?.certificates),
      revenue: {
        amount: asNumber(row?.revenue),
        currency: settings.currency,
        note: 'Revenue counts only payments confirmed by the provider.',
      },
      recentUsers: recentUsers.map(mapAdminUser),
      recentCourses: recentCourses.data,
    });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    if (role === 'admin' || role === 'instructor' || role === 'student') {
      where.push('role = :role');
      params.role = role;
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      where.push('(email LIKE :search OR first_name LIKE :search OR last_name LIKE :search)');
      params.search = `%${req.query.search.trim()}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pageSize = Math.min(50, Math.max(1, Math.trunc(Number(req.query.pageSize) || 20)));
    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const offset = (page - 1) * pageSize;
    const rows = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, is_active, headline, created_at, last_login_at
       FROM users ${clause} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params,
    );
    const totalRows = await query<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM users ${clause}`,
      params,
    );
    res.json({ data: rows.map(mapAdminUser), page, pageSize, total: asNumber(totalRows[0]?.total) });
  }),
);

adminRouter.post(
  '/users',
  validateBody(adminUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; password: string; firstName: string; lastName: string; role: Role };
    const email = body.email.toLowerCase();
    const existing = await query<RowDataPacket>('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
    if (existing.length > 0) throw new HttpError(409, 'An account with that email already exists.', 'EMAIL_TAKEN');
    const id = randomUUID();
    await exec(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role)
       VALUES (:id, :email, :passwordHash, :firstName, :lastName, :role)`,
      { id, email, passwordHash: await hashPassword(body.password), firstName: body.firstName, lastName: body.lastName, role: body.role },
    );
    const rows = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, is_active, headline, created_at, last_login_at FROM users WHERE id = :id`,
      { id },
    );
    res.status(201).json({ user: mapAdminUser(rows[0]) });
  }),
);

adminRouter.patch(
  '/users/:id',
  validateBody(adminUserPatchSchema),
  asyncHandler(async (req, res) => {
    const actor = currentUser(req);
    const rows = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, is_active, headline, created_at, last_login_at FROM users WHERE id = :id LIMIT 1`,
      { id: req.params.id },
    );
    const target = rows[0];
    if (!target) throw new HttpError(404, 'User not found.', 'NOT_FOUND');
    const body = req.body as { firstName?: string; lastName?: string; role?: Role; isActive?: boolean };
    if (target.id === actor.id && body.isActive === false) {
      throw new HttpError(400, 'You cannot deactivate your own account.', 'SELF_UPDATE');
    }
    if (target.id === actor.id && body.role && body.role !== 'admin') {
      throw new HttpError(400, 'You cannot remove your own admin access.', 'SELF_UPDATE');
    }
    await exec(
      `UPDATE users
       SET first_name = :firstName, last_name = :lastName, role = :role, is_active = :isActive
       WHERE id = :id`,
      {
        id: target.id,
        firstName: body.firstName ?? target.first_name,
        lastName: body.lastName ?? target.last_name,
        role: body.role ?? target.role,
        isActive: body.isActive === undefined ? target.is_active : body.isActive ? 1 : 0,
      },
    );
    const updated = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, is_active, headline, created_at, last_login_at FROM users WHERE id = :id`,
      { id: target.id },
    );
    res.json({ user: mapAdminUser(updated[0]) });
  }),
);

adminRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    res.json(await listCourses({ ...req.query, publicOnly: false }));
  }),
);

adminRouter.post(
  '/courses/:id/approve',
  asyncHandler(async (req, res) => {
    const course = await findCourseById(String(req.params.id));
    if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    if (course.status === 'draft') {
      throw new HttpError(400, 'The instructor has not submitted this course.', 'NOT_SUBMITTED');
    }
    await exec(`UPDATE courses SET status = 'published', rejection_reason = NULL WHERE id = :id`, { id: course.id });
    res.json({ status: 'published' });
  }),
);

adminRouter.post(
  '/courses/:id/reject',
  validateBody(rejectSchema),
  asyncHandler(async (req, res) => {
    const course = await findCourseById(String(req.params.id));
    if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    if (course.status === 'draft') {
      throw new HttpError(400, 'Draft courses are not in the review queue.', 'NOT_SUBMITTED');
    }
    await exec(`UPDATE courses SET status = 'rejected', rejection_reason = :reason WHERE id = :id`, {
      id: course.id,
      reason: (req.body as { reason: string }).reason,
    });
    res.json({ status: 'rejected' });
  }),
);

adminRouter.post(
  '/courses/:id/unpublish',
  asyncHandler(async (req, res) => {
    const course = await findCourseById(String(req.params.id));
    if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    await exec(`UPDATE courses SET status = 'draft', rejection_reason = NULL WHERE id = :id`, { id: course.id });
    res.json({ status: 'draft' });
  }),
);

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await query<RowDataPacket & { id: string; name: string; slug: string; description: string; course_count: number }>(
      `SELECT c.id, c.name, c.slug, c.description,
              (SELECT COUNT(*) FROM courses k WHERE k.category_id = c.id) AS course_count
       FROM categories c ORDER BY c.name ASC`,
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        courseCount: asNumber(row.course_count),
      })),
    });
  }),
);

adminRouter.post(
  '/categories',
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { name: string; description: string };
    const id = randomUUID();
    await exec(
      `INSERT INTO categories (id, name, slug, description) VALUES (:id, :name, :slug, :description)`,
      { id, name: body.name, slug: await uniqueCategorySlug(body.name), description: body.description },
    );
    res.status(201).json({ id });
  }),
);

adminRouter.patch(
  '/categories/:id',
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { name: string; description: string };
    const existing = await query<RowDataPacket>('SELECT id FROM categories WHERE id = :id LIMIT 1', { id: req.params.id });
    if (!existing[0]) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
    await exec('UPDATE categories SET name = :name, description = :description WHERE id = :id', {
      id: req.params.id,
      name: body.name,
      description: body.description,
    });
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const used = await query<RowDataPacket>('SELECT id FROM courses WHERE category_id = :id LIMIT 1', { id: req.params.id });
    if (used.length > 0) {
      throw new HttpError(409, 'Move courses out of this category before deleting it.', 'CATEGORY_IN_USE');
    }
    const result = await exec('DELETE FROM categories WHERE id = :id', { id: req.params.id });
    if (result.affectedRows === 0) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
    res.status(204).send();
  }),
);

adminRouter.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    if (typeof req.query.status === 'string' && ['active', 'completed', 'cancelled'].includes(req.query.status)) {
      where.push('e.status = :status');
      params.status = req.query.status;
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      where.push('(u.email LIKE :search OR c.title LIKE :search OR u.first_name LIKE :search OR u.last_name LIKE :search)');
      params.search = `%${req.query.search.trim()}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query<
      RowDataPacket & {
        id: string;
        status: string;
        source: string;
        progress_percent: number;
        enrolled_at: unknown;
        email: string;
        first_name: string;
        last_name: string;
        title: string;
        slug: string;
      }
    >(
      `SELECT e.id, e.status, e.source, e.progress_percent, e.enrolled_at,
              u.email, u.first_name, u.last_name, c.title, c.slug
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       ${clause}
       ORDER BY e.enrolled_at DESC
       LIMIT 100`,
      params,
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        source: row.source,
        progressPercent: asNumber(row.progress_percent),
        enrolledAt: iso(row.enrolled_at),
        student: { email: row.email, firstName: row.first_name, lastName: row.last_name },
        course: { title: row.title, slug: row.slug },
      })),
    });
  }),
);

adminRouter.post(
  '/enrollments',
  validateBody(grantEnrollmentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; courseSlug: string };
    const users = await query<RowDataPacket & { id: string; is_active: number }>(
      'SELECT id, is_active FROM users WHERE email = :email LIMIT 1',
      { email: body.email.toLowerCase() },
    );
    const student = users[0];
    if (!student) throw new HttpError(404, 'No account uses that email.', 'NOT_FOUND');
    if (!student.is_active) throw new HttpError(400, 'That account is deactivated.', 'ACCOUNT_INACTIVE');
    const course = await findCourseBySlug(body.courseSlug);
    if (!course || course.status !== 'published') {
      throw new HttpError(400, 'Choose a published course.', 'COURSE_UNAVAILABLE', {
        courseSlug: ['Choose a published course.'],
      });
    }
    const enrollmentId = await activateEnrollment(student.id, course.id, 'admin_grant', 'This student is already enrolled.');
    res.status(201).json({
      enrollmentId,
      source: 'admin_grant',
      note: 'This grant does not create a payment record.',
    });
  }),
);

adminRouter.patch(
  '/enrollments/:id',
  validateBody(enrollmentStatusSchema),
  asyncHandler(async (req, res) => {
    const status = (req.body as { status: 'active' | 'cancelled' }).status;
    const existing = await query<RowDataPacket>('SELECT id FROM enrollments WHERE id = :id LIMIT 1', { id: req.params.id });
    if (!existing[0]) throw new HttpError(404, 'Enrollment not found.', 'NOT_FOUND');
    if (status === 'cancelled') {
      await exec(`UPDATE enrollments SET status = 'cancelled' WHERE id = :id`, { id: req.params.id });
    } else {
      await exec(
        `UPDATE enrollments
         SET status = IF(progress_percent >= 100, 'completed', 'active')
         WHERE id = :id`,
        { id: req.params.id },
      );
    }
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    const rows = await query<
      RowDataPacket & {
        id: string;
        provider: string;
        provider_reference: string | null;
        amount: number;
        currency: string;
        status: string;
        created_at: unknown;
        order_status: string;
        email: string;
        title: string;
      }
    >(
      `SELECT p.id, p.provider, p.provider_reference, p.amount, p.currency, p.status, p.created_at,
              o.status AS order_status, u.email, c.title
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN users u ON u.id = o.user_id
       JOIN courses c ON c.id = o.course_id
       ORDER BY p.created_at DESC
       LIMIT 100`,
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerReference: row.provider_reference,
        amount: asNumber(row.amount),
        currency: row.currency,
        status: row.status,
        orderStatus: row.order_status,
        createdAt: iso(row.created_at),
        studentEmail: row.email,
        courseTitle: row.title,
      })),
    });
  }),
);

adminRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

adminRouter.put(
  '/settings',
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<SettingKey, string>;
    res.json({ settings: await saveSettings(body) });
  }),
);
