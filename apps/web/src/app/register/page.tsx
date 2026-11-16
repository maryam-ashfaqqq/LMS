import { Suspense } from 'react';
import { RegisterForm } from '@/views/AuthForms';

export const metadata = { title: 'Create account' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
