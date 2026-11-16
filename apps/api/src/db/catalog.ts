import type { RowDataPacket } from 'mysql2';
import { query } from './pool';
import { asBool, asNullableNumber, asNumber, iso } from '../lib/values';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'pending' | 'published' | 'rejected';

export type CourseRow = RowDataPacket & {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail_url: string | null;
  price: number;
  is_free: number;
  level: CourseLevel;
  language: string;
  status: CourseStatus;
  rejection_reason: string | null;
  created_at: unknown;
  updated_at: unknown;
  category_id: string;
  category_name: string;
  category_slug: string;
  instructor_id: string;
  instructor_first_name: string;
  instructor_last_name: string;
  instructor_headline: string | null;
  instructor_avatar_url: string | null;
  rating_average: number | null;
  rating_count: number;
  enrollment_count: number;
  lesson_count: number;
};

const courseSelect = `
  SELECT
    c.id, c.slug, c.title, c.subtitle, c.description, c.thumbnail_url, c.price, c.is_free,
    c.level, c.language, c.status, c.rejection_reason, c.created_at, c.updated_at,
    cat.id AS category_id, cat.name AS category_name, cat.slug AS category_slug,
    u.id AS instructor_id, u.first_name AS instructor_first_name, u.last_name AS instructor_last_name,
    u.headline AS instructor_headline, u.avatar_url AS instructor_avatar_url,
    (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.course_id = c.id) AS rating_average,
    (SELECT COUNT(*) FROM reviews r WHERE r.course_id = c.id) AS rating_count,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'cancelled') AS enrollment_count,
    (SELECT COUNT(*) FROM lessons l JOIN sections s ON s.id = l.section_id WHERE s.course_id = c.id) AS lesson_count
  FROM courses c
  JOIN categories cat ON cat.id = c.category_id
  JOIN users u ON u.id = c.instructor_id
`;

export function mapCourse(row: CourseRow, includeModeration = false) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? '',
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    price: asNumber(row.price),
    isFree: asBool(row.is_free),
    level: row.level,
    language: row.language,
    status: row.status,
    ...(includeModeration ? { rejectionReason: row.rejection_reason } : {}),
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    instructor: {
      id: row.instructor_id,
      firstName: row.instructor_first_name,
      lastName: row.instructor_last_name,
      headline: row.instructor_headline,
      avatarUrl: row.instructor_avatar_url,
    },
    ratingAverage: asNullableNumber(row.rating_average),
    ratingCount: asNumber(row.rating_count),
    enrollmentCount: asNumber(row.enrollment_count),
    lessonCount: asNumber(row.lesson_count),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

type ListInput = {
  search?: unknown;
  category?: unknown;
  level?: unknown;
  price?: unknown;
  sort?: unknown;
  page?: unknown;
  pageSize?: unknown;
  status?: unknown;
  instructorId?: string;
  publicOnly: boolean;
};

export async function listCourses(input: ListInput) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.publicOnly) where.push(`c.status = 'published'`);
  if (input.instructorId) {
    where.push('c.instructor_id = :instructorId');
    params.instructorId = input.instructorId;
  }
  if (
    typeof input.status === 'string' &&
    ['draft', 'pending', 'published', 'rejected'].includes(input.status) &&
    !input.publicOnly
  ) {
    where.push('c.status = :status');
    params.status = input.status;
  }
  if (typeof input.category === 'string' && input.category.trim()) {
    where.push('cat.slug = :category');
    params.category = input.category.trim();
  }
  if (typeof input.level === 'string' && ['beginner', 'intermediate', 'advanced'].includes(input.level)) {
    where.push('c.level = :level');
    params.level = input.level;
  }
  if (input.price === 'free') where.push('c.is_free = 1');
  if (input.price === 'paid') where.push('c.is_free = 0');
  if (typeof input.search === 'string' && input.search.trim()) {
    where.push('(c.title LIKE :search OR c.subtitle LIKE :search OR c.description LIKE :search)');
    params.search = `%${input.search.trim()}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sorts: Record<string, string> = {
    newest: 'c.created_at DESC',
    rating: 'rating_average DESC, c.created_at DESC',
    price_asc: 'c.price ASC, c.created_at DESC',
    price_desc: 'c.price DESC, c.created_at DESC',
    popular: 'enrollment_count DESC, c.created_at DESC',
  };
  const sort = typeof input.sort === 'string' && sorts[input.sort] ? sorts[input.sort] : sorts.newest;
  const pageSize = Math.min(48, Math.max(1, Math.trunc(Number(input.pageSize) || 12)));
  const page = Math.max(1, Math.trunc(Number(input.page) || 1));
  const offset = (page - 1) * pageSize;
  const rows = await query<CourseRow>(
    `${courseSelect} ${clause} ORDER BY ${sort} LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const totalRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
     FROM courses c
     JOIN categories cat ON cat.id = c.category_id
     JOIN users u ON u.id = c.instructor_id
     ${clause}`,
    params,
  );
  return {
    data: rows.map((row) => mapCourse(row, !input.publicOnly)),
    page,
    pageSize,
    total: asNumber(totalRows[0]?.total),
  };
}

export async function findCourseBySlug(slug: string) {
  const rows = await query<CourseRow>(`${courseSelect} WHERE c.slug = :slug LIMIT 1`, { slug });
  return rows[0] ?? null;
}

export async function findCourseById(id: string) {
  const rows = await query<CourseRow>(`${courseSelect} WHERE c.id = :id LIMIT 1`, { id });
  return rows[0] ?? null;
}
