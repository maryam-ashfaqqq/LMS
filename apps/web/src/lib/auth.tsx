'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, dashboardPath, safeNext } from './api';
import type { User } from './types';

const TOKEN_KEY = 'oakline.token';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string, next?: string | null) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'student' | 'instructor';
  }, next?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((nextToken: string, nextUser: User, next?: string | null) => {
    persist(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    router.push(safeNext(next ?? null) ?? dashboardPath(nextUser.role));
  }, [router]);

  const refresh = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setToken(null);
      setUser(null);
      return;
    }
    const result = await api<{ user: User }>('/api/auth/me', { token: stored });
    setToken(stored);
    setUser(result.user);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {
        persist(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, next?: string | null) => {
    const result = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    applySession(result.token, result.user, next);
  }, [applySession]);

  const register = useCallback(async (
    input: { email: string; password: string; firstName: string; lastName: string; role: 'student' | 'instructor' },
    next?: string | null,
  ) => {
    const result = await api<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: input,
    });
    applySession(result.token, result.user, next);
  }, [applySession]);

  const logout = useCallback(async () => {
    const current = token ?? localStorage.getItem(TOKEN_KEY);
    if (current) {
      await api('/api/auth/logout', { method: 'POST', token: current }).catch(() => undefined);
    }
    persist(null);
    setToken(null);
    setUser(null);
    router.push('/');
  }, [router, token]);

  const value = useMemo(
    () => ({ user, token, ready, login, register, logout, refresh, setUser }),
    [user, token, ready, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
