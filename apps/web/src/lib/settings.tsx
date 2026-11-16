'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { PublicSettings } from './types';

const defaults: PublicSettings = {
  site_name: 'Oakline',
  tagline: 'Courses taught with the care of a studio.',
  support_email: 'support@oakline.test',
  allow_instructor_registration: 'true',
  currency: 'USD',
};

type SettingsState = {
  settings: PublicSettings;
  status: 'loading' | 'ready' | 'offline';
};

const SettingsContext = createContext<SettingsState>({ settings: defaults, status: 'loading' });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>({ settings: defaults, status: 'loading' });

  useEffect(() => {
    let active = true;
    api<{ settings: PublicSettings }>('/api/settings')
      .then((result) => {
        if (active) setState({ settings: { ...defaults, ...result.settings }, status: 'ready' });
      })
      .catch(() => {
        if (active) setState({ settings: defaults, status: 'offline' });
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
