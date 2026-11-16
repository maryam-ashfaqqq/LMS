import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { findCourseById, listCourses, mapCourse } from '../db/catalog';
import { exec, query } from '../db/pool';
import { getSettings } from '../db/settings';
import { HttpError } from '../lib/httpError';
import { syncCourseEnrollments } from '../lib/progress';
import { slugify } from '../lib/slug';
import { asNullableNumber, asNumber, emptyToNull, iso } from '../lib/values';
import { currentUser, requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, validateBody } from '../middleware/validate';
import { courseWriteSchema, lessonSchema, moveSchema, sectionSchema } from '../schemas';
import { buildCourseTree } from './catalog';
import { removeCourse } from '../lib/remove';

async function uniqueCourseSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (true) {
    const rows = await query<RowDataPacket>('SELECT id FROM courses WHERE slug = :slug LIMIT 1', { slug });
    if (rows.length === 0) return slug;
    slug = `${base.slice(0, 70)}-${suffix}`;
    suffix += 1;
  }
}

async function ownedCourse(courseId: string, user: { id: string; role: string }) {
  const course = await findCourseById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
  if (user.role !== 'admin' && course.instructor_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own courses.', 'FORBIDDEN');
  }
  return course;
}

async function ownedSection(sectionId: string, user: { id: string; role: string }) {
  const rows = await query<RowDataPacket & { id: string; course_id: string; instructor_id: string }>(
    `SELECT s.id, s.course_id, c.instructor_id
     FROM sections s JOIN courses c ON c.id = s.course_id
     WHERE s.id = :id LIMIT 1`,
    { id: sectionId },
  );
  const section = rows[0];
  if (!section) throw new HttpError(404, 'Section not found.', 'NOT_FOUND');
  if (user.role !== 'admin' && section.instructor_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own courses.', 'FORBIDDEN');
  }
  return section;
}

async function ownedLesson(lessonId: string, user: { id: string; role: string }) {
  const rows = await query<RowDataPacket & { id: string; course_id: string; instructor_id: string; section_id: string }>(
    `SELECT l.id, l.section_id, s.course_id, c.instructor_id
     FROM lessons l
     JOIN sections s ON s.id = l.section_id
     JOIN courses c ON c.id = s.course_id
     WHERE l.id = :id LIMIT 1`,
    { id: lessonId },
  );
  const lesson = rows[0];
  if (!lesson) throw new HttpError(404, 'Lesson not found.', 'NOT_FOUND');
  if (user.role !== 'admin' && lesson.instructor_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own courses.', 'FORBIDDEN');
  }
  return lesson;
}

async function reorder(ids: string[], id: string, direction: 'up' | 'down', table: 'sections' | 'lessons') {
  const index = ids.indexOf(id);
  if (index < 0) throw new HttpError(404, 'Item not found.', 'NOT_FOUND');
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  const next = [...ids];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  for (let position = 0; position < next.length; position += 1) {
    const sql =
      table === 'sections'
        ? 'UPDATE sections SET position = :position WHERE id = :id'
        : 'UPDATE lessons SET position = :position WHERE id = :id';
    await exec(sql, { position: position + 1, id: next[position] });
  }
}

export const instructorRouter = Router();
instructorRouter.use(requireAuth, requireRole('instructor', 'admin'));

instructorRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const instructorId = user.role === 'instructor' ? user.id : null;
    res.json(await instructorOverview(instructorId));
  }),
);

instructorRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    res.json(
      await listCourses({
        ...req.query,
        publicOnly: false,
        instructorId: user.role === 'admin' ? undefined : user.id,
      }),
    );
  }),
);

instructorRouter.post(
  '/courses',
  validateBody(courseWriteSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    if (user.role !== 'instructor' && user.role !== 'admin') {
      throw new HttpError(403, 'Only instructors can create courses.', 'FORBIDDEN');
    }
    const body = req.body as CourseBody;
    await assertCategory(body.categoryId);
    const id = randomUUID();
    const instructorId = user.role === 'instructor' ? user.id : user.id;
    await exec(
      `INSERT INTO courses (
         id, instructor_id, category_id, title, slug, subtitle, description, thumbnail_url,
         price, is_free, level, language, status
       ) VALUES (
         :id, :instructorId, :categoryId, :title, :slug, :subtitle, :description, :thumbnailUrl,
         :price, :isFree, :level, :language, 'draft'
       )`,
      courseParams(id, instructorId, await uniqueCourseSlug(body.title), body),
    );
    const created = await findCourseById(id);
    res.status(201).json({ course: created ? mapCourse(created, true) : { id } });
  }),
);

instructorRouter.get(
  '/courses/:id',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    const tree = await buildCourseTree(course.id, { userId: currentUser(req).id, revealAll: true });
    res.json({ course: { ...mapCourse(course, true), ...tree } });
  }),
);

instructorRouter.patch(
  '/courses/:id',
  validateBody(courseWriteSchema),
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    const body = req.body as CourseBody;
    await assertCategory(body.categoryId);
    await exec(
      `UPDATE courses
       SET category_id = :categoryId, title = :title, subtitle = :subtitle, description = :description,
           thumbnail_url = :thumbnailUrl, price = :price, is_free = :isFree, level = :level, language = :language
       WHERE id = :id`,
      { ...courseParams(course.id, course.instructor_id, course.slug, body), id: course.id },
    );
    const updated = await findCourseById(course.id);
    res.json({ course: updated ? mapCourse(updated, true) : null });
  }),
);

instructorRouter.delete(
  '/courses/:id',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    await removeCourse(course.id);
    res.status(204).send();
  }),
);

instructorRouter.post(
  '/courses/:id/submit',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    if (course.status === 'published') {
      throw new HttpError(400, 'This course is already published.', 'ALREADY_PUBLISHED');
    }
    if (course.status === 'pending') {
      throw new HttpError(400, 'This course is already waiting for review.', 'ALREADY_PENDING');
    }
    const lessons = await query<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM lessons l JOIN sections s ON s.id = l.section_id WHERE s.course_id = :id`,
      { id: course.id },
    );
    if (asNumber(lessons[0]?.total) < 1) {
      throw new HttpError(400, 'Add at least one lesson before submitting the course.', 'CURRICULUM_REQUIRED');
    }
    await exec(`UPDATE courses SET status = 'pending', rejection_reason = NULL WHERE id = :id`, { id: course.id });
    res.json({ status: 'pending' });
  }),
);

instructorRouter.post(
  '/courses/:id/sections',
  validateBody(sectionSchema),
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    const positionRows = await query<RowDataPacket & { next_pos: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM sections WHERE course_id = :id',
      { id: course.id },
    );
    const id = randomUUID();
    await exec('INSERT INTO sections (id, course_id, title, position) VALUES (:id, :courseId, :title, :position)', {
      id,
      courseId: course.id,
      title: (req.body as { title: string }).title,
      position: asNumber(positionRows[0]?.next_pos, 1),
    });
    res.status(201).json({ id });
  }),
);

instructorRouter.patch(
  '/sections/:id',
  validateBody(sectionSchema),
  asyncHandler(async (req, res) => {
    const section = await ownedSection(String(req.params.id), currentUser(req));
    await exec('UPDATE sections SET title = :title WHERE id = :id', {
      id: section.id,
      title: (req.body as { title: string }).title,
    });
    res.json({ ok: true });
  }),
);

instructorRouter.delete(
  '/sections/:id',
  asyncHandler(async (req, res) => {
    const section = await ownedSection(String(req.params.id), currentUser(req));
    await exec('DELETE FROM sections WHERE id = :id', { id: section.id });
    await syncCourseEnrollments(section.course_id);
    res.status(204).send();
  }),
);

instructorRouter.post(
  '/sections/:id/move',
  validateBody(moveSchema),
  asyncHandler(async (req, res) => {
    const section = await ownedSection(String(req.params.id), currentUser(req));
    const rows = await query<RowDataPacket & { id: string }>(
      'SELECT id FROM sections WHERE course_id = :courseId ORDER BY position ASC, created_at ASC',
      { courseId: section.course_id },
    );
    await reorder(rows.map((row) => row.id), section.id, (req.body as { direction: 'up' | 'down' }).direction, 'sections');
    res.json({ ok: true });
  }),
);

instructorRouter.post(
  '/sections/:id/lessons',
  validateBody(lessonSchema),
  asyncHandler(async (req, res) => {
    const section = await ownedSection(String(req.params.id), currentUser(req));
    const positionRows = await query<RowDataPacket & { next_pos: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM lessons WHERE section_id = :id',
      { id: section.id },
    );
    const body = req.body as LessonBody;
    const id = randomUUID();
    await exec(
      `INSERT INTO lessons (id, section_id, title, content, video_url, resource_url, duration_minutes, position, is_preview)
       VALUES (:id, :sectionId, :title, :content, :videoUrl, :resourceUrl, :durationMinutes, :position, :isPreview)`,
      {
        id,
        sectionId: section.id,
        title: body.title,
        content: body.content,
        videoUrl: emptyToNull(body.videoUrl),
        resourceUrl: emptyToNull(body.resourceUrl),
        durationMinutes: body.durationMinutes,
        position: asNumber(positionRows[0]?.next_pos, 1),
        isPreview: body.isPreview ? 1 : 0,
      },
    );
    await syncCourseEnrollments(section.course_id);
    res.status(201).json({ id });
  }),
);

instructorRouter.patch(
  '/lessons/:id',
  validateBody(lessonSchema),
  asyncHandler(async (req, res) => {
    const lesson = await ownedLesson(String(req.params.id), currentUser(req));
    const body = req.body as LessonBody;
    await exec(
      `UPDATE lessons
       SET title = :title, content = :content, video_url = :videoUrl, resource_url = :resourceUrl,
           duration_minutes = :durationMinutes, is_preview = :isPreview
       WHERE id = :id`,
      {
        id: lesson.id,
        title: body.title,
        content: body.content,
        videoUrl: emptyToNull(body.videoUrl),
        resourceUrl: emptyToNull(body.resourceUrl),
        durationMinutes: body.durationMinutes,
        isPreview: body.isPreview ? 1 : 0,
      },
    );
    res.json({ ok: true });
  }),
);

instructorRouter.delete(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const lesson = await ownedLesson(String(req.params.id), currentUser(req));
    await exec('DELETE FROM lessons WHERE id = :id', { id: lesson.id });
    await syncCourseEnrollments(lesson.course_id);
    res.status(204).send();
  }),
);

instructorRouter.post(
  '/lessons/:id/move',
  validateBody(moveSchema),
  asyncHandler(async (req, res) => {
    const lesson = await ownedLesson(String(req.params.id), currentUser(req));
    const rows = await query<RowDataPacket & { id: string }>(
      'SELECT id FROM lessons WHERE section_id = :sectionId ORDER BY position ASC, created_at ASC',
      { sectionId: lesson.section_id },
    );
    await reorder(rows.map((row) => row.id), lesson.id, (req.body as { direction: 'up' | 'down' }).direction, 'lessons');
    res.json({ ok: true });
  }),
);

instructorRouter.get(
  '/courses/:id/students',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(String(req.params.id), currentUser(req));
    const rows = await query<
      RowDataPacket & {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        status: string;
        source: string;
        progress_percent: number;
        enrolled_at: unknown;
      }
    >(
      `SELECT u.id, u.email, u.first_name, u.last_name, e.status, e.source, e.progress_percent, e.enrolled_at
       FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.course_id = :courseId
       ORDER BY e.enrolled_at DESC`,
      { courseId: course.id },
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        status: row.status,
        source: row.source,
        progressPercent: asNumber(row.progress_percent),
        enrolledAt: iso(row.enrolled_at),
      })),
    });
  }),
);

instructorRouter.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    res.json(await instructorOverview(user.role === 'instructor' ? user.id : null));
  }),
);

type CourseBody = {
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  level: string;
  language: string;
  isFree: boolean;
  price: number;
  thumbnailUrl?: string | null;
};

type LessonBody = {
  title: string;
  content: string;
  videoUrl: string;
  resourceUrl: string;
  durationMinutes: number;
  isPreview: boolean;
};

function courseParams(id: string, instructorId: string, slug: string, body: CourseBody) {
  return {
    id,
    instructorId,
    categoryId: body.categoryId,
    title: body.title,
    slug,
    subtitle: body.subtitle,
    description: body.description,
    thumbnailUrl: emptyToNull(body.thumbnailUrl),
    price: body.isFree ? 0 : body.price,
    isFree: body.isFree ? 1 : 0,
    level: body.level,
    language: body.language,
  };
}

async function assertCategory(categoryId: string) {
  const rows = await query<RowDataPacket>('SELECT id FROM categories WHERE id = :id LIMIT 1', { id: categoryId });
  if (!rows[0]) {
    throw new HttpError(400, 'Choose a valid category.', 'VALIDATION_ERROR', {
      categoryId: ['Choose a valid category.'],
    });
  }
}

async function instructorOverview(instructorId: string | null) {
  const filter = instructorId ? 'WHERE c.instructor_id = :instructorId' : '';
  const params = instructorId ? { instructorId } : {};
  const settings = await getSettings();
  const totals = await query<
    RowDataPacket & {
      courses: number;
      students: number;
      rating: number | null;
      reviews: number;
      revenue: number;
      completion_rate: number | null;
    }
  >(
    `SELECT
       (SELECT COUNT(*) FROM courses c ${filter}) AS courses,
       (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id = e.course_id ${joinFilter(filter)} AND e.status <> 'cancelled') AS students,
       (SELECT ROUND(AVG(r.rating), 2) FROM reviews r JOIN courses c ON c.id = r.course_id ${filter}) AS rating,
       (SELECT COUNT(*) FROM reviews r JOIN courses c ON c.id = r.course_id ${filter}) AS reviews,
       (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
         JOIN orders o ON o.id = p.order_id
         JOIN courses c ON c.id = o.course_id
         ${joinFilter(filter)} AND p.status = 'succeeded') AS revenue,
       (SELECT ROUND(AVG(e.progress_percent), 1) FROM enrollments e JOIN courses c ON c.id = e.course_id
         ${joinFilter(filter)} AND e.status <> 'cancelled') AS completion_rate`,
    params,
  );
  const courses = await query<
    RowDataPacket & {
      id: string;
      title: string;
      slug: string;
      status: string;
      students: number;
      rating: number | null;
      revenue: number;
      completion_rate: number | null;
    }
  >(
    `SELECT c.id, c.title, c.slug, c.status,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'cancelled') AS students,
            (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.course_id = c.id) AS rating,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN orders o ON o.id = p.order_id
              WHERE o.course_id = c.id AND p.status = 'succeeded') AS revenue,
            (SELECT ROUND(AVG(e.progress_percent), 1) FROM enrollments e
              WHERE e.course_id = c.id AND e.status <> 'cancelled') AS completion_rate
     FROM courses c
     ${filter}
     ORDER BY c.updated_at DESC`,
    params,
  );
  const row = totals[0];
  return {
    courses: asNumber(row?.courses),
    students: asNumber(row?.students),
    averageRating: asNullableNumber(row?.rating),
    reviewCount: asNumber(row?.reviews),
    completionRate: asNullableNumber(row?.completion_rate),
    revenue: {
      amount: asNumber(row?.revenue),
      currency: settings.currency,
      note: 'Revenue counts only payments confirmed by the provider.',
    },
    coursesBreakdown: courses.map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      status: course.status,
      students: asNumber(course.students),
      averageRating: asNullableNumber(course.rating),
      revenue: asNumber(course.revenue),
      completionRate: asNullableNumber(course.completion_rate),
    })),
  };
}

function joinFilter(filter: string) {
  if (!filter) return 'WHERE 1 = 1';
  return filter.replace('WHERE', 'WHERE');
}
