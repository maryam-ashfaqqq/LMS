'use client';

import { CourseStudents } from '@/views/InstructorViews';
import { useParams } from 'next/navigation';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <CourseStudents id={params.id} />;
}
