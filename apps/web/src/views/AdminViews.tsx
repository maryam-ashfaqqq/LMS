'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge, EmptyState, ErrorNote, Field, LoadingBlock, Modal, Panel, buttonClass, fieldClass, statusTone } from '@/components/ui';
import { ApiError, api, applyFieldErrors, errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, money, pageCount, statusLabel } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { AdminEnrollment, AdminPayment, AdminUser, Category, Course, PageResult, PaymentConfig, PublicSettings } from '@/lib/types';

type Overview = {
  users: { total: number; students: number; instructors: number; admins: number };
  courses: { draft: number; pending: number; published: number; rejected: number };
  enrollments: { active: number; completed: number; cancelled: number };
  certificates: number;
  revenue: { amount: number; currency: string; note: string };
  recentUsers: AdminUser[];
  recentCourses: Course[];
};

export function AdminHome() {
  const { token, ready } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    api<Overview>('/api/admin/overview', { token }).then(setData).catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <LoadingBlock label="Loading the platform" />;

  const cards = [
    ['People', String(data.users.total), `${data.users.students} students · ${data.users.instructors} instructors`],
    ['Published', String(data.courses.published), `${data.courses.pending} waiting for review`],
    ['Active learning', String(data.enrollments.active), `${data.enrollments.completed} completed`],
    ['Confirmed revenue', money(data.revenue.amount, data.revenue.currency), data.revenue.note],
  ];

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">Platform</h1>
      <p className="mt-2 text-sm text-muted">{data.certificates} certificates have been issued.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => (
          <Panel key={label}>
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Recent people</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentUsers.map((person) => (
              <li key={person.id} className="flex justify-between gap-3">
                <span>{person.firstName} {person.lastName}</span>
                <span className="text-muted">{person.role}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/admin/users" className={`${buttonClass('secondary', 'sm')} mt-4`}>Manage users</Link>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Recent courses</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentCourses.map((course) => (
              <li key={course.id} className="flex justify-between gap-3">
                <span>{course.title}</span>
                <Badge tone={statusTone(course.status)}>{course.status}</Badge>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/admin/courses" className={`${buttonClass('secondary', 'sm')} mt-4`}>Review courses</Link>
        </Panel>
      </div>
    </div>
  );
}

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).regex(/[A-Za-z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.'),
  role: z.enum(['admin', 'instructor', 'student']),
});
type UserInput = z.infer<typeof userSchema>;

export function AdminUsers() {
  const { token, ready, user } = useAuth();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState({ search: '', role: '', page: 1 });
  const [result, setResult] = useState<PageResult<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const form = useForm<UserInput>({ resolver: zodResolver(userSchema), defaultValues: { firstName: '', lastName: '', email: '', password: '', role: 'student' } });

  const reload = useCallback(() => {
    if (!token) return;
    api<PageResult<AdminUser>>(`/api/admin/users${qs({ search: query.search, role: query.role, page: query.page, pageSize: 20 })}`, { token })
      .then(setResult)
      .catch((reason) => setError(errorMessage(reason)));
  }, [token, query]);

  useEffect(() => {
    if (!ready || !token) return;
    reload();
  }, [ready, token, reload]);

  async function patch(id: string, body: { role?: string; isActive?: boolean }) {
    if (!token) return;
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', token, body });
      push('User updated.');
      reload();
    } catch (reason) {
      push(errorMessage(reason), 'error');
    }
  }

  const pages = pageCount(result?.total ?? 0, result?.pageSize ?? 20);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Users</h1>
          <p className="mt-2 text-sm text-muted">Create accounts, change roles, or delete them. Deleted accounts are removed from the live database. You cannot delete your own account.</p>
        </div>
        <button className={buttonClass('primary')} type="button" onClick={() => setOpen(true)}>New user</button>
      </div>
      <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setQuery({ search, role, page: 1 }); setPage(1); }}>
        <input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search users" />
        <select className={fieldClass} value={role} aria-label="Role" onChange={(event) => setRole(event.target.value)}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
          <option value="admin">Admins</option>
        </select>
        <button className={buttonClass('secondary')} type="submit">Apply</button>
      </form>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!result && !error ? <LoadingBlock /> : null}
      {result && result.data.length === 0 ? <div className="mt-6"><EmptyState title="No matching users" body="Try another name, email, or role." /></div> : null}
      <div className="mt-5 space-y-3">
        {result?.data.map((person) => (
          <article key={person.id} className="rounded-2xl border border-line bg-cream p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{person.firstName} {person.lastName}</p>
                <p className="text-sm text-muted">{person.email}</p>
                <p className="mt-1 text-xs text-muted">Joined {formatDate(person.createdAt)} · Last sign-in {formatDate(person.lastLoginAt)}</p>
              </div>
              <Badge tone={person.isActive ? 'good' : 'bad'}>{person.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select className={`${fieldClass} max-w-[10rem]`} defaultValue={person.role} aria-label={`Role for ${person.email}`} id={`role-${person.id}`}>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
              <button className={buttonClass('secondary', 'sm')} type="button" onClick={() => {
                const selected = (document.getElementById(`role-${person.id}`) as HTMLSelectElement | null)?.value;
                if (selected) void patch(person.id, { role: selected });
              }}>Save role</button>
              <button className={buttonClass(person.isActive ? 'danger' : 'primary', 'sm')} type="button" disabled={person.id === user?.id && person.isActive} onClick={() => void patch(person.id, { isActive: !person.isActive })}>
                {person.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className={buttonClass('danger', 'sm')} type="button" disabled={person.id === user?.id} onClick={() => {
                if (!token || !window.confirm(`Delete ${person.email}? This removes the account and its courses from the live database.`)) return;
                void api(`/api/admin/users/${person.id}`, { method: 'DELETE', token })
                  .then(() => { push('User deleted.'); reload(); })
                  .catch((reason) => push(errorMessage(reason), 'error'));
              }}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {result && result.total > result.pageSize ? (
        <div className="mt-4 flex gap-2">
          <button className={buttonClass('secondary', 'sm')} type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); setQuery((current) => ({ ...current, page: next })); }}>Previous</button>
          <span className="px-2 py-2 text-sm text-muted">Page {page} of {pages}</span>
          <button className={buttonClass('secondary', 'sm')} type="button" disabled={page >= pages} onClick={() => { const next = page + 1; setPage(next); setQuery((current) => ({ ...current, page: next })); }}>Next</button>
        </div>
      ) : null}
      {open ? (
        <Modal title="New user" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
            if (!token) return;
            try {
              await api('/api/admin/users', { method: 'POST', token, body: values });
              push('User created.');
              setOpen(false);
              form.reset();
              reload();
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof UserInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) form.setError('root', { message: errorMessage(reason) });
            }
          })}>
            {form.formState.errors.root ? <ErrorNote message={form.formState.errors.root.message || 'Could not create the user.'} /> : null}
            <Field label="First name" error={form.formState.errors.firstName?.message}><input className={fieldClass} {...form.register('firstName')} /></Field>
            <Field label="Last name" error={form.formState.errors.lastName?.message}><input className={fieldClass} {...form.register('lastName')} /></Field>
            <Field label="Email" error={form.formState.errors.email?.message}><input className={fieldClass} type="email" {...form.register('email')} /></Field>
            <Field label="Password" error={form.formState.errors.password?.message} hint="At least 8 characters, with a letter and a number."><input className={fieldClass} type="password" {...form.register('password')} /></Field>
            <Field label="Role" error={form.formState.errors.role?.message}>
              <select className={fieldClass} {...form.register('role')}>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Create user</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export function AdminCourses() {
  const { token, ready } = useAuth();
  const { push } = useToast();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Course | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    api<PageResult<Course>>(`/api/admin/courses${qs({ status, pageSize: 48 })}`, { token })
      .then((result) => setRows(result.data))
      .catch((err) => setError(errorMessage(err)));
  }, [token, status]);

  useEffect(() => {
    if (!ready || !token) return;
    load();
  }, [ready, token, load]);

  async function act(path: string, body?: unknown, message?: string) {
    if (!token) return;
    try {
      await api(path, { method: 'POST', token, body });
      push(message || 'Updated.');
      setRejecting(null);
      setReason('');
      load();
    } catch (reasonError) {
      push(errorMessage(reasonError), 'error');
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Courses</h1>
      <p className="mt-2 text-sm text-muted">Approve a submitted course to publish it. Reject it with a note the instructor can read.</p>
      <label className="mt-4 block max-w-xs text-sm">
        Status
        <select className={`${fieldClass} mt-1`} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending review</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? <div className="mt-6"><EmptyState title="No courses in this state" body="Submitted courses land in Pending review." /></div> : null}
      <div className="mt-5 space-y-3">
        {rows?.map((course) => (
          <article key={course.id} className="rounded-2xl border border-line bg-cream p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl">{course.title}</p>
                <p className="text-sm text-muted">{course.instructor.firstName} {course.instructor.lastName} · {course.category.name}</p>
                {course.rejectionReason ? <p className="mt-2 text-sm text-red-700">{course.rejectionReason}</p> : null}
              </div>
              <Badge tone={statusTone(course.status)}>{statusLabel(course.status)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {course.status === 'published' ? <Link className={buttonClass('secondary', 'sm')} href={`/courses/${course.slug}`}>Open</Link> : null}
              {course.status !== 'draft' && course.status !== 'published' ? (
                <button className={buttonClass('primary', 'sm')} type="button" onClick={() => void act(`/api/admin/courses/${course.id}/approve`, undefined, 'Course published.')}>Approve</button>
              ) : null}
              {course.status !== 'draft' && course.status !== 'rejected' ? (
                <button className={buttonClass('danger', 'sm')} type="button" onClick={() => { setRejecting(course); setReason(''); }}>Reject</button>
              ) : null}
              {course.status === 'published' ? (
                <button className={buttonClass('secondary', 'sm')} type="button" onClick={() => void act(`/api/admin/courses/${course.id}/unpublish`, undefined, 'Course returned to draft.')}>Unpublish</button>
              ) : null}
              <button className={buttonClass('danger', 'sm')} type="button" onClick={() => {
                if (!token || !window.confirm(`Delete ${course.title}? This removes the course from the live database.`)) return;
                void api(`/api/admin/courses/${course.id}`, { method: 'DELETE', token })
                  .then(() => { push('Course deleted.'); load(); })
                  .catch((reason) => push(errorMessage(reason), 'error'));
              }}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {rejecting ? (
        <Modal title={`Reject ${rejecting.title}`} onClose={() => setRejecting(null)}>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length < 3) {
              push('Add a short reason.', 'error');
              return;
            }
            void act(`/api/admin/courses/${rejecting.id}/reject`, { reason: reason.trim() }, 'Course rejected.');
          }}>
            <Field label="Reason">
              <textarea className={fieldClass} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <button className={buttonClass('danger')} type="submit">Reject course</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  description: z.string().trim().max(500).optional().default(''),
});
type CategoryInput = z.infer<typeof categorySchema>;

export function AdminCategories() {
  const { token, ready } = useAuth();
  const { push } = useToast();
  const [rows, setRows] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const form = useForm<CategoryInput>({ resolver: zodResolver(categorySchema), defaultValues: { name: '', description: '' } });

  const load = useCallback(() => {
    if (!token) return;
    api<{ data: Category[] }>('/api/admin/categories', { token }).then((result) => setRows(result.data)).catch((reason) => setError(errorMessage(reason)));
  }, [token]);
  useEffect(() => { if (ready && token) load(); }, [ready, token, load]);

  return (
    <div>
      <h1 className="font-display text-4xl">Categories</h1>
      <Panel className="mt-5">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={form.handleSubmit(async (values) => {
          if (!token) return;
          try {
            await api('/api/admin/categories', { method: 'POST', token, body: values });
            form.reset();
            push('Category created.');
            load();
          } catch (reason) {
            applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof CategoryInput, fieldError));
            if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
          }
        })}>
          <Field label="Name" error={form.formState.errors.name?.message}><input className={fieldClass} {...form.register('name')} /></Field>
          <Field label="Description" error={form.formState.errors.description?.message}><input className={fieldClass} {...form.register('description')} /></Field>
          <button className={`${buttonClass('primary')} md:self-end`} type="submit">Add</button>
        </form>
      </Panel>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      <div className="mt-4 space-y-3">
        {rows?.map((category) => (
          <article key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-cream p-4">
            <div>
              <p className="font-medium">{category.name}</p>
              <p className="text-sm text-muted">{category.description || 'No description'} · {category.courseCount} courses</p>
            </div>
            <div className="flex gap-2">
              <button className={buttonClass('secondary', 'sm')} type="button" onClick={() => setEditing(category)}>Edit</button>
              <button className={buttonClass('danger', 'sm')} type="button" onClick={() => {
                if (!token || !window.confirm('Delete this category?')) return;
                void api(`/api/admin/categories/${category.id}`, { method: 'DELETE', token })
                  .then(() => { push('Category deleted.'); load(); })
                  .catch((reason) => push(errorMessage(reason), 'error'));
              }}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <EditCategory category={editing} token={token || ''} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      ) : null}
    </div>
  );
}

function EditCategory({ category, token, onClose, onSaved }: { category: Category; token: string; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const form = useForm<CategoryInput>({ resolver: zodResolver(categorySchema), defaultValues: { name: category.name, description: category.description } });
  return (
    <Modal title="Edit category" onClose={onClose}>
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          await api(`/api/admin/categories/${category.id}`, { method: 'PATCH', token, body: values });
          push('Category saved.');
          onSaved();
        } catch (reason) {
          push(errorMessage(reason), 'error');
        }
      })}>
        <Field label="Name" error={form.formState.errors.name?.message}><input className={fieldClass} {...form.register('name')} /></Field>
        <Field label="Description" error={form.formState.errors.description?.message}><textarea className={fieldClass} rows={3} {...form.register('description')} /></Field>
        <button className={buttonClass('primary')} type="submit">Save</button>
      </form>
    </Modal>
  );
}

const grantSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  courseSlug: z.string().trim().min(1, 'Choose a course.'),
});
type GrantInput = z.infer<typeof grantSchema>;

export function AdminEnrollments() {
  const { token, ready } = useAuth();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ search: '', status: '' });
  const [rows, setRows] = useState<AdminEnrollment[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<GrantInput>({ resolver: zodResolver(grantSchema), defaultValues: { email: '', courseSlug: '' } });

  const load = useCallback(() => {
    if (!token) return;
    api<{ data: AdminEnrollment[] }>(`/api/admin/enrollments${qs(applied)}`, { token })
      .then((result) => setRows(result.data))
      .catch((reason) => setError(errorMessage(reason)));
  }, [token, applied]);
  useEffect(() => { if (ready && token) load(); }, [ready, token, load]);
  useEffect(() => {
    if (!ready || !token) return;
    api<PageResult<Course>>('/api/admin/courses?status=published&pageSize=48', { token })
      .then((result) => setCourses(result.data))
      .catch(() => setCourses([]));
  }, [ready, token]);

  return (
    <div>
      <h1 className="font-display text-4xl">Enrollments</h1>
      <p className="mt-2 text-sm text-muted">An admin grant opens a course without creating a payment.</p>
      <Panel className="mt-5">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={form.handleSubmit(async (values) => {
          if (!token) return;
          try {
            await api('/api/admin/enrollments', { method: 'POST', token, body: values });
            push('Enrollment granted.');
            form.reset();
            load();
          } catch (reason) {
            applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof GrantInput, fieldError));
            if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
          }
        })}>
          <Field label="Student email" error={form.formState.errors.email?.message}><input className={fieldClass} type="email" {...form.register('email')} /></Field>
          <Field label="Published course" error={form.formState.errors.courseSlug?.message}>
            <select className={fieldClass} {...form.register('courseSlug')}>
              <option value="">Choose a course</option>
              {courses.map((course) => <option key={course.id} value={course.slug}>{course.title}</option>)}
            </select>
          </Field>
          <button className={`${buttonClass('primary')} md:self-end`} type="submit">Grant access</button>
        </form>
      </Panel>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setApplied({ search, status }); }}>
        <input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or course" aria-label="Search enrollments" />
        <select className={fieldClass} value={status} aria-label="Enrollment status" onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={buttonClass('secondary')} type="submit">Filter</button>
      </form>
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? <div className="mt-6"><EmptyState title="No enrollments" body="Grants and student enrollments will show in this list." /></div> : null}
      <div className="mt-4 space-y-3">
        {rows?.map((row) => (
          <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-cream p-4 text-sm">
            <div>
              <p className="font-medium">{row.student.firstName} {row.student.lastName} · {row.course.title}</p>
              <p className="text-muted">{row.student.email} · {row.source.replaceAll('_', ' ')} · {row.progressPercent}% · {formatDate(row.enrolledAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              <button className={buttonClass(row.status === 'cancelled' ? 'primary' : 'danger', 'sm')} type="button" onClick={() => {
                if (!token) return;
                const next = row.status === 'cancelled' ? 'active' : 'cancelled';
                void api(`/api/admin/enrollments/${row.id}`, { method: 'PATCH', token, body: { status: next } })
                  .then(() => { push(next === 'cancelled' ? 'Enrollment cancelled.' : 'Enrollment restored.'); load(); })
                  .catch((reason) => push(errorMessage(reason), 'error'));
              }}>{row.status === 'cancelled' ? 'Restore' : 'Cancel'}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminPayments() {
  const { token, ready } = useAuth();
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    Promise.all([
      api<{ data: AdminPayment[] }>('/api/admin/payments', { token }),
      api<PaymentConfig>('/api/payments/config'),
    ]).then(([payments, paymentConfig]) => {
      setRows(payments.data);
      setConfig(paymentConfig);
    }).catch((reason) => setError(errorMessage(reason)));
  }, [ready, token]);

  return (
    <div>
      <h1 className="font-display text-4xl">Payments</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Oakline stores provider references and amounts. It does not store card numbers, and it does not mark an order paid unless the provider confirms it.</p>
      {config ? (
        <Panel className="mt-5">
          <p className="text-sm">Provider: <span className="font-medium">{config.provider}</span></p>
          <p className="mt-1 text-sm">{config.configured ? 'Sandbox checkout is configured.' : config.message}</p>
        </Panel>
      ) : null}
      {error ? <div className="mt-4"><ErrorNote message={error} /></div> : null}
      {!rows && !error ? <LoadingBlock /> : null}
      {rows && rows.length === 0 ? <div className="mt-6"><EmptyState title="No payment records" body="A record appears when a learner starts checkout for a paid course." /></div> : null}
      {rows && rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-cream">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{row.courseTitle}</td>
                  <td className="px-4 py-3">{row.studentEmail}</td>
                  <td className="px-4 py-3">{money(row.amount, row.currency)}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{row.provider} · {row.status}</Badge></td>
                  <td className="px-4 py-3">{row.orderStatus}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.providerReference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const settingsSchema = z.object({
  site_name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(180),
  support_email: z.string().trim().max(255).refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email.'),
  allow_instructor_registration: z.enum(['true', 'false']),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code.'),
});
type SettingsInput = z.infer<typeof settingsSchema>;

export function AdminSettings() {
  const { token, ready } = useAuth();
  const { push } = useToast();
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });
  const [error, setError] = useState<string | null>(null);

  const resetSettings = form.reset;
  useEffect(() => {
    if (!ready || !token) return;
    api<{ settings: PublicSettings }>('/api/admin/settings', { token })
      .then((result) => resetSettings({
        site_name: result.settings.site_name,
        tagline: result.settings.tagline,
        support_email: result.settings.support_email,
        allow_instructor_registration: result.settings.allow_instructor_registration === 'false' ? 'false' : 'true',
        currency: result.settings.currency,
      }))
      .catch((reason) => setError(errorMessage(reason)));
  }, [ready, token, resetSettings]);

  if (error) return <ErrorNote message={error} />;

  return (
    <Panel className="max-w-2xl">
      <h1 className="font-display text-4xl">Platform settings</h1>
      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(async (values) => {
        if (!token) return;
        try {
          await api('/api/admin/settings', { method: 'PUT', token, body: values });
          push('Settings saved. Refresh to update the public site name.');
        } catch (reason) {
          applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof SettingsInput, fieldError));
          if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
        }
      })}>
        <Field label="Site name" error={form.formState.errors.site_name?.message}><input className={fieldClass} {...form.register('site_name')} /></Field>
        <Field label="Tagline" error={form.formState.errors.tagline?.message}><input className={fieldClass} {...form.register('tagline')} /></Field>
        <Field label="Support email" error={form.formState.errors.support_email?.message}><input className={fieldClass} type="email" {...form.register('support_email')} /></Field>
        <Field label="Instructor registration" error={form.formState.errors.allow_instructor_registration?.message}>
          <select className={fieldClass} {...form.register('allow_instructor_registration')}>
            <option value="true">Open</option>
            <option value="false">Closed</option>
          </select>
        </Field>
        <Field label="Currency" error={form.formState.errors.currency?.message} hint="ISO code such as USD. This labels prices. It does not convert them.">
          <input className={fieldClass} {...form.register('currency')} />
        </Field>
        <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Save settings</button>
      </form>
    </Panel>
  );
}
