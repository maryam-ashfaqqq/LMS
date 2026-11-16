'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteFrame } from '@/components/SiteChrome';
import { CourseCard } from '@/components/CourseCard';
import { EmptyState, LoadingBlock, buttonClass, fieldClass } from '@/components/ui';
import { api, errorMessage, qs } from '@/lib/api';
import { pageCount } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Category, Course, PageResult } from '@/lib/types';

export function CoursesView() {
  const params = useSearchParams();
  const router = useRouter();
  const { settings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<PageResult<Course> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(params.get('search') ?? '');

  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const price = params.get('price') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = params.get('page') ?? '1';

  const searchQuery = params.get('search') ?? '';

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    api<{ data: Category[] }>('/api/categories')
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<PageResult<Course>>(`/api/courses${qs({ search: searchQuery, category, level, price, sort, page, pageSize: 9 })}`)
      .then((response) => {
        if (active) {
          setResult(response);
          setError(null);
        }
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
  }, [searchQuery, category, level, price, sort, page]);

  function update(next: Record<string, string>, resetPage = true) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    if (resetPage) query.delete('page');
    const text = query.toString();
    router.push(text ? `/courses?${text}` : '/courses');
  }

  const pages = pageCount(result?.total ?? 0, result?.pageSize ?? 9);

  return (
    <SiteFrame>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs uppercase tracking-[0.18em] text-pine">Catalog</p>
        <h1 className="mt-2 font-display text-5xl text-ink">Courses</h1>
        <p className="mt-3 max-w-2xl text-muted">Search published courses, then filter by subject, level, and price.</p>

        <form
          className="mt-8 grid gap-3 rounded-2xl border border-line bg-cream p-4 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            update({ search });
          }}
        >
          <input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles and descriptions" aria-label="Search courses" />
          <select className={fieldClass} value={category} aria-label="Category" onChange={(event) => update({ category: event.target.value })}>
            <option value="">All subjects</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>{item.name}</option>
            ))}
          </select>
          <select className={fieldClass} value={level} aria-label="Level" onChange={(event) => update({ level: event.target.value })}>
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select className={fieldClass} value={price} aria-label="Price" onChange={(event) => update({ price: event.target.value })}>
            <option value="">Free and paid</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
          <select className={fieldClass} value={sort} aria-label="Sort" onChange={(event) => update({ sort: event.target.value })}>
            <option value="newest">Newest</option>
            <option value="popular">Most enrolled</option>
            <option value="rating">Highest rated</option>
            <option value="price_asc">Price, low to high</option>
            <option value="price_desc">Price, high to low</option>
          </select>
          <button className={buttonClass('primary')} type="submit">Search</button>
        </form>

        <div className="mt-6">
          {loading ? <LoadingBlock label="Loading courses" /> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!loading && result && result.data.length === 0 ? (
            <EmptyState
              title="No courses match these filters"
              body="Clear a filter or try another subject. Draft and pending courses stay out of the public catalog."
              action={<button className={buttonClass('secondary')} type="button" onClick={() => router.push('/courses')}>Clear filters</button>}
            />
          ) : null}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result?.data.map((course) => (
              <CourseCard key={course.id} course={course} currency={settings.currency} />
            ))}
          </div>
          {result && result.total > result.pageSize ? (
            <div className="mt-8 flex items-center justify-between text-sm">
              <p className="text-muted">{result.total} courses</p>
              <div className="flex gap-2">
                <button className={buttonClass('secondary', 'sm')} type="button" disabled={Number(page) <= 1} onClick={() => update({ page: String(Number(page) - 1) }, false)}>Previous</button>
                <span className="px-2 py-2 text-muted">Page {page} of {pages}</span>
                <button className={buttonClass('secondary', 'sm')} type="button" disabled={Number(page) >= pages} onClick={() => update({ page: String(Number(page) + 1) }, false)}>Next</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SiteFrame>
  );
}
