'use client';

import { CourseEditor } from '@/views/CourseEditor';
import { useParams } from 'next/navigation';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <CourseEditor id={params.id} />;
}
