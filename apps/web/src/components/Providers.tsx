'use client';

import { ToastProvider } from '@/lib/toast';
import { AuthProvider } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>{children}</AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
