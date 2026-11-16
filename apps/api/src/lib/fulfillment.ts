import { randomUUID } from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { HttpError } from './httpError';

type OrderRow = RowDataPacket & {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  amount: number;
  currency: string;
};

export async function fulfillPaidOrder(
  connection: PoolConnection,
  orderId: string,
  providerReference?: string,
): Promise<void> {
  const [orders] = await connection.query<OrderRow[]>('SELECT * FROM orders WHERE id = :id FOR UPDATE', { id: orderId });
  const order = orders[0];
  if (!order) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
  if (order.status === 'paid') return;
  if (order.status !== 'pending') {
    throw new HttpError(409, 'This order can no longer be paid.', 'ORDER_CLOSED');
  }
  await connection.query<ResultSetHeader>(`UPDATE orders SET status = 'paid' WHERE id = :id`, { id: orderId });
  const [paymentUpdate] = await connection.query<ResultSetHeader>(
    `UPDATE payments
     SET status = 'succeeded', provider_reference = COALESCE(:reference, provider_reference)
     WHERE order_id = :id`,
    { id: orderId, reference: providerReference ?? null },
  );
  if (paymentUpdate.affectedRows === 0) {
    await connection.query(
      `INSERT INTO payments (id, order_id, provider, provider_reference, amount, currency, status)
       VALUES (:id, :orderId, 'stripe', :reference, :amount, :currency, 'succeeded')`,
      {
        id: randomUUID(),
        orderId,
        reference: providerReference ?? null,
        amount: order.amount,
        currency: order.currency,
      },
    );
  }
  const [existing] = await connection.query<Array<RowDataPacket & { id: string; status: string }>>(
    `SELECT id, status FROM enrollments WHERE user_id = :userId AND course_id = :courseId FOR UPDATE`,
    { userId: order.user_id, courseId: order.course_id },
  );
  if (existing.length === 0) {
    await connection.query(
      `INSERT INTO enrollments (id, user_id, course_id, status, source, progress_percent)
       VALUES (:id, :userId, :courseId, 'active', 'payment', 0)`,
      { id: randomUUID(), userId: order.user_id, courseId: order.course_id },
    );
    return;
  }
  if (existing[0].status === 'cancelled') {
    await connection.query(
      `UPDATE enrollments SET status = 'active', source = 'payment', completed_at = NULL WHERE id = :id`,
      { id: existing[0].id },
    );
  }
}
