import { Suspense } from 'react';
import { LoginForm } from '@/views/AuthForms';

export const metadata = { title: 'Sign in' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
