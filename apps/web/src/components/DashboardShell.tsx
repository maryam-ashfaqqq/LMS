'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  CreditCard,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { dashboardPath } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { ApiBanner } from './SiteChrome';
import { LoadingBlock } from './ui';

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const studentNav: Item[] = [
  { href: '/dashboard/student', label: 'My learning', icon: BookOpen, exact: true },
  { href: '/dashboard/student/certificates', label: 'Certificates', icon: Award },
  { href: '/dashboard/student/orders', label: 'Orders', icon: Receipt },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const instructorNav: Item[] = [
  { href: '/dashboard/instructor', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/instructor/courses', label: 'Courses', icon: BookOpen },
  { href: '/dashboard/instructor/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const adminNav: Item[] = [
  { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/dashboard/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/dashboard/admin/enrollments', label: 'Enrollments', icon: GraduationCap },
  { href: '/dashboard/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/instructor', label: 'Teaching studio', icon: BookOpen },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function allowed(pathname: string, role: string) {
  if (pathname.startsWith('/dashboard/settings')) return true;
  if (pathname.startsWith('/dashboard/admin')) return role === 'admin';
  if (pathname.startsWith('/dashboard/instructor')) return role === 'instructor' || role === 'admin';
  if (pathname.startsWith('/dashboard/student')) return true;
  return true;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed(pathname, user.role)) router.replace(dashboardPath(user.role));
  }, [ready, user, pathname, router]);

  if (!ready || !user) {
    return (
      <div className="mx-auto max-w-6xl px-5">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }

  const items = user.role === 'admin' ? adminNav : user.role === 'instructor' ? instructorNav : studentNav;

  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/" className="font-display text-2xl text-white">
        {settings.site_name}
      </Link>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{user.role}</p>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm text-white">{fullName(user)}</p>
        <p className="truncate text-xs text-white/60">{user.email}</p>
        <button type="button" onClick={() => void logout()} className="mt-3 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-pine px-4 py-6 lg:block">{nav}</aside>
      <div>
        <ApiBanner />
        <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <span className="font-display text-xl text-pine">{settings.site_name}</span>
          <Link href={dashboardPath(user.role)} className="text-sm">Home</Link>
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 bg-ink/50 lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-[min(20rem,86vw)] bg-pine p-4" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="mb-4 text-white" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X />
              </button>
              {nav}
            </div>
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
