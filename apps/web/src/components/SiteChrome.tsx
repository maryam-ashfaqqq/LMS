'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { dashboardPath } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { buttonClass } from './ui';

const links = [
  { href: '/courses', label: 'Courses' },
  { href: '/instructors', label: 'Instructors' },
  { href: '/certificates', label: 'Certificates' },
];

export function ApiBanner() {
  const { status } = useSettings();
  if (status !== 'offline') return null;
  return (
    <div className="bg-clay px-4 py-2 text-center text-sm text-white">
      Oakline cannot reach the API. Start the backend, then refresh this page.
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="font-display text-2xl tracking-tight text-pine">
          {settings.site_name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-soft md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname.startsWith(link.href) ? 'text-ink' : 'hover:text-ink'}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {ready && user ? (
            <Link href={dashboardPath(user.role)} className={buttonClass('primary', 'sm')}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClass('ghost', 'sm')}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClass('primary', 'sm')}>
                Create account
              </Link>
            </>
          )}
        </div>
        <button type="button" className="md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((value) => !value)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            {ready && user ? (
              <Link href={dashboardPath(user.role)} onClick={() => setOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
                <Link href="/register" onClick={() => setOpen(false)}>Create account</Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const { settings } = useSettings();
  return (
    <footer className="mt-auto border-t border-line bg-pine text-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl">{settings.site_name}</p>
          <p className="mt-3 text-sm leading-6 text-paper/75">{settings.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-white">Catalog</p>
          <div className="mt-3 flex flex-col gap-2 text-paper/75">
            <Link href="/courses">Browse courses</Link>
            <Link href="/instructors">Meet instructors</Link>
            <Link href="/certificates">Verify a certificate</Link>
          </div>
        </div>
        <div className="text-sm">
          <p className="font-medium text-white">Account</p>
          <div className="mt-3 flex flex-col gap-2 text-paper/75">
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create a student account</Link>
            <Link href="/register?role=instructor">Teach on {settings.site_name}</Link>
          </div>
        </div>
        <div className="text-sm">
          <p className="font-medium text-white">Support</p>
          <a className="mt-3 block text-paper/75" href={`mailto:${settings.support_email}`}>
            {settings.support_email}
          </a>
        </div>
      </div>
    </footer>
  );
}

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ApiBanner />
      <SiteHeader />
      <main id="content" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
