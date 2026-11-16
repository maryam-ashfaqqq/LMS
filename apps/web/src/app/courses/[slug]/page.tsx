import { Suspense } from 'react';
import { CourseDetailView } from '@/views/CourseDetailView';
import { LoadingBlock } from '@/components/ui';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-5"><LoadingBlock /></div>}>
      <CourseDetailView slug={slug} />
    </Suspense>
  );
}
