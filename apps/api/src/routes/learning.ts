import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { findCourseById, findCourseBySlug } from '../db/catalog';
import { exec, query } from '../db/pool';
import { HttpError } from '../lib/httpError';
import { syncEnrollmentProgress } from '../lib/progress';
import { asNumber, iso } from '../lib/values';
import { currentUser, requireAuth } from '../middleware/auth';
import { asyncHandler, validateBody } from '../middleware/validate';
import { buildCourseTree } from './catalog';
import { enrollmentSchema, progressSchema } from '../schemas';

export const learningRouter = Router();

learningRouter.use(requireAuth);

learningRouter.post(
  '/enrollments',
  validateBody(enrollmentSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const course = await findCourseById((req.body as { courseId: string }).courseId);
    if (!course || course.status !== 'published') throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    if (!course.is_free) {
      throw new HttpError(
        402,
        'This is a paid course. Continue to checkout so the payment provider can confirm the order.',
        'PAYMENT_REQUIRED',
      );
    }
    const enrollmentId = await activateEnrollment(user.id, course.id, 'free');
    res.status(201).json({ enrollmentId, source: 'free' });
  }),
);

learningRouter.get(
  '/me/enrollments',
  asyncHandler(async (req, res) => {
    const rows = await query<
      RowDataPacket & {
        id: string;
        status: string;
        source: string;
        progress_percent: number;
        enrolled_at: unknown;
        completed_at: unknown;
        course_id: string;
        slug: string;
        title: string;
        subtitle: string;
        thumbnail_url: string | null;
        is_free: number;
        price: number;
        instructor_name: string;
        completed_lessons: number;
        total_lessons: number;
      }
    >(
      `SELECT e.id, e.status, e.source, e.progress_percent, e.enrolled_at, e.completed_at,
              c.id AS course_id, c.slug, c.title, c.subtitle, c.thumbnail_url, c.is_free, c.price,
              CONCAT(u.first_name, ' ', u.last_name) AS instructor_name,
              (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.enrollment_id = e.id AND lp.completed = 1) AS completed_lessons,
              (SELECT COUNT(*) FROM lessons l JOIN sections s ON s.id = l.section_id WHERE s.course_id = c.id) AS total_lessons
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = c.instructor_id
       WHERE e.user_id = :userId
       ORDER BY e.enrolled_at DESC`,
      { userId: currentUser(req).id },
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        source: row.source,
        progressPercent: asNumber(row.progress_percent),
        enrolledAt: iso(row.enrolled_at),
        completedAt: iso(row.completed_at),
        completedLessons: asNumber(row.completed_lessons),
        totalLessons: asNumber(row.total_lessons),
        course: {
          id: row.course_id,
          slug: row.slug,
          title: row.title,
          subtitle: row.subtitle,
          thumbnailUrl: row.thumbnail_url,
          isFree: Boolean(row.is_free),
          price: asNumber(row.price),
          instructorName: row.instructor_name,
        },
      })),
    });
  }),
);

learningRouter.get(
  '/me/learning/:slug',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const course = await findCourseBySlug(String(req.params.slug));
    if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    const isStaff = user.role === 'admin' || user.id === course.instructor_id;
    const enrollment = await query<RowDataPacket>(
      `SELECT id, status FROM enrollments WHERE user_id = :userId AND course_id = :courseId LIMIT 1`,
      { userId: user.id, courseId: course.id },
    );
    const enrolled = Boolean(enrollment[0] && enrollment[0].status !== 'cancelled');
    if (course.status !== 'published' && !isStaff && !enrolled) {
      throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    }
    const tree = await buildCourseTree(course.id, { userId: user.id, revealAll: isStaff || enrolled });
    res.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        thumbnailUrl: course.thumbnail_url,
        isFree: Boolean(course.is_free),
        price: asNumber(course.price),
        status: course.status,
        instructor: {
          id: course.instructor_id,
          firstName: course.instructor_first_name,
          lastName: course.instructor_last_name,
        },
        ...tree,
      },
    });
  }),
);

learningRouter.post(
  '/me/progress',
  validateBody(progressSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const body = req.body as { lessonId: string; completed: boolean };
    const rows = await query<RowDataPacket & { enrollment_id: string | null; course_id: string; status: string | null }>(
      `SELECT e.id AS enrollment_id, e.status, c.id AS course_id
       FROM lessons l
       JOIN sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = :userId
       WHERE l.id = :lessonId
       LIMIT 1`,
      { userId: user.id, lessonId: body.lessonId },
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, 'Lesson not found.', 'NOT_FOUND');
    if (!row.enrollment_id || row.status === 'cancelled') {
      throw new HttpError(403, 'Enroll before marking lessons complete.', 'NOT_ENROLLED');
    }
    const existing = await query<RowDataPacket & { id: string }>(
      'SELECT id FROM lesson_progress WHERE enrollment_id = :enrollmentId AND lesson_id = :lessonId LIMIT 1',
      { enrollmentId: row.enrollment_id, lessonId: body.lessonId },
    );
    if (existing[0]) {
      await exec(
        `UPDATE lesson_progress
         SET completed = :completed, completed_at = IF(:completed = 1, COALESCE(completed_at, CURRENT_TIMESTAMP), NULL)
         WHERE id = :id`,
        { id: existing[0].id, completed: body.completed ? 1 : 0 },
      );
    } else {
      await exec(
        `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at)
         VALUES (:id, :enrollmentId, :lessonId, :completed, IF(:completed = 1, CURRENT_TIMESTAMP, NULL))`,
        {
          id: randomUUID(),
          enrollmentId: row.enrollment_id,
          lessonId: body.lessonId,
          completed: body.completed ? 1 : 0,
        },
      );
    }
    const progress = await syncEnrollmentProgress(row.enrollment_id, row.course_id);
    res.json(progress);
  }),
);

learningRouter.get(
  '/me/certificates',
  asyncHandler(async (req, res) => {
    res.json({ data: await listCertificates(currentUser(req).id) });
  }),
);

learningRouter.get(
  '/me/orders',
  asyncHandler(async (req, res) => {
    const rows = await query<
      RowDataPacket & {
        id: string;
        amount: number;
        currency: string;
        status: string;
        created_at: unknown;
        title: string;
        slug: string;
        payment_status: string | null;
        provider: string | null;
      }
    >(
      `SELECT o.id, o.amount, o.currency, o.status, o.created_at, c.title, c.slug,
              p.status AS payment_status, p.provider
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.user_id = :userId
       ORDER BY o.created_at DESC`,
      { userId: currentUser(req).id },
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        amount: asNumber(row.amount),
        currency: row.currency,
        status: row.status,
        createdAt: iso(row.created_at),
        course: { title: row.title, slug: row.slug },
        payment: row.provider ? { provider: row.provider, status: row.payment_status } : null,
      })),
    });
  }),
);

export async function activateEnrollment(
  userId: string,
  courseId: string,
  source: 'free' | 'admin_grant' | 'payment',
  alreadyMessage = 'You are already enrolled in this course.',
) {
  const existing = await query<RowDataPacket & { id: string; status: string }>(
    'SELECT id, status FROM enrollments WHERE user_id = :userId AND course_id = :courseId LIMIT 1',
    { userId, courseId },
  );
  if (existing[0] && existing[0].status !== 'cancelled') {
    throw new HttpError(409, alreadyMessage, 'ALREADY_ENROLLED');
  }
  if (existing[0]) {
    await exec(
      `UPDATE enrollments
       SET status = 'active', source = :source, progress_percent = 0, completed_at = NULL
       WHERE id = :id`,
      { id: existing[0].id, source },
    );
    await exec('DELETE FROM lesson_progress WHERE enrollment_id = :id', { id: existing[0].id });
    await exec('DELETE FROM certificates WHERE enrollment_id = :id', { id: existing[0].id });
    return existing[0].id;
  }
  const id = randomUUID();
  await exec(
    `INSERT INTO enrollments (id, user_id, course_id, status, source, progress_percent)
     VALUES (:id, :userId, :courseId, 'active', :source, 0)`,
    { id, userId, courseId, source },
  );
  return id;
}

export async function listCertificates(userId?: string) {
  const rows = await query<
    RowDataPacket & {
      certificate_code: string;
      issued_at: unknown;
      course_title: string;
      course_slug: string;
      first_name: string;
      last_name: string;
    }
  >(
    `SELECT cert.certificate_code, cert.issued_at, c.title AS course_title, c.slug AS course_slug,
            u.first_name, u.last_name
     FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     JOIN users u ON u.id = cert.user_id
     ${userId ? 'WHERE cert.user_id = :userId' : ''}
     ORDER BY cert.issued_at DESC`,
    userId ? { userId } : {},
  );
  return rows.map((row) => ({
    code: row.certificate_code,
    issuedAt: iso(row.issued_at),
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    studentName: `${row.first_name} ${row.last_name}`,
  }));
}
