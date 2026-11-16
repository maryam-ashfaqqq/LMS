import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(100, 'Use at most 100 characters.')
  .regex(/[A-Za-z]/, 'Include a letter.')
  .regex(/[0-9]/, 'Include a number.');

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || z.string().url().safeParse(value).success, 'Enter a valid URL.');

export const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(255),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(100),
  role: z.enum(['student', 'instructor']).default('student'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(255),
  password: z.string().min(1, 'Enter your password.'),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  headline: z.string().trim().max(200).optional().default(''),
  bio: z.string().trim().max(4000).optional().default(''),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
});

export const courseWriteSchema = z
  .object({
    title: z.string().trim().min(3, 'Use at least 3 characters.').max(180),
    subtitle: z.string().trim().max(180).optional().default(''),
    description: z.string().trim().min(20, 'Describe the course in at least 20 characters.').max(8000),
    categoryId: z.string().uuid('Choose a category.'),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    language: z.string().trim().min(2).max(40).default('English'),
    isFree: z.boolean(),
    price: z.number().min(0).max(9999),
    thumbnailUrl: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isFree && value.price < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Paid courses need a price of at least 1.',
      });
    }
  });

export const sectionSchema = z.object({
  title: z.string().trim().min(1, 'Enter a section title.').max(180),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(1, 'Enter a lesson title.').max(180),
  content: z.string().trim().max(20000).optional().default(''),
  videoUrl: optionalUrl.optional().default(''),
  resourceUrl: optionalUrl.optional().default(''),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  isPreview: z.boolean().default(false),
});

export const moveSchema = z.object({
  direction: z.enum(['up', 'down']),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
});

export const enrollmentSchema = z.object({
  courseId: z.string().uuid(),
});

export const progressSchema = z.object({
  lessonId: z.string().uuid(),
  completed: z.boolean(),
});

export const checkoutSchema = z.object({
  courseId: z.string().uuid(),
});

export const confirmPaymentSchema = z.object({
  sessionId: z.string().trim().min(3).max(255),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Add a short reason.').max(500),
});

export const adminUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'instructor', 'student']),
});

export const adminUserPatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['admin', 'instructor', 'student']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide a change to save.');

export const grantEnrollmentSchema = z.object({
  email: z.string().trim().email(),
  courseSlug: z.string().trim().min(1).max(200),
});

export const enrollmentStatusSchema = z.object({
  status: z.enum(['active', 'cancelled']),
});

export const settingsSchema = z.object({
  site_name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(180),
  support_email: z
    .string()
    .trim()
    .max(255)
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email.'),
  allow_instructor_registration: z.enum(['true', 'false']),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code.'),
});

export const uuidSchema = z.string().uuid();
