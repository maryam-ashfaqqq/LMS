'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { SiteFrame } from '@/components/SiteChrome';
import { CourseArt, Stars } from '@/components/CourseCard';
import { Badge, ErrorNote, Field, LoadingBlock, buttonClass, fieldClass, statusTone } from '@/components/ui';
import { ApiError, api, applyFieldErrors, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, fullName, levelLabel, minutesLabel, priceLabel } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/lib/toast';
import type { CourseDetail, PaymentConfig } from '@/lib/types';

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
  comment: z.string().trim().max(2000).optional().default(''),
});

type ReviewInput = z.infer<typeof reviewSchema>;

export function CourseDetailView({ slug }: { slug: string }) {
  const { token, user, ready } = useAuth();
  const { settings } = useSettings();
  const { push } = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [payments, setPayments] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const form = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: 5, comment: '' } });
  const resetReview = form.reset;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api<{ course: CourseDetail }>(`/api/courses/${slug}`, { token }),
      api<PaymentConfig>('/api/payments/config'),
    ])
      .then(([detail, config]) => {
        if (!active) return;
        setCourse(detail.course);
        setPayments(config);
        if (detail.course.viewer?.review) {
          resetReview({
            rating: detail.course.viewer.review.rating,
            comment: detail.course.viewer.review.comment ?? '',
          });
        }
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ready, slug, token, resetReview]);

  async function enroll() {
    if (!course) return;
    if (!user || !token) {
      router.push(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
      return;
    }
    setBusy(true);
    try {
      if (course.isFree) {
        await api('/api/enrollments', { method: 'POST', token, body: { courseId: course.id } });
        push('You are enrolled. The lessons are open.');
        router.push(`/dashboard/student/learn/${course.slug}`);
        return;
      }
      const checkout = await api<{ type: string; url?: string; enrollmentId?: string }>('/api/payments/checkout', {
        method: 'POST',
        token,
        body: { courseId: course.id },
      });
      if (checkout.type === 'checkout' && checkout.url) {
        window.location.href = checkout.url;
        return;
      }
      push('You are enrolled.');
      router.push(`/dashboard/student/learn/${course.slug}`);
    } catch (reason) {
      push(errorMessage(reason), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveReview(values: ReviewInput) {
    if (!token) return;
    try {
      await api(`/api/courses/${slug}/reviews`, { method: 'POST', token, body: values });
      push('Review saved.');
      const detail = await api<{ course: CourseDetail }>(`/api/courses/${slug}`, { token });
      setCourse(detail.course);
    } catch (reason) {
      applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof ReviewInput, fieldError));
      if (!(reason instanceof ApiError && reason.fields)) push(errorMessage(reason), 'error');
    }
  }

  return (
    <SiteFrame>
      <div className="mx-auto max-w-6xl px-5 py-10">
        {loading ? <LoadingBlock label="Loading course" /> : null}
        {error ? <ErrorNote message={error} /> : null}
        {search.get('checkout') === 'cancelled' ? (
          <div className="mb-6"><ErrorNote message="Checkout was cancelled. The course stays locked until a payment is confirmed." /></div>
        ) : null}
        {course ? (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <div className="overflow-hidden rounded-[28px] border border-line">
                <div className="aspect-[16/8]">
                  <CourseArt title={course.title} url={course.thumbnailUrl} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
                <Link href={`/courses?category=${course.category.slug}`} className="text-pine">{course.category.name}</Link>
                <span>·</span>
                <span>{levelLabel(course.level)}</span>
                <span>·</span>
                <span>{course.language}</span>
                <Stars value={course.ratingAverage} />
                <span>{course.ratingCount} reviews</span>
              </div>
              <h1 className="mt-3 font-display text-5xl leading-tight text-ink">{course.title}</h1>
              <p className="mt-3 text-lg text-ink-soft">{course.subtitle}</p>
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{course.description}</p>

              <h2 className="mt-10 font-display text-3xl">Curriculum</h2>
              <div className="mt-4 space-y-3">
                {course.sections.map((section) => (
                  <details key={section.id} open className="rounded-2xl border border-line bg-cream p-4">
                    <summary className="cursor-pointer font-medium">{section.title}</summary>
                    <ul className="mt-3 space-y-2">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            {lesson.locked ? <Lock className="h-4 w-4 text-muted" /> : null}
                            {lesson.title}
                            {lesson.isPreview ? <Badge>Preview</Badge> : null}
                          </span>
                          <span className="text-muted">{minutesLabel(lesson.durationMinutes)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                {course.sections.length === 0 ? <p className="text-sm text-muted">The instructor has not published lessons yet.</p> : null}
              </div>

              <h2 className="mt-10 font-display text-3xl">Reviews</h2>
              <div className="mt-4 space-y-3">
                {course.reviews.length === 0 ? <p className="text-sm text-muted">No reviews yet.</p> : null}
                {course.reviews.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-line bg-cream p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{fullName(review.author)}</p>
                      <Stars value={review.rating} />
                    </div>
                    {review.comment ? <p className="mt-2 text-sm leading-6 text-ink-soft">{review.comment}</p> : null}
                    <p className="mt-2 text-xs text-muted">{formatDate(review.createdAt)}</p>
                  </article>
                ))}
              </div>

              {course.viewer?.enrolled ? (
                <form className="mt-6 space-y-4 rounded-2xl border border-line bg-cream p-5" onSubmit={form.handleSubmit(saveReview)}>
                  <h3 className="font-display text-2xl">Your review</h3>
                  <Field label="Rating" error={form.formState.errors.rating?.message}>
                    <select className={fieldClass} {...form.register('rating', { valueAsNumber: true })}>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Comment" error={form.formState.errors.comment?.message}>
                    <textarea className={fieldClass} rows={4} {...form.register('comment')} />
                  </Field>
                  <button className={buttonClass('primary')} type="submit" disabled={form.formState.isSubmitting}>Save review</button>
                </form>
              ) : null}
            </div>

            <aside className="h-fit rounded-2xl border border-line bg-cream p-5 lg:sticky lg:top-24">
              <p className="font-display text-4xl text-ink">{priceLabel(course, settings.currency)}</p>
              <p className="mt-1 text-sm text-muted">{course.enrollmentCount} enrolled · {course.lessonCount} lessons</p>
              {course.viewer?.enrolled ? (
                <Link href={`/dashboard/student/learn/${course.slug}`} className={`${buttonClass('primary', 'lg')} mt-5 w-full`}>
                  {course.viewer.enrollmentStatus === 'completed' ? 'Review the course' : 'Continue learning'}
                </Link>
              ) : (
                <button className={`${buttonClass('clay', 'lg')} mt-5 w-full`} type="button" onClick={() => void enroll()} disabled={busy}>
                  {busy ? 'Working…' : course.isFree ? 'Enroll for free' : `Buy for ${priceLabel(course, settings.currency)}`}
                </button>
              )}
              {!course.isFree && payments && !payments.configured && !course.viewer?.enrolled ? (
                <p className="mt-3 text-xs leading-5 text-muted">{payments.message}</p>
              ) : null}
              {!user && ready ? <p className="mt-3 text-xs text-muted">You will sign in before enrollment is recorded.</p> : null}
              <div className="mt-6 border-t border-line pt-4">
                <Link href={`/instructors/${course.instructor.id}`} className="font-medium text-ink">{fullName(course.instructor)}</Link>
                <p className="mt-1 text-sm text-muted">{course.instructor.headline}</p>
              </div>
              {course.status !== 'published' ? (
                <div className="mt-4"><Badge tone={statusTone(course.status)}>{course.status}</Badge></div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </SiteFrame>
  );
}
