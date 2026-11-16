import Link from 'next/link';
import { Star } from 'lucide-react';
import type { Course } from '@/lib/types';
import { fullName, levelLabel, priceLabel } from '@/lib/format';

export function CourseArt({
  title,
  url,
  className = '',
}: {
  title: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    return <img src={url} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-end bg-[linear-gradient(150deg,#16382e_0%,#1f6a52_58%,#c45c32_140%)] p-4 ${className}`}>
      <span className="font-display text-4xl text-white">{title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export function Stars({ value }: { value: number | null }) {
  const rating = value ?? 0;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
      <Star className={`h-4 w-4 ${rating ? 'fill-clay text-clay' : 'text-line'}`} />
      {value == null ? 'New' : value.toFixed(1)}
    </span>
  );
}

export function CourseCard({ course, currency }: { course: Course; currency: string }) {
  return (
    <Link href={`/courses/${course.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="aspect-[16/10] overflow-hidden">
        <CourseArt title={course.title} url={course.thumbnailUrl} className="transition duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-muted">
          <span>{course.category.name}</span>
          <span>{levelLabel(course.level)}</span>
        </div>
        <h3 className="mt-2 font-display text-2xl leading-tight text-ink">{course.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{course.subtitle || course.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4 text-sm">
          <span className="text-ink-soft">{fullName(course.instructor)}</span>
          <span className="font-medium text-ink">{priceLabel(course, currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <Stars value={course.ratingAverage} />
          <span>{course.lessonCount} lessons</span>
        </div>
      </div>
    </Link>
  );
}
