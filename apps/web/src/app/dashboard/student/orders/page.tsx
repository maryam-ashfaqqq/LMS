import { Suspense } from 'react';
import { StudentOrders } from '@/views/StudentViews';
import { LoadingBlock } from '@/components/ui';

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <StudentOrders />
    </Suspense>
  );
}
