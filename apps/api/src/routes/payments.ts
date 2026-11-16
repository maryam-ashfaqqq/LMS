import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { config, paymentNotConfiguredMessage } from '../config';
import { getSettings } from '../db/settings';
import { findCourseById } from '../db/catalog';
import { exec, query, withTransaction } from '../db/pool';
import { fulfillPaidOrder } from '../lib/fulfillment';
import { HttpError } from '../lib/httpError';
import { getPaymentProvider } from '../lib/payments';
import { asNumber } from '../lib/values';
import { currentUser, requireAuth } from '../middleware/auth';
import { asyncHandler, validateBody } from '../middleware/validate';
import { checkoutSchema, confirmPaymentSchema } from '../schemas';
import { activateEnrollment } from './learning';
import type { RowDataPacket } from 'mysql2';

export const paymentRouter = Router();

paymentRouter.get('/config', (_req, res) => {
  const provider = getPaymentProvider();
  res.json({
    provider: provider.name,
    configured: provider.isConfigured(),
    message: provider.isConfigured() ? null : paymentNotConfiguredMessage,
  });
});

paymentRouter.post(
  '/checkout',
  requireAuth,
  validateBody(checkoutSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const course = await findCourseById((req.body as { courseId: string }).courseId);
    if (!course || course.status !== 'published') throw new HttpError(404, 'Course not found.', 'NOT_FOUND');
    const existing = await query<RowDataPacket>(
      `SELECT id FROM enrollments WHERE user_id = :userId AND course_id = :courseId AND status <> 'cancelled' LIMIT 1`,
      { userId: user.id, courseId: course.id },
    );
    if (existing.length > 0) throw new HttpError(409, 'You are already enrolled in this course.', 'ALREADY_ENROLLED');
    if (course.is_free) {
      const enrollmentId = await activateEnrollment(user.id, course.id, 'free');
      res.status(201).json({ type: 'enrolled', enrollmentId });
      return;
    }
    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new HttpError(503, paymentNotConfiguredMessage, 'PAYMENT_NOT_CONFIGURED');
    }
    const settings = await getSettings();
    const orderId = randomUUID();
    const paymentId = randomUUID();
    const amount = asNumber(course.price);
    await exec(
      `INSERT INTO orders (id, user_id, course_id, amount, currency, status)
       VALUES (:id, :userId, :courseId, :amount, :currency, 'pending')`,
      { id: orderId, userId: user.id, courseId: course.id, amount, currency: settings.currency },
    );
    await exec(
      `INSERT INTO payments (id, order_id, provider, amount, currency, status)
       VALUES (:id, :orderId, :provider, :amount, :currency, 'pending')`,
      { id: paymentId, orderId, provider: provider.name, amount, currency: settings.currency },
    );
    try {
      const checkout = await provider.createCheckout({
        orderId,
        userId: user.id,
        courseId: course.id,
        email: user.email,
        courseTitle: course.title,
        courseSubtitle: course.subtitle,
        amount,
        currency: settings.currency,
        successUrl: `${config.webOrigin}/dashboard/student/orders?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${config.webOrigin}/courses/${course.slug}?checkout=cancelled`,
      });
      await exec('UPDATE payments SET provider_reference = :reference WHERE id = :id', {
        id: paymentId,
        reference: checkout.providerReference,
      });
      res.status(201).json({ type: 'checkout', url: checkout.url, orderId });
    } catch (error) {
      await exec(`UPDATE orders SET status = 'failed' WHERE id = :id`, { id: orderId });
      await exec(`UPDATE payments SET status = 'failed' WHERE id = :id`, { id: paymentId });
      const message = error instanceof Error ? error.message : 'The payment provider could not start checkout.';
      throw new HttpError(502, message, 'PAYMENT_PROVIDER_ERROR');
    }
  }),
);

paymentRouter.post(
  '/confirm',
  requireAuth,
  validateBody(confirmPaymentSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new HttpError(503, paymentNotConfiguredMessage, 'PAYMENT_NOT_CONFIGURED');
    }
    let session;
    try {
      session = await provider.retrieveSession((req.body as { sessionId: string }).sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The checkout session could not be verified.';
      throw new HttpError(400, message, 'PAYMENT_PROVIDER_ERROR');
    }
    if (!session.orderId || session.userId !== user.id) {
      throw new HttpError(403, 'This checkout does not belong to the signed-in account.', 'FORBIDDEN');
    }
    if (!session.paid) {
      res.json({ paid: false, status: session.providerStatus });
      return;
    }
    await withTransaction(async (connection) => {
      await fulfillPaidOrder(connection, session.orderId, session.providerReference);
    });
    res.json({ paid: true, status: 'paid', orderId: session.orderId });
  }),
);

export async function paymentWebhookHandler(req: Request, res: Response) {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    res.status(503).json({ error: { message: paymentNotConfiguredMessage, code: 'PAYMENT_NOT_CONFIGURED' } });
    return;
  }
  try {
    const signature = req.header('stripe-signature');
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const event = provider.readWebhook(raw, signature);
    if (event) {
      await withTransaction(async (connection) => {
        await fulfillPaidOrder(connection, event.orderId, event.providerReference);
      });
    }
    res.json({ received: true });
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'The webhook could not be verified.';
    res.status(400).json({ error: { message, code: 'WEBHOOK_INVALID' } });
  }
}
