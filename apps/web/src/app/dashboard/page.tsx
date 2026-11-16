'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardPath } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LoadingBlock } from '@/components/ui';

export default function Page() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(user ? dashboardPath(user.role) : '/login?next=/dashboard');
  }, [ready, user, router]);
  return <LoadingBlock label="Opening your dashboard" />;
}
