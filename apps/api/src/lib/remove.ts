import type { RowDataPacket } from 'mysql2';
import { exec, query } from '../db/pool';
import { HttpError } from './httpError';
import { asNumber } from './values';

export async function removeCourse(courseId: string) {
  await exec(
    `DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE course_id = :id)`,
    { id: courseId },
  );
  await exec('DELETE FROM orders WHERE course_id = :id', { id: courseId });
  await exec(
    `DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id = :id)`,
    { id: courseId },
  );
  await exec('DELETE FROM certificates WHERE course_id = :id', { id: courseId });
  await exec('DELETE FROM reviews WHERE course_id = :id', { id: courseId });
  await exec('DELETE FROM enrollments WHERE course_id = :id', { id: courseId });
  const result = await exec('DELETE FROM courses WHERE id = :id', { id: courseId });
  if (result.affectedRows === 0) throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
}

export async function removeUser(userId: string, actorId: string) {
  if (userId === actorId) {
    throw new HttpError(400, 'You cannot delete your own account.', 'SELF_UPDATE');
  }

  const rows = await query<RowDataPacket & { id: string; role: string }>(
    'SELECT id, role FROM users WHERE id = :id LIMIT 1',
    { id: userId },
  );
  const target = rows[0];
  if (!target) throw new HttpError(404, 'User not found.', 'NOT_FOUND');

  if (target.role === 'admin') {
    const admins = await query<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'admin'`,
    );
    if (asNumber(admins[0]?.total) <= 1) {
      throw new HttpError(400, 'The last admin account cannot be deleted.', 'LAST_ADMIN');
    }
  }

  const courses = await query<RowDataPacket & { id: string }>(
    'SELECT id FROM courses WHERE instructor_id = :id',
    { id: userId },
  );
  for (const course of courses) {
    await removeCourse(course.id);
  }

  await exec(
    `DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = :id)`,
    { id: userId },
  );
  await exec('DELETE FROM orders WHERE user_id = :id', { id: userId });
  await exec(
    `DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id = :id)`,
    { id: userId },
  );
  await exec('DELETE FROM certificates WHERE user_id = :id', { id: userId });
  await exec('DELETE FROM reviews WHERE user_id = :id', { id: userId });
  await exec('DELETE FROM enrollments WHERE user_id = :id', { id: userId });
  await exec('DELETE FROM users WHERE id = :id', { id: userId });
}
