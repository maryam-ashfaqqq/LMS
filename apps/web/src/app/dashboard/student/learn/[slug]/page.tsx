import { Suspense } from 'react';
import { LearnView } from '@/views/LearnView';
import { LoadingBlock } from '@/components/ui';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<LoadingBlock label="Opening the course" />}>
      <LearnView slug={slug} />
    </Suspense>
  );
}
