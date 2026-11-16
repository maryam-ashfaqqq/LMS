import { randomBytes, randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { exec, query } from '../db/pool';

type CountRow = RowDataPacket & { total: number; done: number };

export async function syncEnrollmentProgress(enrollmentId: string, courseId: string) {
  const totals = await query<CountRow>(
    `SELECT COUNT(*) AS total
     FROM lessons l
     JOIN sections s ON s.id = l.section_id
     WHERE s.course_id = :courseId`,
    { courseId },
  );
  const doneRows = await query<CountRow>(
    `SELECT COUNT(*) AS done
     FROM lesson_progress
     WHERE enrollment_id = :enrollmentId AND completed = 1`,
    { enrollmentId },
  );
  const total = Number(totals[0]?.total ?? 0);
  const done = Number(doneRows[0]?.done ?? 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 10000) / 100;
  const complete = total > 0 && done === total;
  await exec(
    `UPDATE enrollments
     SET progress_percent = :percent,
         status = IF(status = 'cancelled', status, :status),
         completed_at = IF(:complete = 1, COALESCE(completed_at, CURRENT_TIMESTAMP), NULL)
     WHERE id = :id`,
    {
      percent,
      status: complete ? 'completed' : 'active',
      complete: complete ? 1 : 0,
      id: enrollmentId,
    },
  );
  if (complete) {
    await ensureCertificate(enrollmentId, courseId);
  } else {
    await exec('DELETE FROM certificates WHERE enrollment_id = :id', { id: enrollmentId });
  }
  return { percent, complete, total, done };
}

export async function syncCourseEnrollments(courseId: string) {
  const enrollments = await query<RowDataPacket & { id: string }>(
    `SELECT id FROM enrollments WHERE course_id = :courseId AND status <> 'cancelled'`,
    { courseId },
  );
  for (const enrollment of enrollments) {
    await syncEnrollmentProgress(enrollment.id, courseId);
  }
}

async function ensureCertificate(enrollmentId: string, courseId: string) {
  const existing = await query<RowDataPacket>(
    'SELECT id FROM certificates WHERE enrollment_id = :id LIMIT 1',
    { id: enrollmentId },
  );
  if (existing.length > 0) return;
  const enrollment = await query<RowDataPacket & { user_id: string }>(
    'SELECT user_id FROM enrollments WHERE id = :id LIMIT 1',
    { id: enrollmentId },
  );
  if (!enrollment[0]) return;
  let code = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = `OL-${randomBytes(5).toString('hex').toUpperCase()}`;
    const clash = await query<RowDataPacket>('SELECT id FROM certificates WHERE certificate_code = :code LIMIT 1', {
      code,
    });
    if (clash.length === 0) break;
  }
  await exec(
    `INSERT INTO certificates (id, enrollment_id, user_id, course_id, certificate_code)
     VALUES (:id, :enrollmentId, :userId, :courseId, :code)`,
    {
      id: randomUUID(),
      enrollmentId,
      userId: enrollment[0].user_id,
      courseId,
      code,
    },
  );
}
