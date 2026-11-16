'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SiteFrame } from '@/components/SiteChrome';
import { ErrorNote, Field, buttonClass, fieldClass } from '@/components/ui';
import { ApiError, applyFieldErrors, errorMessage, safeNext } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(255),
  password: z.string().min(1, 'Enter your password.'),
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(100),
  email: z.string().trim().email('Enter a valid email.').max(255),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Za-z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.'),
  role: z.enum(['student', 'instructor']),
});

type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { login } = useAuth();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  return (
    <SiteFrame>
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-5xl text-ink">Sign in</h1>
        <p className="mt-3 text-sm text-muted">Use the email and password for your Oakline account.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await login(values.email, values.password, next);
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof LoginInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) form.setError('root', { message: errorMessage(reason) });
            }
          })}
        >
          {form.formState.errors.root ? <ErrorNote message={form.formState.errors.root.message || 'Sign-in failed.'} /> : null}
          <Field label="Email" error={form.formState.errors.email?.message}>
            <input className={fieldClass} type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <input className={fieldClass} type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>
          <button className={`${buttonClass('primary', 'lg')} w-full`} type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          New here? <Link className="text-pine" href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>Create an account</Link>
        </p>
      </div>
    </SiteFrame>
  );
}

export function RegisterForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const requested = params.get('role') === 'instructor' ? 'instructor' : 'student';
  const { settings } = useSettings();
  const { register } = useAuth();
  const instructorsOpen = settings.allow_instructor_registration !== 'false';
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', role: requested },
  });

  return (
    <SiteFrame>
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-5xl text-ink">Create an account</h1>
        <p className="mt-3 text-sm text-muted">Students can enroll immediately. Instructor accounts can build courses for review.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await register(values, next);
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => form.setError(name as keyof RegisterInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) form.setError('root', { message: errorMessage(reason) });
            }
          })}
        >
          {form.formState.errors.root ? <ErrorNote message={form.formState.errors.root.message || 'Registration failed.'} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={form.formState.errors.firstName?.message}>
              <input className={fieldClass} autoComplete="given-name" {...form.register('firstName')} />
            </Field>
            <Field label="Last name" error={form.formState.errors.lastName?.message}>
              <input className={fieldClass} autoComplete="family-name" {...form.register('lastName')} />
            </Field>
          </div>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <input className={fieldClass} type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message} hint="At least 8 characters, with a letter and a number.">
            <input className={fieldClass} type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Account type" error={form.formState.errors.role?.message}>
            <select className={fieldClass} {...form.register('role')}>
              <option value="student">Student</option>
              {instructorsOpen ? <option value="instructor">Instructor</option> : null}
            </select>
          </Field>
          {!instructorsOpen ? <p className="text-xs text-muted">Instructor registration is closed in platform settings.</p> : null}
          <button className={`${buttonClass('primary', 'lg')} w-full`} type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already registered? <Link className="text-pine" href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link>
        </p>
      </div>
    </SiteFrame>
  );
}
