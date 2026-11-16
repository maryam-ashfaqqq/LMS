'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErrorNote, Field, Panel, buttonClass, fieldClass } from '@/components/ui';
import { ApiError, api, applyFieldErrors, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { User } from '@/lib/types';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(100),
  headline: z.string().trim().max(200).optional().default(''),
  bio: z.string().trim().max(4000).optional().default(''),
  avatarUrl: z.string().trim().max(500).optional().default(''),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Za-z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.'),
});

type ProfileInput = z.infer<typeof profileSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;

export function SettingsView() {
  const { user, token, setUser } = useAuth();
  const { push } = useToast();
  const profile = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '', headline: '', bio: '', avatarUrl: '' },
  });
  const password = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const resetProfile = profile.reset;
  useEffect(() => {
    if (!user) return;
    resetProfile({
      firstName: user.firstName,
      lastName: user.lastName,
      headline: user.headline ?? '',
      bio: user.bio ?? '',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [user, resetProfile]);

  if (!user || !token) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <h1 className="font-display text-4xl text-ink">Profile</h1>
        <p className="mt-2 text-sm text-muted">This name appears on reviews, certificates, and instructor profiles.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={profile.handleSubmit(async (values) => {
            try {
              const result = await api<{ user: User }>('/api/auth/me', {
                method: 'PATCH',
                token,
                body: { ...values, avatarUrl: values.avatarUrl || null },
              });
              setUser(result.user);
              push('Profile saved.');
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => profile.setError(name as keyof ProfileInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) profile.setError('root', { message: errorMessage(reason) });
            }
          })}
        >
          {profile.formState.errors.root ? <ErrorNote message={profile.formState.errors.root.message || 'Could not save.'} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={profile.formState.errors.firstName?.message}>
              <input className={fieldClass} {...profile.register('firstName')} />
            </Field>
            <Field label="Last name" error={profile.formState.errors.lastName?.message}>
              <input className={fieldClass} {...profile.register('lastName')} />
            </Field>
          </div>
          <Field label="Headline" error={profile.formState.errors.headline?.message}>
            <input className={fieldClass} {...profile.register('headline')} />
          </Field>
          <Field label="Bio" error={profile.formState.errors.bio?.message}>
            <textarea className={fieldClass} rows={5} {...profile.register('bio')} />
          </Field>
          <Field label="Portrait" hint="PNG, JPG, WEBP, or GIF. The file is stored by the API." error={profile.formState.errors.avatarUrl?.message}>
            <input
              className={fieldClass}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const stored = await uploadFile(file, token);
                  profile.setValue('avatarUrl', stored.url);
                  push('Portrait uploaded. Save the profile to keep it.');
                } catch (reason) {
                  push(errorMessage(reason), 'error');
                }
              }}
            />
          </Field>
          {profile.watch('avatarUrl') ? <img src={profile.watch('avatarUrl')} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
          <button className={buttonClass('primary')} type="submit" disabled={profile.formState.isSubmitting}>Save profile</button>
        </form>
      </Panel>
      <Panel>
        <h2 className="font-display text-3xl text-ink">Password</h2>
        <p className="mt-2 text-sm text-muted">Signed in as {user.email}. Changing the password keeps your current session.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={password.handleSubmit(async (values) => {
            try {
              await api('/api/auth/password', { method: 'PATCH', token, body: values });
              password.reset();
              push('Password updated.');
            } catch (reason) {
              applyFieldErrors(reason, (name, fieldError) => password.setError(name as keyof PasswordInput, fieldError));
              if (!(reason instanceof ApiError && reason.fields)) password.setError('root', { message: errorMessage(reason) });
            }
          })}
        >
          {password.formState.errors.root ? <ErrorNote message={password.formState.errors.root.message || 'Could not update password.'} /> : null}
          <Field label="Current password" error={password.formState.errors.currentPassword?.message}>
            <input className={fieldClass} type="password" autoComplete="current-password" {...password.register('currentPassword')} />
          </Field>
          <Field label="New password" error={password.formState.errors.newPassword?.message} hint="At least 8 characters, with a letter and a number.">
            <input className={fieldClass} type="password" autoComplete="new-password" {...password.register('newPassword')} />
          </Field>
          <button className={buttonClass('primary')} type="submit" disabled={password.formState.isSubmitting}>Update password</button>
        </form>
      </Panel>
    </div>
  );
}
