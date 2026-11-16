'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge, EmptyState, ErrorNote, Field, LoadingBlock, Panel, buttonClass, fieldClass, statusTone } from '@/components/ui';
import { ApiError, api, applyFieldErrors, errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, money, statusLabel } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Category, Course, CourseStudent, InstructorOverview, PageResult } from '@/lib/types';

const courseSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters.').max(180),
  subtitle: z.string().trim().max(180).optional().default(''),
  description: z.string().trim().min(20, 'Describe the course in at least 20 characters.').max(8000),
  categoryId: z.string().uuid('Choose a category.'),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  language: z.string().trim().min(2).max(40),
  isFree: z.boolean(),
  price: z.coerce.number().min(0).max(9999),
}).superRefine((value, ctx) => {
  if (!value.isFree && value.price < 1) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'Paid courses need a price of at least 1.' });
  }
});

type CourseInput = z.infer<typeof courseSchema>;

export function InstructorHome() {
  const { token, ready, user } = useAuth();
  const [data, setData] = useState<InstructorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<InstructorOverview>('/api/instructor/overview', { token })
      .then(setData)
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Teaching studio</h1>
          <p className="mt-2 text-sm text-muted">
            {user?.role === 'admin' ? 'Admins can manage every course from here.' : 'Draft a course, add lessons, then submit it for review.'}
          </p>
        </div>
        <Link href="/dashboard/instructor/courses/new" className={buttonClass('primary')}>New course</Link>
      </div>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Courses" value={String(data.courses)} />
            <Stat label="Learners" value={String(data.students)} />
            <Stat label="Average rating" value={data.averageRating == null ? '—' : data.averageRating.toFixed(1)} />
            <Stat label="Confirmed revenue" value={money(data.revenue.amount, data.revenue.currency)} />
          </div>
          <p className="mt-3 text-xs text-muted">{data.revenue.note}</p>
          <div className="mt-6">
            {data.coursesBreakdown.length === 0 ? (
              <EmptyState title="No courses yet" body="Create a course, add at least one lesson, and submit it for review." action={<Link className={buttonClass('primary')} href="/dashboard/instructor/courses/new">Create a course</Link>} />
            ) : (
              <CourseTable rows={data.coursesBreakdown} currency={data.revenue.currency} />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </Panel>
  );
}

function CourseTable({
  rows,
  currency,
}: {
  rows: InstructorOverview['coursesBreakdown'];
  currency: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-cream">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Course</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Learners</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3"><Link className="font-medium text-pine" href={`/dashboard/instructor/courses/${row.id}`}>{row.title}</Link></td>
              <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></td>
              <td className="px-4 py-3">{row.students}</td>
              <td className="px-4 py-3">{row.averageRating == null ? '—' : row.averageRating.toFixed(1)}</td>
              <td className="px-4 py-3">{row.completionRate == null ? '—' : `${row.completionRate}%`}</td>
              <td className="px-4 py-3">{money(row.revenue, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InstructorCourses() {
  const { token, ready } = useAuth();
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<PageResult<Course> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<PageResult<Course>>(`/api/instructor/courses${qs({ status, pageSize: 48 })}`, { token })
      .then(setResult)
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token, status]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Courses</h1>
          <p className="mt-2 text-sm text-muted">Open a course to edit its curriculum, price, and review status.</p>
        </div>
        <Link href="/dashboard/instructor/courses/new" className={buttonClass('primary')}>New course</Link>
      </div>
      <label className="mt-5 block max-w-xs text-sm">
        Status
        <select className={`${fieldClass} mt-1`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!result && !error ? <LoadingBlock /> : null}
      {result && result.data.length === 0 ? <div className="mt-6"><EmptyState title="Nothing in this filter" body="Create a course or choose another status." /></div> : null}
      <div className="mt-6 grid gap-3">
        {result?.data.map((course) => (
          <Link key={course.id} href={`/dashboard/instructor/courses/${course.id}`} className="rounded-2xl border border-line bg-cream p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl">{course.title}</p>
                <p className="text-sm text-muted">{course.category.name} · Updated {formatDate(course.updatedAt)}</p>
              </div>
              <Badge tone={statusTone(course.status)}>{course.status}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function NewCourseForm() {
  const { token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const form = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: '', subtitle: '', description: '', categoryId: '', level: 'beginner', language: 'English', isFree: true, price: 0 },
  });

  const setCategory = form.setValue;
  useEffect(() => {
    api<{ data: Category[] }>('/api/categories').then((result) => {
      setCategories(result.data);
      if (result.data[0]) setCategory('categoryId', result.data[0].id);
    }).catch((reason) => push(errorMessage(reason), 'error'));
  }, [push, setCategory]);

  return (
    <Panel>
      <h1 className="font-display text-4xl">New course</h1>
      <p className="mt-2 text-sm text-muted">A new course starts as a draft. Add lessons before you submit it.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          if (!token) return;
          try {
            const result = await api<{ course: { id: string } }>('/api/instructor/courses', {
              method: 'POST',
              token,
              body: { ...values, price: values.isFree ? 0 : values.price, thumbnailUrl: null },
            });
            push('Draft created.');
            router.push(`/dashboard/instructor/courses/${result.course.id}`);
          } catch (reason) {
            applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof CourseInput, fieldError));
            if (!(reason instanceof ApiError && reason.fields)) form.setError('root', { message: errorMessage(reason) });
          }
        })}
      >
        {form.formState.errors.root ? <ErrorNote message={form.formState.errors.root.message || 'Could not create the course.'} /> : null}
        <CourseFields form={form} categories={categories} />
        <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Create draft</button>
      </form>
    </Panel>
  );
}

export function CourseFields({
  form,
  categories,
}: {
  form: ReturnType<typeof useForm<CourseInput>>;
  categories: Category[];
}) {
  const isFree = form.watch('isFree');
  return (
    <>
      <Field label="Title" error={form.formState.errors.title?.message}>
        <input className={fieldClass} {...form.register('title')} />
      </Field>
      <Field label="Subtitle" error={form.formState.errors.subtitle?.message}>
        <input className={fieldClass} {...form.register('subtitle')} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <textarea className={fieldClass} rows={6} {...form.register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={form.formState.errors.categoryId?.message}>
          <select className={fieldClass} {...form.register('categoryId')}>
            <option value="">Choose a category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Field>
        <Field label="Level" error={form.formState.errors.level?.message}>
          <select className={fieldClass} {...form.register('level')}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
      </div>
      <Field label="Language" error={form.formState.errors.language?.message}>
        <input className={fieldClass} {...form.register('language')} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register('isFree')} />
        This course is free
      </label>
      {isFree ? null : (
        <Field label="Price" error={form.formState.errors.price?.message}>
          <input className={fieldClass} type="number" min={1} step="0.01" {...form.register('price', { valueAsNumber: true })} />
        </Field>
      )}
    </>
  );
}

export { courseSchema };
export type { CourseInput };

export function InstructorAnalytics() {
  const { token, ready } = useAuth();
  const [data, setData] = useState<InstructorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<InstructorOverview>('/api/instructor/analytics', { token })
      .then(setData)
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">Analytics</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Revenue includes only payments the provider has confirmed. Completion is the average lesson progress of active enrollments.</p>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Reviews" value={String(data.reviewCount)} />
            <Stat label="Average completion" value={data.completionRate == null ? '—' : `${data.completionRate}%`} />
            <Stat label="Confirmed revenue" value={money(data.revenue.amount, data.revenue.currency)} />
          </div>
          <CourseTable rows={data.coursesBreakdown} currency={data.revenue.currency} />
        </div>
      ) : null}
    </div>
  );
}

export function CourseStudents({ id }: { id: string }) {
  const { token, ready } = useAuth();
  const [rows, setRows] = useState<CourseStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<{ data: CourseStudent[] }>(`/api/instructor/courses/${id}/students`, { token })
      .then((result) => setRows(result.data))
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token, id]);

  return (
    <div>
      <Link href={`/dashboard/instructor/courses/${id}`} className="text-sm text-pine">Back to course</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Enrolled students</h1>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? <div className="mt-6"><EmptyState title="No enrollments" body="Students appear here after a free enrollment, a confirmed payment, or an admin grant." /></div> : null}
      {rows && rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-cream">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.id}-${row.enrolledAt}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{row.firstName} {row.lastName}<div className="text-xs text-muted">{row.email}</div></td>
                  <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
                  <td className="px-4 py-3">{row.source.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3">{row.progressPercent}%</td>
                  <td className="px-4 py-3">{formatDate(row.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
