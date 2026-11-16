import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'clay' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine-deep',
  clay: 'bg-clay text-white hover:bg-clay-deep',
  secondary: 'border border-line bg-cream text-ink hover:bg-white',
  ghost: 'text-ink hover:bg-black/5',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function TextLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={buttonClass('primary', 'md', className)}>
      {children}
    </Link>
  );
}

export const fieldClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-pine focus:ring-4 focus:ring-pine/10';

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-clay-deep">{error}</span> : null}
      {hint && !error ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'wait' | 'bad' }) {
  const tones = {
    neutral: 'bg-paper text-ink-soft',
    good: 'bg-pine-mist text-pine',
    wait: 'bg-amber-100 text-amber-900',
    bad: 'bg-red-50 text-red-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tones[tone]}`}>{children}</span>;
}

export function statusTone(status: string): 'neutral' | 'good' | 'wait' | 'bad' {
  if (['published', 'active', 'completed', 'paid', 'succeeded', 'free'].includes(status)) return 'good';
  if (['pending', 'draft'].includes(status)) return 'wait';
  if (['rejected', 'failed', 'cancelled', 'refunded'].includes(status)) return 'bad';
  return 'neutral';
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-pine/20 border-t-pine" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-cream px-6 py-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-cream p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-cream p-5 shadow-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button type="button" className={buttonClass('ghost', 'sm')} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
