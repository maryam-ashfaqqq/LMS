import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { findCourseBySlug, listCourses, mapCourse } from '../db/catalog';
import { exec, query } from '../db/pool';
import { getSettings } from '../db/settings';
import { HttpError } from '../lib/httpError';
import { asBool, asNumber, emptyToNull, iso } from '../lib/values';
import { optionalAuth, requireAuth, currentUser } from '../middleware/auth';
import { asyncHandler, validateBody } from '../middleware/validate';
import { reviewSchema } from '../schemas';

type LessonRow = RowDataPacket & {
  id: string;
  section_id: string;
  title: string;
  content: string;
  video_url: string | null;
  resource_url: string | null;
  duration_minutes: number;
  position: number;
  is_preview: number;
};

type SectionRow = RowDataPacket & { id: string; title: string; position: number };

export const catalogRouter = Router();

catalogRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

catalogRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const rows = await query<RowDataPacket & { published_courses: number; instructors: number; learners: number; certificates: number }>(
      `SELECT
         (SELECT COUNT(*) FROM courses WHERE status = 'published') AS published_courses,
         (SELECT COUNT(*) FROM users WHERE role = 'instructor' AND is_active = 1) AS instructors,
         (SELECT COUNT(DISTINCT user_id) FROM enrollments WHERE status <> 'cancelled') AS learners,
         (SELECT COUNT(*) FROM certificates) AS certificates`,
    );
    const row = rows[0];
    res.json({
      publishedCourses: asNumber(row?.published_courses),
      instructors: asNumber(row?.instructors),
      learners: asNumber(row?.learners),
      certificates: asNumber(row?.certificates),
    });
  }),
);

catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await query<RowDataPacket & { id: string; name: string; slug: string; description: string; course_count: number }>(
      `SELECT c.id, c.name, c.slug, c.description,
              (SELECT COUNT(*) FROM courses k WHERE k.category_id = c.id AND k.status = 'published') AS course_count
       FROM categories c
       ORDER BY c.name ASC`,
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

catalogRouter.get(
  '/instructors',
  asyncHandler(async (_req, res) => {
    const rows = await query<
      RowDataPacket & {
        id: string;
        first_name: string;
        last_name: string;
        headline: string | null;
        bio: string | null;
        avatar_url: string | null;
        course_count: number;
        student_count: number;
        rating_average: number | null;
      }
    >(
      `SELECT u.id, u.first_name, u.last_name, u.headline, u.bio, u.avatar_url,
              (SELECT COUNT(*) FROM courses c WHERE c.instructor_id = u.id AND c.status = 'published') AS course_count,
              (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id = e.course_id
                WHERE c.instructor_id = u.id AND e.status <> 'cancelled') AS student_count,
              (SELECT ROUND(AVG(r.rating), 2) FROM reviews r JOIN courses c ON c.id = r.course_id
                WHERE c.instructor_id = u.id) AS rating_average
       FROM users u
       WHERE u.role = 'instructor' AND u.is_active = 1
       ORDER BY u.first_name ASC, u.last_name ASC`,
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        headline: row.headline,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        courseCount: asNumber(row.course_count),
        studentCount: asNumber(row.student_count),
        ratingAverage: row.rating_average == null ? null : asNumber(row.rating_average),
      })),
    });
  }),
);

catalogRouter.get(
  '/instructors/:id',
  asyncHandler(async (req, res) => {
    const rows = await query<
      RowDataPacket & {
        id: string;
        first_name: string;
        last_name: string;
        headline: string | null;
        bio: string | null;
        avatar_url: string | null;
      }
    >(
      `SELECT id, first_name, last_name, headline, bio, avatar_url
       FROM users WHERE id = :id AND role = 'instructor' AND is_active = 1 LIMIT 1`,
      { id: req.params.id },
    );
    const instructor = rows[0];
    if (!instructor) throw new HttpError(404, 'Instructor not found.', 'NOT_FOUND');
    const courses = await listCourses({ publicOnly: true, instructorId: instructor.id, pageSize: 24 });
    res.json({
      instructor: {
        id: instructor.id,
        firstName: instructor.first_name,
        lastName: instructor.last_name,
        headline: instructor.headline,
        bio: instructor.bio,
        avatarUrl: instructor.avatar_url,
      },
      courses: courses.data,
    });
  }),
);

catalogRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    res.json(await listCourses({ ...req.query, publicOnly: true }));
  }),
);

catalogRouter.get(
  '/courses/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const course = await findCourseBySlug(String(req.params.slug));
    if (!course) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    const isStaff = req.user?.role === 'admin' || req.user?.id === course.instructor_id;
    if (course.status !== 'published' && !isStaff) {
      throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    }
    const detail = await buildCourseTree(course.id, {
      userId: req.user?.id,
      revealAll: Boolean(isStaff),
    });
    res.json({
      course: {
        ...mapCourse(course, Boolean(isStaff)),
        ...detail,
      },
    });
  }),
);

catalogRouter.post(
  '/courses/:slug/reviews',
  requireAuth,
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const course = await findCourseBySlug(String(req.params.slug));
    if (!course || course.status !== 'published') throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    const enrollment = await query<RowDataPacket>(
      `SELECT id FROM enrollments
       WHERE user_id = :userId AND course_id = :courseId AND status <> 'cancelled' LIMIT 1`,
      { userId: user.id, courseId: course.id },
    );
    if (enrollment.length === 0) {
      throw new HttpError(403, 'Enroll in the course before reviewing it.', 'NOT_ENROLLED');
    }
    const body = req.body as { rating: number; comment: string };
    const existing = await query<RowDataPacket & { id: string }>(
      'SELECT id FROM reviews WHERE user_id = :userId AND course_id = :courseId LIMIT 1',
      { userId: user.id, courseId: course.id },
    );
    if (existing[0]) {
      await exec('UPDATE reviews SET rating = :rating, comment = :comment WHERE id = :id', {
        id: existing[0].id,
        rating: body.rating,
        comment: emptyToNull(body.comment),
      });
    } else {
      await exec(
        `INSERT INTO reviews (id, user_id, course_id, rating, comment)
         VALUES (:id, :userId, :courseId, :rating, :comment)`,
        {
          id: randomUUID(),
          userId: user.id,
          courseId: course.id,
          rating: body.rating,
          comment: emptyToNull(body.comment),
        },
      );
    }
    res.status(existing[0] ? 200 : 201).json({ ok: true });
  }),
);

export async function buildCourseTree(
  courseId: string,
  options: { userId?: string; revealAll: boolean },
) {
  const sections = await query<SectionRow>(
    'SELECT id, title, position FROM sections WHERE course_id = :courseId ORDER BY position ASC, created_at ASC',
    { courseId },
  );
  const lessons = await query<LessonRow>(
    `SELECT l.id, l.section_id, l.title, l.content, l.video_url, l.resource_url, l.duration_minutes, l.position, l.is_preview
     FROM lessons l
     JOIN sections s ON s.id = l.section_id
     WHERE s.course_id = :courseId
     ORDER BY s.position ASC, l.position ASC`,
    { courseId },
  );
  let enrollment: RowDataPacket & { id: string; status: string; progress_percent: number; source: string } | undefined;
  let completed = new Set<string>();
  let myReview: { rating: number; comment: string | null } | null = null;
  if (options.userId) {
    const enrollmentRows = await query<RowDataPacket & { id: string; status: string; progress_percent: number; source: string }>(
      `SELECT id, status, progress_percent, source
       FROM enrollments WHERE user_id = :userId AND course_id = :courseId LIMIT 1`,
      { userId: options.userId, courseId },
    );
    enrollment = enrollmentRows[0];
    if (enrollment && enrollment.status !== 'cancelled') {
      const progress = await query<RowDataPacket & { lesson_id: string }>(
        `SELECT lesson_id FROM lesson_progress WHERE enrollment_id = :id AND completed = 1`,
        { id: enrollment.id },
      );
      completed = new Set(progress.map((row) => row.lesson_id));
    }
    const reviewRows = await query<RowDataPacket & { rating: number; comment: string | null }>(
      'SELECT rating, comment FROM reviews WHERE user_id = :userId AND course_id = :courseId LIMIT 1',
      { userId: options.userId, courseId },
    );
    if (reviewRows[0]) myReview = { rating: reviewRows[0].rating, comment: reviewRows[0].comment };
  }
  const enrolled = Boolean(enrollment && enrollment.status !== 'cancelled');
  const reviews = await query<RowDataPacket & { id: string; rating: number; comment: string | null; created_at: unknown; first_name: string; last_name: string }>(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.course_id = :courseId
     ORDER BY r.created_at DESC
     LIMIT 30`,
    { courseId },
  );
  return {
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      position: section.position,
      lessons: lessons
        .filter((lesson) => lesson.section_id === section.id)
        .map((lesson) => {
          const preview = asBool(lesson.is_preview);
          const unlocked = options.revealAll || preview || enrolled;
          return {
            id: lesson.id,
            title: lesson.title,
            position: lesson.position,
            durationMinutes: asNumber(lesson.duration_minutes),
            isPreview: preview,
            locked: !unlocked,
            completed: completed.has(lesson.id),
            videoUrl: unlocked ? lesson.video_url : null,
            content: unlocked ? lesson.content : null,
            resourceUrl: unlocked ? lesson.resource_url : null,
          };
        }),
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: iso(review.created_at),
      author: { firstName: review.first_name, lastName: review.last_name },
    })),
    viewer: options.userId
      ? {
          enrolled,
          enrollmentStatus: enrollment?.status ?? null,
          progressPercent: enrollment ? asNumber(enrollment.progress_percent) : 0,
          source: enrollment?.source ?? null,
          review: myReview,
        }
      : null,
  };
}
