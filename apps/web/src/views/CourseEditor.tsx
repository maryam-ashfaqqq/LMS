'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge, ErrorNote, Field, LoadingBlock, Modal, Panel, buttonClass, fieldClass, statusTone } from '@/components/ui';
import { ApiError, api, applyFieldErrors, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { minutesLabel } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Category, CourseDetail, Lesson } from '@/lib/types';
import { CourseFields, courseSchema, type CourseInput } from './InstructorViews';

const lessonSchema = z.object({
  title: z.string().trim().min(1, 'Enter a lesson title.').max(180),
  content: z.string().trim().max(20000).optional().default(''),
  videoUrl: z.string().trim().max(500).refine((value) => value === '' || z.string().url().safeParse(value).success, 'Enter a valid URL.').optional().default(''),
  resourceUrl: z.string().trim().max(500).refine((value) => value === '' || z.string().url().safeParse(value).success, 'Enter a valid URL.').optional().default(''),
  durationMinutes: z.coerce.number().int().min(0).max(600),
  isPreview: z.boolean(),
});

type LessonInput = z.infer<typeof lessonSchema>;

const sectionSchema = z.object({ title: z.string().trim().min(1, 'Enter a section title.').max(180) });

export function CourseEditor({ id }: { id: string }) {
  const { token, ready } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lessonTarget, setLessonTarget] = useState<{ sectionId: string; lesson?: Lesson } | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const form = useForm<CourseInput>({ resolver: zodResolver(courseSchema) });

  const resetCourse = form.reset;
  const load = useCallback(async (activeToken: string) => {
    const [detail, categoryPage] = await Promise.all([
      api<{ course: CourseDetail }>(`/api/instructor/courses/${id}`, { token: activeToken }),
      api<{ data: Category[] }>('/api/categories'),
    ]);
    setCourse(detail.course);
    setCategories(categoryPage.data);
    resetCourse({
      title: detail.course.title,
      subtitle: detail.course.subtitle,
      description: detail.course.description,
      categoryId: detail.course.category.id,
      level: detail.course.level,
      language: detail.course.language,
      isFree: detail.course.isFree,
      price: detail.course.price,
    });
  }, [id, resetCourse]);

  useEffect(() => {
    if (!ready || !token) return;
    load(token).catch((reason) => setError(errorMessage(reason)));
  }, [ready, token, load]);

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      if (token) await load(token);
      push(success);
    } catch (reason) {
      push(errorMessage(reason), 'error');
    }
  }

  if (error) return <ErrorNote message={error} />;
  if (!course || !token) return <LoadingBlock label="Loading course editor" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Slug · {course.slug}</p>
          <h1 className="font-display text-4xl text-ink">{course.title}</h1>
          <div className="mt-2"><Badge tone={statusTone(course.status)}>{course.status}</Badge></div>
          {course.rejectionReason ? <p className="mt-3 max-w-2xl text-sm text-clay-deep">Review note: {course.rejectionReason}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClass('secondary', 'sm')} href={`/dashboard/instructor/courses/${course.id}/students`}>Students</Link>
          {course.status === 'published' ? <Link className={buttonClass('secondary', 'sm')} href={`/courses/${course.slug}`}>Public page</Link> : null}
        </div>
      </div>

      <Panel>
        <h2 className="font-display text-2xl">Details</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await api(`/api/instructor/courses/${course.id}`, {
                method: 'PATCH',
                token,
                body: { ...values, price: values.isFree ? 0 : values.price, thumbnailUrl: course.thumbnailUrl },
              });
              await load(token);
              push('Course details saved.');
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof CourseInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
            }
          })}
        >
          <CourseFields form={form} categories={categories} />
          <Field label="Thumbnail" hint="PNG, JPG, WEBP, or GIF.">
            <input
              className={fieldClass}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void run(async () => {
                  const stored = await uploadFile(file, token);
                  const values = form.getValues();
                  await api(`/api/instructor/courses/${course.id}`, {
                    method: 'PATCH',
                    token,
                    body: { ...values, price: values.isFree ? 0 : Number(values.price), thumbnailUrl: stored.url },
                  });
                }, 'Thumbnail saved.');
              }}
            />
          </Field>
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" className="h-32 w-52 rounded-xl object-cover" /> : null}
          {course.thumbnailUrl ? (
            <button
              className={buttonClass('ghost', 'sm')}
              type="button"
              onClick={() => void run(async () => {
                const values = form.getValues();
                await api(`/api/instructor/courses/${course.id}`, {
                  method: 'PATCH',
                  token,
                  body: { ...values, price: values.isFree ? 0 : Number(values.price), thumbnailUrl: null },
                });
              }, 'Thumbnail removed.')}
            >
              Remove thumbnail
            </button>
          ) : null}
          <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Save details</button>
        </form>
      </Panel>

      <Panel>
        <h2 className="font-display text-2xl">Curriculum</h2>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = sectionSchema.safeParse({ title: sectionTitle });
            if (!parsed.success) {
              push(parsed.error.issues[0]?.message || 'Enter a section title.', 'error');
              return;
            }
            void run(async () => {
              await api(`/api/instructor/courses/${course.id}/sections`, { method: 'POST', token, body: parsed.data });
              setSectionTitle('');
            }, 'Section added.');
          }}
        >
          <input className={fieldClass} value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="New section title" aria-label="New section title" />
          <button className={buttonClass('secondary')} type="submit">Add section</button>
        </form>
        <div className="mt-5 space-y-4">
          {course.sections.map((section, sectionIndex) => (
            <div key={section.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle
                  title={section.title}
                  onSave={(title) => run(() => api(`/api/instructor/sections/${section.id}`, { method: 'PATCH', token, body: { title } }).then(() => undefined), 'Section renamed.')}
                />
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClass('ghost', 'sm')} type="button" disabled={sectionIndex === 0} onClick={() => void run(() => api(`/api/instructor/sections/${section.id}/move`, { method: 'POST', token, body: { direction: 'up' } }).then(() => undefined), 'Section moved.')}>Up</button>
                  <button className={buttonClass('ghost', 'sm')} type="button" disabled={sectionIndex === course.sections.length - 1} onClick={() => void run(() => api(`/api/instructor/sections/${section.id}/move`, { method: 'POST', token, body: { direction: 'down' } }).then(() => undefined), 'Section moved.')}>Down</button>
                  <button className={buttonClass('danger', 'sm')} type="button" onClick={() => {
                    if (window.confirm('Delete this section and its lessons?')) {
                      void run(() => api(`/api/instructor/sections/${section.id}`, { method: 'DELETE', token }).then(() => undefined), 'Section deleted.');
                    }
                  }}>Delete</button>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {section.lessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-xs text-muted">{minutesLabel(lesson.durationMinutes)}{lesson.isPreview ? ' · Preview' : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={buttonClass('ghost', 'sm')} type="button" onClick={() => setLessonTarget({ sectionId: section.id, lesson })}>Edit</button>
                      <button className={buttonClass('ghost', 'sm')} type="button" disabled={lessonIndex === 0} onClick={() => void run(() => api(`/api/instructor/lessons/${lesson.id}/move`, { method: 'POST', token, body: { direction: 'up' } }).then(() => undefined), 'Lesson moved.')}>Up</button>
                      <button className={buttonClass('ghost', 'sm')} type="button" disabled={lessonIndex === section.lessons.length - 1} onClick={() => void run(() => api(`/api/instructor/lessons/${lesson.id}/move`, { method: 'POST', token, body: { direction: 'down' } }).then(() => undefined), 'Lesson moved.')}>Down</button>
                      <button className={buttonClass('danger', 'sm')} type="button" onClick={() => {
                        if (window.confirm('Delete this lesson?')) {
                          void run(() => api(`/api/instructor/lessons/${lesson.id}`, { method: 'DELETE', token }).then(() => undefined), 'Lesson deleted.');
                        }
                      }}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button className={`${buttonClass('secondary', 'sm')} mt-3`} type="button" onClick={() => setLessonTarget({ sectionId: section.id })}>Add lesson</button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="font-display text-2xl">Review</h2>
        <p className="mt-2 text-sm text-muted">Submit when the course has at least one lesson. An admin publishes or rejects it. Deleting a course removes it and its enrollments from the live database.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {course.status === 'draft' || course.status === 'rejected' ? (
            <button className={buttonClass('primary')} type="button" onClick={() => void run(() => api(`/api/instructor/courses/${course.id}/submit`, { method: 'POST', token }).then(() => undefined), 'Submitted for review.')}>Submit for review</button>
          ) : null}
          <button
            className={buttonClass('danger')}
            type="button"
            onClick={() => {
              if (!window.confirm('Delete this course? This cannot be undone.')) return;
              void api(`/api/instructor/courses/${course.id}`, { method: 'DELETE', token })
                .then(() => {
                  push('Course deleted.');
                  router.push('/dashboard/instructor/courses');
                })
                .catch((reason) => push(errorMessage(reason), 'error'));
            }}
          >
            Delete course
          </button>
        </div>
      </Panel>

      {lessonTarget ? (
        <LessonDialog
          token={token}
          target={lessonTarget}
          onClose={() => setLessonTarget(null)}
          onSaved={async () => {
            setLessonTarget(null);
            await load(token);
          }}
        />
      ) : null}
    </div>
  );
}

function SectionTitle({ title, onSave }: { title: string; onSave: (title: string) => Promise<void> }) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  return (
    <form className="flex flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); void onSave(value); }}>
      <input className={fieldClass} value={value} aria-label="Section title" onChange={(event) => setValue(event.target.value)} />
      <button className={buttonClass('secondary', 'sm')} type="submit">Rename</button>
    </form>
  );
}

function LessonDialog({
  token,
  target,
  onClose,
  onSaved,
}: {
  token: string;
  target: { sectionId: string; lesson?: Lesson };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { push } = useToast();
  const form = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: target.lesson?.title ?? '',
      content: target.lesson?.content ?? '',
      videoUrl: target.lesson?.videoUrl ?? '',
      resourceUrl: target.lesson?.resourceUrl ?? '',
      durationMinutes: target.lesson?.durationMinutes ?? 0,
      isPreview: target.lesson?.isPreview ?? false,
    },
  });

  return (
    <Modal title={target.lesson ? 'Edit lesson' : 'Add lesson'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            if (target.lesson) {
              await api(`/api/instructor/lessons/${target.lesson.id}`, { method: 'PATCH', token, body: values });
            } else {
              await api(`/api/instructor/sections/${target.sectionId}/lessons`, { method: 'POST', token, body: values });
            }
            push(target.lesson ? 'Lesson saved.' : 'Lesson added.');
            await onSaved();
          } catch (reason) {
            applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof LessonInput, fieldError));
            if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
          }
        })}
      >
        <Field label="Title" error={form.formState.errors.title?.message}>
          <input className={fieldClass} {...form.register('title')} />
        </Field>
        <Field label="Lesson notes" error={form.formState.errors.content?.message}>
          <textarea className={fieldClass} rows={5} {...form.register('content')} />
        </Field>
        <Field label="Video URL" hint="YouTube, Vimeo, or a direct .mp4 link." error={form.formState.errors.videoUrl?.message}>
          <input className={fieldClass} placeholder="https://" {...form.register('videoUrl')} />
        </Field>
        <Field label="Resource" hint="Paste a URL or upload a PDF or ZIP." error={form.formState.errors.resourceUrl?.message}>
          <input className={fieldClass} placeholder="https://" {...form.register('resourceUrl')} />
          <input
            className={`${fieldClass} mt-2`}
            type="file"
            accept="application/pdf,application/zip,image/png,image/jpeg,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const stored = await uploadFile(file, token);
                form.setValue('resourceUrl', stored.url);
                push('Resource uploaded. Save the lesson to keep it.');
              } catch (reason) {
                push(errorMessage(reason), 'error');
              }
            }}
          />
        </Field>
        <Field label="Duration in minutes" error={form.formState.errors.durationMinutes?.message}>
          <input className={fieldClass} type="number" min={0} {...form.register('durationMinutes', { valueAsNumber: true })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('isPreview')} />
          Available as a free preview
        </label>
        <div className="flex justify-end gap-2">
          <button className={buttonClass('ghost')} type="button" onClick={onClose}>Cancel</button>
          <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Save lesson</button>
        </div>
      </form>
    </Modal>
  );
}
