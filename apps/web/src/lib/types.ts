export type Role = 'admin' | 'instructor' | 'student';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'pending' | 'published' | 'rejected';

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type PublicSettings = {
  site_name: string;
  tagline: string;
  support_email: string;
  allow_instructor_registration: 'true' | 'false' | string;
  currency: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  courseCount: number;
};

export type InstructorSummary = {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  bio?: string | null;
  avatarUrl: string | null;
  courseCount?: number;
  studentCount?: number;
  ratingAverage?: number | null;
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  isFree: boolean;
  level: CourseLevel;
  language: string;
  status: CourseStatus;
  rejectionReason?: string | null;
  category: { id: string; name: string; slug: string };
  instructor: InstructorSummary;
  ratingAverage: number | null;
  ratingCount: number;
  enrollmentCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Lesson = {
  id: string;
  title: string;
  position: number;
  durationMinutes: number;
  isPreview: boolean;
  locked: boolean;
  completed: boolean;
  videoUrl: string | null;
  content: string | null;
  resourceUrl: string | null;
};

export type Section = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  author: { firstName: string; lastName: string };
};

export type Viewer = {
  enrolled: boolean;
  enrollmentStatus: string | null;
  progressPercent: number;
  source: string | null;
  review: { rating: number; comment: string | null } | null;
};

export type CourseDetail = Course & {
  sections: Section[];
  reviews: Review[];
  viewer: Viewer | null;
};

export type PageResult<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type Enrollment = {
  id: string;
  status: string;
  source: string;
  progressPercent: number;
  enrolledAt: string | null;
  completedAt: string | null;
  completedLessons: number;
  totalLessons: number;
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    thumbnailUrl: string | null;
    isFree: boolean;
    price: number;
    instructorName: string;
  };
};

export type LearningCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  isFree: boolean;
  price: number;
  status: CourseStatus;
  instructor: { id: string; firstName: string; lastName: string };
  sections: Section[];
  reviews: Review[];
  viewer: Viewer | null;
};

export type Certificate = {
  code: string;
  issuedAt: string | null;
  courseTitle: string;
  courseSlug?: string;
  studentName: string;
};

export type Order = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string | null;
  course: { title: string; slug: string };
  payment: { provider: string; status: string | null } | null;
};

export type StoredObject = {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
};

export type PaymentConfig = {
  provider: string;
  configured: boolean;
  message: string | null;
};

export type PublicStats = {
  publishedCourses: number;
  instructors: number;
  learners: number;
  certificates: number;
};

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  headline: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

export type AdminEnrollment = {
  id: string;
  status: string;
  source: string;
  progressPercent: number;
  enrolledAt: string | null;
  student: { email: string; firstName: string; lastName: string };
  course: { title: string; slug: string };
};

export type AdminPayment = {
  id: string;
  provider: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: string;
  orderStatus: string;
  createdAt: string | null;
  studentEmail: string;
  courseTitle: string;
};

export type InstructorOverview = {
  courses: number;
  students: number;
  averageRating: number | null;
  reviewCount: number;
  completionRate: number | null;
  revenue: { amount: number; currency: string; note: string };
  coursesBreakdown: Array<{
    id: string;
    title: string;
    slug: string;
    status: CourseStatus;
    students: number;
    averageRating: number | null;
    revenue: number;
    completionRate: number | null;
  }>;
};

export type CourseStudent = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  source: string;
  progressPercent: number;
  enrolledAt: string | null;
};
