import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/pool';
import { getPaymentProvider } from '../src/lib/payments';

const app = createApp();

async function databaseReady() {
  try {
    await pool.query('SELECT id FROM users LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

describe('health', () => {
  it('reports whether MySQL is reachable', async () => {
    const response = await request(app).get('/api/health');
    if (await databaseReady()) {
      expect(response.status).toBe(200);
      expect(response.body.database).toBe('up');
    } else {
      expect(response.status).toBe(503);
      expect(response.body.database).toBe('down');
    }
    expect(response.body.service).toBe('oakline-api');
  });
});

describe('api flows', () => {
  const email = `test.${Date.now()}@oakline.test`;
  let token = '';
  let userId = '';

  afterAll(async () => {
    if (!userId) return;
    await pool.query('DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE user_id = :id)', {
      id: userId,
    });
    await pool.query('DELETE FROM reviews WHERE user_id = :id', { id: userId });
    await pool.query('DELETE FROM certificates WHERE user_id = :id', { id: userId });
    await pool.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = :id)', { id: userId });
    await pool.query('DELETE FROM orders WHERE user_id = :id', { id: userId });
    await pool.query('DELETE FROM enrollments WHERE user_id = :id', { id: userId });
    await pool.query('DELETE FROM users WHERE id = :id', { id: userId });
  });

  it('registers, signs in, lists published courses, and does not fake a paid checkout', async () => {
    if (!(await databaseReady())) return;

    const invalid = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'x', firstName: 'A', lastName: 'B' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const registered = await request(app).post('/api/auth/register').send({
      email,
      password: 'Learn#Oakline2026',
      firstName: 'Test',
      lastName: 'Student',
      role: 'student',
    });
    expect(registered.status).toBe(201);
    token = registered.body.token;
    userId = registered.body.user.id;

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'Learn#Oakline0000' });
    expect(wrong.status).toBe(401);

    const courses = await request(app).get('/api/courses');
    expect(courses.status).toBe(200);
    expect(courses.body.data.every((course: { status: string }) => course.status === 'published')).toBe(true);

    const missing = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(missing.status).toBe(404);

    const paid = courses.body.data.find((course: { isFree: boolean }) => !course.isFree);
    if (paid && !getPaymentProvider().isConfigured()) {
      const checkout = await request(app)
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ courseId: paid.id });
      expect(checkout.status).toBe(503);
      expect(checkout.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
      expect(checkout.body.error.message).toContain('STRIPE_SECRET_KEY');
    }

    const free = courses.body.data.find((course: { isFree: boolean }) => course.isFree);
    if (free) {
      const enrolled = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ courseId: free.id });
      expect(enrolled.status).toBe(201);
      const again = await request(app)
        .post('/api/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ courseId: free.id });
      expect(again.status).toBe(409);
    }
  });
});
