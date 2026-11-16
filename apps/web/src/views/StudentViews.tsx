'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CourseArt } from '@/components/CourseCard';
import { Badge, EmptyState, ErrorNote, LoadingBlock, buttonClass, statusTone } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, priceLabel } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/lib/toast';
import type { Certificate, Enrollment, Order } from '@/lib/types';

export function StudentHome() {
  const { token, ready } = useAuth();
  const { settings } = useSettings();
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<{ data: Enrollment[] }>('/api/me/enrollments', { token })
      .then((result) => setRows(result.data.filter((row) => row.status !== 'cancelled')))
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">My learning</h1>
      <p className="mt-2 text-sm text-muted">Progress is saved per lesson. A certificate is issued when every lesson is complete.</p>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="You have not enrolled yet"
            body="Free courses open immediately. Paid courses open after the payment provider confirms the order."
            action={<Link href="/courses" className={buttonClass('primary')}>Browse courses</Link>}
          />
        </div>
      ) : null}
      <div className="mt-6 grid gap-4">
        {rows?.map((row) => (
          <article key={row.id} className="grid gap-4 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-[160px_1fr] ">
            <div className="aspect-[16/10] overflow-hidden rounded-xl">
              <CourseArt title={row.course.title} url={row.course.thumbnailUrl} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl text-ink">{row.course.title}</h2>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{row.course.instructorName} · {priceLabel(row.course, settings.currency)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
                <div className="h-full bg-pine" style={{ width: `${Math.min(100, row.progressPercent)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">{row.completedLessons} of {row.totalLessons} lessons · {row.progressPercent}%</p>
              <Link href={`/dashboard/student/learn/${row.course.slug}`} className={`${buttonClass('primary', 'sm')} mt-4`}>
                {row.status === 'completed' ? 'Open course' : 'Continue'}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StudentCertificates() {
  const { token, ready } = useAuth();
  const [rows, setRows] = useState<Certificate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<{ data: Certificate[] }>('/api/me/certificates', { token })
      .then((result) => setRows(result.data))
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">Certificates</h1>
      <p className="mt-2 text-sm text-muted">Each code can be checked on the public verification page.</p>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No certificates yet" body="Finish every lesson in a course and the certificate is issued automatically." action={<Link className={buttonClass('primary')} href="/dashboard/student">Back to learning</Link>} />
        </div>
      ) : null}
      <div className="mt-6 grid gap-4">
        {rows?.map((certificate) => (
          <article key={certificate.code} className="rounded-2xl border border-line bg-cream p-5">
            <h2 className="font-display text-2xl">{certificate.courseTitle}</h2>
            <p className="mt-1 text-sm text-muted">Issued {formatDate(certificate.issuedAt)} · {certificate.studentName}</p>
            <p className="mt-3 font-mono text-sm">{certificate.code}</p>
            <Link href={`/certificates/${certificate.code}`} className={`${buttonClass('secondary', 'sm')} mt-4`}>View certificate</Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StudentOrders() {
  const { token, ready } = useAuth();
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const { push } = useToast();
  const [rows, setRows] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    const load = () => api<{ data: Order[] }>('/api/me/orders', { token }).then((result) => setRows(result.data));
    if (!sessionId || sessionId.includes('{')) {
      load().catch((reason) => setError(errorMessage(reason)));
      return;
    }
    api<{ paid: boolean; status: string }>('/api/payments/confirm', { method: 'POST', token, body: { sessionId } })
      .then((result) => {
        if (result.paid) {
          setNotice('Payment confirmed. The course is now in My learning.');
          push('Payment confirmed.');
        } else {
          setNotice(`The provider has not marked this checkout as paid (${result.status}).`);
        }
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => {
        load().catch((reason) => setError(errorMessage(reason)));
      });
  }, [ready, token, sessionId, push]);

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">Orders</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">An order becomes paid only after the payment provider confirms it. Card numbers are never stored by Oakline.</p>
      {notice ? <p className="mt-4 rounded-xl bg-pine-mist px-4 py-3 text-sm text-pine">{notice}</p> : null}
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="No orders" body="Free enrollments do not create a payment. Paid checkout appears here after it is started." /></div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-cream">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3"><Link className="text-pine" href={`/courses/${order.course.slug}`}>{order.course.title}</Link></td>
                  <td className="px-4 py-3">{priceLabel({ isFree: false, price: order.amount }, order.currency)}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone(order.status)}>{order.status}</Badge></td>
                  <td className="px-4 py-3">{order.payment ? `${order.payment.provider} · ${order.payment.status}` : '—'}</td>
                  <td className="px-4 py-3">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
