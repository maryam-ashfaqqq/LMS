import { Suspense } from 'react';
import { CoursesView } from '@/views/CoursesView';
import { LoadingBlock } from '@/components/ui';

export const metadata = { title: 'Courses' };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-5"><LoadingBlock label="Loading courses" /></div>}>
      <CoursesView />
    </Suspense>
  );
}
