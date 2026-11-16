'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteFrame } from '@/components/SiteChrome';
import { CourseCard, Stars } from '@/components/CourseCard';
import { EmptyState, ErrorNote, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Course, InstructorSummary } from '@/lib/types';

export function InstructorsView() {
  const [people, setPeople] = useState<InstructorSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: InstructorSummary[] }>('/api/instructors')
      .then((result) => setPeople(result.data))
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SiteFrame>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-5xl text-ink">Instructors</h1>
        <p className="mt-3 max-w-2xl text-muted">Profiles show published courses, learners, and the average of reviews on those courses.</p>
        {loading ? <LoadingBlock /> : null}
        {error ? <div className="mt-6"><ErrorNote message={error} /></div> : null}
        {!loading && people.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No instructors yet" body="Instructor accounts appear here once they are active." />
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {people.map((person) => (
            <Link key={person.id} href={`/instructors/${person.id}`} className="rounded-2xl border border-line bg-cream p-5">
              <p className="font-display text-3xl text-ink">{fullName(person)}</p>
              <p className="mt-1 text-sm text-muted">{person.headline || 'Instructor'}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{person.bio}</p>
              <div className="mt-4 flex gap-4 text-sm text-ink-soft">
                <span>{person.courseCount ?? 0} courses</span>
                <span>{person.studentCount ?? 0} learners</span>
                <Stars value={person.ratingAverage ?? null} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SiteFrame>
  );
}

export function InstructorProfileView({ id }: { id: string }) {
  const { settings } = useSettings();
  const [profile, setProfile] = useState<{ instructor: InstructorSummary; courses: Course[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ instructor: InstructorSummary; courses: Course[] }>(`/api/instructors/${id}`)
      .then(setProfile)
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <SiteFrame>
      <div className="mx-auto max-w-6xl px-5 py-10">
        {loading ? <LoadingBlock label="Loading instructor" /> : null}
        {error ? <ErrorNote message={error} /> : null}
        {profile ? (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-pine">Instructor</p>
            <h1 className="mt-2 font-display text-5xl text-ink">{fullName(profile.instructor)}</h1>
            <p className="mt-3 text-lg text-ink-soft">{profile.instructor.headline}</p>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted">{profile.instructor.bio}</p>
            <h2 className="mt-10 font-display text-3xl">Published courses</h2>
            {profile.courses.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No published courses" body="This instructor does not have a public course yet." />
              </div>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {profile.courses.map((course) => (
                  <CourseCard key={course.id} course={course} currency={settings.currency} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </SiteFrame>
  );
}
