'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LessonMedia } from '@/components/LessonMedia';
import { Badge, ErrorNote, LoadingBlock, buttonClass } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fullName, minutesLabel } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { LearningCourse, Lesson } from '@/lib/types';

export function LearnView({ slug }: { slug: string }) {
  const { token, ready } = useAuth();
  const params = useSearchParams();
  const { push } = useToast();
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (activeToken: string) => {
    const result = await api<{ course: LearningCourse }>(`/api/me/learning/${slug}`, { token: activeToken });
    setCourse(result.course);
  }, [slug]);

  useEffect(() => {
    if (!ready || !token) return;
    load(token).catch((reason) => setError(errorMessage(reason)));
  }, [ready, token, load]);

  const lessons = useMemo(() => course?.sections.flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, section: section.title }))) ?? [], [course]);
  const requested = params.get('lesson');
  const selected = lessons.find((lesson) => lesson.id === requested) ?? lessons.find((lesson) => !lesson.locked && !lesson.completed) ?? lessons.find((lesson) => !lesson.locked) ?? lessons[0];

  async function mark(lesson: Lesson, completed: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      const progress = await api<{ percent: number; complete: boolean }>('/api/me/progress', {
        method: 'POST',
        token,
        body: { lessonId: lesson.id, completed },
      });
      await load(token);
      push(progress.complete ? 'Course complete. Your certificate is ready.' : completed ? 'Lesson marked complete.' : 'Lesson marked incomplete.');
    } catch (reason) {
      push(errorMessage(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorNote message={error} />;
  if (!course) return <LoadingBlock label="Opening the course" />;
  if (!selected) {
    return (
      <div>
        <h1 className="font-display text-4xl">{course.title}</h1>
        <p className="mt-3 text-sm text-muted">This course does not have lessons yet.</p>
        <Link href={`/courses/${course.slug}`} className={`${buttonClass('secondary')} mt-4`}>Back to the course</Link>
      </div>
    );
  }

  const enrolled = Boolean(course.viewer?.enrolled);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-line bg-cream p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
        <p className="text-xs uppercase tracking-wide text-muted">Lessons</p>
        <h1 className="mt-1 font-display text-2xl leading-tight">{course.title}</h1>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full bg-pine" style={{ width: `${course.viewer?.progressPercent ?? 0}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{course.viewer?.progressPercent ?? 0}% complete</p>
        <div className="mt-4 space-y-4">
          {course.sections.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{section.title}</p>
              <div className="mt-2 space-y-1">
                {section.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/student/learn/${slug}?lesson=${lesson.id}`}
                    className={`block rounded-lg px-2 py-2 text-sm ${selected.id === lesson.id ? 'bg-pine text-white' : 'hover:bg-paper'}`}
                  >
                    <span className="block">{lesson.completed ? '✓ ' : ''}{lesson.title}</span>
                    <span className={`text-xs ${selected.id === lesson.id ? 'text-white/70' : 'text-muted'}`}>
                      {lesson.locked ? 'Locked' : minutesLabel(lesson.durationMinutes)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="rounded-2xl border border-line bg-cream p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-3xl text-ink">{selected.title}</h2>
          {selected.isPreview ? <Badge>Preview</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted">{fullName(course.instructor)}</p>
        {selected.locked ? (
          <div className="mt-6">
            <ErrorNote message="This lesson stays locked until you are enrolled." />
            <Link href={`/courses/${course.slug}`} className={`${buttonClass('primary')} mt-4`}>View enrollment options</Link>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {selected.videoUrl ? <LessonMedia url={selected.videoUrl} title={selected.title} /> : <p className="text-sm text-muted">This lesson has no video.</p>}
            {selected.content ? <div className="whitespace-pre-wrap text-sm leading-7 text-ink-soft">{selected.content}</div> : null}
            {selected.resourceUrl ? (
              <a className="inline-flex text-sm text-pine" href={selected.resourceUrl} target="_blank" rel="noreferrer">
                Open lesson resource
              </a>
            ) : null}
            {enrolled ? (
              <button className={buttonClass(selected.completed ? 'secondary' : 'primary')} type="button" disabled={busy} onClick={() => void mark(selected, !selected.completed)}>
                {selected.completed ? 'Mark incomplete' : 'Mark complete'}
              </button>
            ) : null}
            {course.viewer?.progressPercent === 100 ? (
              <Link href="/dashboard/student/certificates" className={buttonClass('secondary', 'sm')}>Open certificates</Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
