'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, PenLine, ShieldCheck } from 'lucide-react';
import { SiteFrame } from '@/components/SiteChrome';
import { CourseArt, CourseCard, Stars } from '@/components/CourseCard';
import { buttonClass, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fullName, priceLabel } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Category, Course, InstructorSummary, PageResult, PublicStats } from '@/lib/types';

export function HomeView() {
  const { settings } = useSettings();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [instructors, setInstructors] = useState<InstructorSummary[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api<PageResult<Course>>('/api/courses?pageSize=6&sort=popular'),
      api<{ data: Category[] }>('/api/categories'),
      api<{ data: InstructorSummary[] }>('/api/instructors'),
      api<PublicStats>('/api/stats'),
    ])
      .then(([coursePage, categoryPage, instructorPage, publicStats]) => {
        if (!active) return;
        setCourses(coursePage.data);
        setCategories(categoryPage.data);
        setInstructors(instructorPage.data.filter((person) => (person.courseCount ?? 0) > 0));
        setStats(publicStats);
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
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    window.location.href = query ? `/courses?search=${encodeURIComponent(query)}` : '/courses';
  }

  const lead = courses[0];

  return (
    <SiteFrame>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-pine">A studio for serious courses</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
            Study work that was edited, taught, and finished.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-ink-soft">{settings.tagline}</p>
          <form onSubmit={onSearch} className="mt-8 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="home-search">Search courses</label>
            <input
              id="home-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or topic"
              className="h-12 flex-1 rounded-xl border border-line bg-cream px-4 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <button className={buttonClass('primary', 'lg')} type="submit">
              Search courses
            </button>
          </form>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/courses" className="inline-flex items-center gap-1 text-pine">
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/register?role=instructor" className="text-ink-soft">
              Teach a course
            </Link>
          </div>
        </div>
        <div className="relative">
          {lead ? (
            <Link href={`/courses/${lead.slug}`} className="block overflow-hidden rounded-[28px] border border-line bg-cream shadow-card">
              <div className="aspect-[16/10]">
                <CourseArt title={lead.title} url={lead.thumbnailUrl} />
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted">{lead.category.name}</p>
                <h2 className="mt-1 font-display text-3xl text-ink">{lead.title}</h2>
                <p className="mt-2 text-sm text-muted">{lead.subtitle}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>{fullName(lead.instructor)}</span>
                  <span className="font-medium">{priceLabel(lead, settings.currency)}</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="rounded-[28px] border border-dashed border-line bg-cream p-8 text-sm text-muted">
              {loading ? 'Loading the catalog…' : 'Published courses will appear here.'}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-line bg-cream">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
          {[
            ['Published courses', stats?.publishedCourses],
            ['Instructors', stats?.instructors],
            ['Learners', stats?.learners],
            ['Certificates', stats?.certificates],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="font-display text-3xl text-ink">{loading ? '—' : value ?? 0}</p>
              <p className="text-sm text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl text-ink">Subjects</h2>
            <p className="mt-2 text-sm text-muted">Filter the catalog by the work you want to practice.</p>
          </div>
          <Link href="/courses" className="text-sm text-pine">All courses</Link>
        </div>
        {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
        {loading ? <LoadingBlock /> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link key={category.id} href={`/courses?category=${category.slug}`} className="rounded-2xl border border-line bg-cream p-5 hover:border-pine/40">
              <p className="font-display text-2xl text-ink">{category.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{category.description || 'Courses in this subject.'}</p>
              <p className="mt-4 text-xs uppercase tracking-wide text-pine">{category.courseCount} published</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14">
        <h2 className="font-display text-4xl text-ink">In the catalog</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} currency={settings.currency} />
          ))}
        </div>
      </section>

      <section className="bg-pine text-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {[
            [CheckCircle2, 'Enroll with a record', 'Free courses enroll immediately. Paid courses wait for a confirmed payment before access opens.'],
            [PenLine, 'Lessons with a point', 'Sections, previews, and progress stay attached to the course, not to a slide deck.'],
            [ShieldCheck, 'A certificate you can check', 'Completion writes a code. Anyone can verify it without an account.'],
          ].map(([Icon, title, body]) => {
            const Mark = Icon as typeof CheckCircle2;
            return (
              <div key={String(title)}>
                <Mark className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-display text-2xl">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-paper/75">{String(body)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-4xl text-ink">Instructors</h2>
          <Link href="/instructors" className="text-sm text-pine">All instructors</Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {instructors.map((person) => (
            <Link key={person.id} href={`/instructors/${person.id}`} className="flex gap-4 rounded-2xl border border-line bg-cream p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine text-lg text-white">
                {person.firstName.slice(0, 1)}
                {person.lastName.slice(0, 1)}
              </div>
              <div>
                <p className="font-display text-2xl text-ink">{fullName(person)}</p>
                <p className="text-sm text-muted">{person.headline}</p>
                <div className="mt-2 flex gap-3 text-xs text-ink-soft">
                  <span>{person.courseCount} courses</span>
                  <Stars value={person.ratingAverage ?? null} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
