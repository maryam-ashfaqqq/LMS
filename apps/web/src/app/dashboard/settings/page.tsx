import { Suspense } from 'react';
import { SettingsView } from '@/views/SettingsView';
import { LoadingBlock } from '@/components/ui';

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SettingsView />
    </Suspense>
  );
}
