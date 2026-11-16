import fs from 'fs';
import path from 'path';
import { pool, exec } from './pool';
import { hashPassword } from '../lib/password';

const videos = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
];

const statements: string[] = [];

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function expand(sql: string, params: Record<string, unknown>) {
  return sql.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    if (!(key in params)) throw new Error(`Missing seed parameter ${key}`);
    return literal(params[key]);
  });
}

async function insert(sql: string, params: Record<string, unknown>) {
  statements.push(`${expand(sql, params)};`);
  await exec(sql, params);
}

let videoCursor = 0;
function nextVideo() {
  const url = videos[videoCursor % videos.length];
  videoCursor += 1;
  return url;
}

export async function seed() {
  statements.length = 0;
  videoCursor = 0;
  await exec('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of [
    'certificates',
    'lesson_progress',
    'reviews',
    'payments',
    'orders',
    'enrollments',
    'lessons',
    'sections',
    'courses',
    'categories',
    'platform_settings',
    'users',
  ]) {
    await exec(`TRUNCATE TABLE ${table}`);
  }
  await exec('SET FOREIGN_KEY_CHECKS = 1');

  const adminHash = await hashPassword('Admin#Oakline2026');
  const teachHash = await hashPassword('Teach#Oakline2026');
  const learnHash = await hashPassword('Learn#Oakline2026');

  const users = [
    ['11111111-1111-4111-8111-111111111111', 'admin@oakline.test', adminHash, 'Avery', 'Cole', 'admin', 'Platform steward', 'Avery keeps the catalog honest and the review queue moving.'],
    ['22222222-2222-4222-8222-222222222222', 'ada@oakline.test', teachHash, 'Ada', 'Okonkwo', 'instructor', 'Product designer teaching interface systems', 'Ada leads design critiques for software teams and teaches how interfaces behave under real constraints.'],
    ['33333333-3333-4333-8333-333333333333', 'leo@oakline.test', teachHash, 'Leo', 'Marchetti', 'instructor', 'Engineer and editor', 'Leo teaches TypeScript at the boundary of a system and the reports engineers owe the rest of the company.'],
    ['44444444-4444-4444-8444-444444444444', 'maya@oakline.test', learnHash, 'Maya', 'Chen', 'student', 'Analyst studying in public', 'Maya is working through the data courses and leaving reviews when a lesson changes her mind.'],
    ['55555555-5555-4555-8555-555555555555', 'jonah@oakline.test', learnHash, 'Jonah', 'Ellis', 'student', 'Operator who writes the weekly note', 'Jonah finished the writing studio and uses the certificate as proof of the work.'],
  ] as const;

  for (const [id, email, passwordHash, firstName, lastName, role, headline, bio] of users) {
    await insert(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, headline, bio)
       VALUES (:id, :email, :passwordHash, :firstName, :lastName, :role, :headline, :bio)`,
      { id, email, passwordHash, firstName, lastName, role, headline, bio },
    );
  }

  const categories = [
    ['c1111111-1111-4111-8111-111111111111', 'Product Design', 'product-design', 'Interfaces, critique, and the behavior of a product.'],
    ['c2222222-2222-4222-8222-222222222222', 'Data', 'data', 'Questions, queries, and decisions that survive a meeting.'],
    ['c3333333-3333-4333-8333-333333333333', 'Engineering', 'engineering', 'Types, boundaries, and code the next person can change.'],
    ['c4444444-4444-4444-8444-444444444444', 'Writing', 'writing', 'Reports, narrative, and sentences that finish the job.'],
    ['c5555555-5555-4555-8555-555555555555', 'Business', 'business', 'Pricing, offers, and conversations with customers.'],
    ['c6666666-6666-4666-8666-666666666666', 'Photography', 'photography', 'Light, attention, and pictures made on purpose.'],
  ] as const;
  for (const [id, name, slug, description] of categories) {
    await insert(
      `INSERT INTO categories (id, name, slug, description) VALUES (:id, :name, :slug, :description)`,
      { id, name, slug, description },
    );
  }

  const settings = [
    ['site_name', 'Oakline'],
    ['tagline', 'Courses taught with the care of a studio.'],
    ['support_email', 'support@oakline.test'],
    ['allow_instructor_registration', 'true'],
    ['currency', 'USD'],
  ] as const;
  for (const [key, value] of settings) {
    await insert(
      `INSERT INTO platform_settings (setting_key, setting_value) VALUES (:key, :value)`,
      { key, value },
    );
  }

  type Lesson = { id: string; title: string; content: string; minutes: number; preview?: boolean };
  type Section = { id: string; title: string; lessons: Lesson[] };
  type Course = {
    id: string;
    instructorId: string;
    categoryId: string;
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    price: number;
    isFree: boolean;
    level: string;
    status: string;
    sections: Section[];
  };

  const courses: Course[] = [
    {
      id: 'a1111111-1111-4111-8111-111111111111',
      instructorId: '22222222-2222-4222-8222-222222222222',
      categoryId: 'c1111111-1111-4111-8111-111111111111',
      title: 'Interface Systems for Product Teams',
      slug: 'interface-systems',
      subtitle: 'A studio method for screens that hold together.',
      description:
        'Build a shared language for product interfaces: what a screen is responsible for, which states must exist, and how a critique stays useful after the meeting. The course is practical and expects you to inventory a real product.',
      price: 89,
      isFree: false,
      level: 'intermediate',
      status: 'published',
      sections: [
        {
          id: 's1111111-1111-4111-8111-111111111111',
          title: 'Seeing the system',
          lessons: [
            {
              id: 'd1111111-1111-4111-8111-111111111101',
              title: 'What the interface is responsible for',
              minutes: 12,
              preview: true,
              content:
                'An interface is a set of promises. Name the job of the screen before you name the components. If the job is “help someone finish a weekly report,” the navigation, empty state, and errors all serve that job.',
            },
            {
              id: 'd1111111-1111-4111-8111-111111111102',
              title: 'Inventory the screens that matter',
              minutes: 14,
              content:
                'List the screens a person actually repeats. Ignore the ones that exist only in a sitemap. For each screen, write the entry condition, the success condition, and the one failure you have already seen in production.',
            },
          ],
        },
        {
          id: 's1111111-1111-4111-8111-111111111112',
          title: 'Making it hold together',
          lessons: [
            {
              id: 'd1111111-1111-4111-8111-111111111103',
              title: 'States, empty views, and errors',
              minutes: 16,
              content:
                'Every data view has at least four states: loading, empty, ready, and failed. Design the empty view as instruction, not decoration. Write the error as the next action a person can take.',
            },
            {
              id: 'd1111111-1111-4111-8111-111111111104',
              title: 'A critique you can repeat',
              minutes: 11,
              content:
                'Run critique in the same order each week: job of the screen, missing state, competing emphasis, and the sentence a new teammate would misunderstand. Keep notes in the file, not in the chat.',
            },
          ],
        },
      ],
    },
    {
      id: 'a2222222-2222-4222-8222-222222222222',
      instructorId: '22222222-2222-4222-8222-222222222222',
      categoryId: 'c2222222-2222-4222-8222-222222222222',
      title: 'SQL for Decision Makers',
      slug: 'sql-for-decision-makers',
      subtitle: 'Ask a better question before you write the query.',
      description:
        'A free course for people who read dashboards and sometimes write the query behind them. You will practice filters, grain, and the difference between a number that is true and a number that is useful.',
      price: 0,
      isFree: true,
      level: 'beginner',
      status: 'published',
      sections: [
        {
          id: 's2222222-2222-4222-8222-222222222221',
          title: 'From question to query',
          lessons: [
            {
              id: 'd2222222-2222-4222-8222-222222222201',
              title: 'Questions before queries',
              minutes: 10,
              preview: true,
              content:
                'Write the decision at the top of the document. Then write the grain: one row is one what? If you cannot say what a row represents, the average you are about to calculate will lie politely.',
            },
            {
              id: 'd2222222-2222-4222-8222-222222222202',
              title: 'Filtering without fooling yourself',
              minutes: 13,
              content:
                'A filter changes the population. Say the population out loud after each WHERE clause. “Paid orders in March, excluding grants” is a different sentence from “all orders in March.”',
            },
            {
              id: 'd2222222-2222-4222-8222-222222222203',
              title: 'One query for the meeting',
              minutes: 12,
              content:
                'Bring one query, one chart, and one sentence you are willing to defend. If the meeting needs a second grain, it needs a second query. Do not average them together in the slide.',
            },
          ],
        },
      ],
    },
    {
      id: 'a3333333-3333-4333-8333-333333333333',
      instructorId: '33333333-3333-4333-8333-333333333333',
      categoryId: 'c3333333-3333-4333-8333-333333333333',
      title: 'TypeScript at Work',
      slug: 'typescript-at-work',
      subtitle: 'Types where data enters and leaves the program.',
      description:
        'Use TypeScript at the edges of a service: request bodies, database rows, and the errors you show to people. The course favors small models over ceremony and assumes you already write JavaScript at work.',
      price: 79,
      isFree: false,
      level: 'intermediate',
      status: 'published',
      sections: [
        {
          id: 's3333333-3333-4333-8333-333333333331',
          title: 'Boundaries',
          lessons: [
            {
              id: 'd3333333-3333-4333-8333-333333333301',
              title: 'Types at the boundary',
              minutes: 15,
              preview: true,
              content:
                'Validate input at the door and let the rest of the function trust a narrower type. The schema is the documentation. A cast is a promise you have not checked.',
            },
            {
              id: 'd3333333-3333-4333-8333-333333333302',
              title: 'Model the record, not the table',
              minutes: 14,
              content:
                'A database row and a response object are different types. Map them in one place. The UI should not know the column names, and the SQL should not know the button labels.',
            },
            {
              id: 'd3333333-3333-4333-8333-333333333303',
              title: 'Narrow the error',
              minutes: 12,
              content:
                'Return errors with a code and a sentence a person can act on. Log the stack. Do not show the stack. If a failure is expected, type it. If it is unexpected, let it surface.',
            },
          ],
        },
      ],
    },
    {
      id: 'a4444444-4444-4444-8444-444444444444',
      instructorId: '33333333-3333-4333-8333-333333333333',
      categoryId: 'c4444444-4444-4444-8444-444444444444',
      title: 'Writing Reports People Finish',
      slug: 'writing-reports',
      subtitle: 'Structure a report around the decision it supports.',
      description:
        'A free writing studio for operators and engineers. You will shape a report so a busy reader can find the decision, the evidence, and the ask without rereading the middle.',
      price: 0,
      isFree: true,
      level: 'beginner',
      status: 'published',
      sections: [
        {
          id: 's4444444-4444-4444-8444-444444444441',
          title: 'The report',
          lessons: [
            {
              id: 'd4444444-4444-4444-8444-444444444401',
              title: "The reader's job",
              minutes: 9,
              preview: true,
              content:
                'Name the reader and the decision they can make in the next day. If there is no decision, send a note instead of a report. The title should say the subject, not the format.',
            },
            {
              id: 'd4444444-4444-4444-8444-444444444402',
              title: 'Structure that finishes',
              minutes: 11,
              content:
                'Open with the recommendation. Follow with the evidence that would change it. Put method and caveats after the reader has a reason to care. End with the ask, the owner, and the date.',
            },
            {
              id: 'd4444444-4444-4444-8444-444444444403',
              title: 'Edit for a decision',
              minutes: 10,
              content:
                'Cut sentences that repeat the chart. Replace adjectives with counts. Read the first paragraph aloud. If a colleague could disagree, you have a real report. If they could only nod, keep editing.',
            },
          ],
        },
      ],
    },
    {
      id: 'a5555555-5555-4555-8555-555555555555',
      instructorId: '22222222-2222-4222-8222-222222222222',
      categoryId: 'c5555555-5555-4555-8555-555555555555',
      title: 'Pricing Conversations',
      slug: 'pricing-conversations',
      subtitle: 'Talk about price without hiding the trade.',
      description:
        'A short course on saying what the work costs and what the buyer is choosing between. Submitted for review and not yet in the public catalog.',
      price: 49,
      isFree: false,
      level: 'advanced',
      status: 'pending',
      sections: [
        {
          id: 's5555555-5555-4555-8555-555555555551',
          title: 'The conversation',
          lessons: [
            {
              id: 'd5555555-5555-4555-8555-555555555501',
              title: 'Name the trade',
              minutes: 12,
              content: 'Price is a sentence about what is included and what is not. Write both before you write the number.',
            },
            {
              id: 'd5555555-5555-4555-8555-555555555502',
              title: 'Practice the sentence',
              minutes: 9,
              content: 'Say the price once, then stop. The next sentence answers a question. It does not apologize.',
            },
          ],
        },
      ],
    },
    {
      id: 'a6666666-6666-4666-8666-666666666666',
      instructorId: '33333333-3333-4333-8333-333333333333',
      categoryId: 'c6666666-6666-4666-8666-666666666666',
      title: 'Available Light',
      slug: 'available-light',
      subtitle: 'A draft studio on photographing with the light you have.',
      description:
        'Notes from a photography studio that is still in draft. It is not visible in the catalog until the instructor submits it and an admin publishes it.',
      price: 0,
      isFree: true,
      level: 'beginner',
      status: 'draft',
      sections: [
        {
          id: 's6666666-6666-4666-8666-666666666661',
          title: 'Looking',
          lessons: [
            {
              id: 'd6666666-6666-4666-8666-666666666601',
              title: 'Where the light already is',
              minutes: 8,
              content: 'Stand where the window is doing the work. Move the subject before you move a lamp.',
            },
          ],
        },
      ],
    },
  ];

  for (const course of courses) {
    await insert(
      `INSERT INTO courses (
         id, instructor_id, category_id, title, slug, subtitle, description, price, is_free, level, language, status
       ) VALUES (
         :id, :instructorId, :categoryId, :title, :slug, :subtitle, :description, :price, :isFree, :level, 'English', :status
       )`,
      {
        id: course.id,
        instructorId: course.instructorId,
        categoryId: course.categoryId,
        title: course.title,
        slug: course.slug,
        subtitle: course.subtitle,
        description: course.description,
        price: course.isFree ? 0 : course.price,
        isFree: course.isFree ? 1 : 0,
        level: course.level,
        status: course.status,
      },
    );
    course.sections.forEach(async (section, sectionIndex) => {
      // Position is written below in the awaited loop.
      void sectionIndex;
    });
    for (let sectionIndex = 0; sectionIndex < course.sections.length; sectionIndex += 1) {
      const section = course.sections[sectionIndex];
      await insert(
        `INSERT INTO sections (id, course_id, title, position) VALUES (:id, :courseId, :title, :position)`,
        { id: section.id, courseId: course.id, title: section.title, position: sectionIndex + 1 },
      );
      for (let lessonIndex = 0; lessonIndex < section.lessons.length; lessonIndex += 1) {
        const lesson = section.lessons[lessonIndex];
        await insert(
          `INSERT INTO lessons (id, section_id, title, content, video_url, duration_minutes, position, is_preview)
           VALUES (:id, :sectionId, :title, :content, :videoUrl, :durationMinutes, :position, :isPreview)`,
          {
            id: lesson.id,
            sectionId: section.id,
            title: lesson.title,
            content: lesson.content,
            videoUrl: nextVideo(),
            durationMinutes: lesson.minutes,
            position: lessonIndex + 1,
            isPreview: lesson.preview ? 1 : 0,
          },
        );
      }
    }
  }

  await insert(
    `INSERT INTO enrollments (id, user_id, course_id, status, source, progress_percent)
     VALUES (:id, :userId, :courseId, 'active', 'free', 33.33)`,
    {
      id: 'e2222222-2222-4222-8222-222222222221',
      userId: '44444444-4444-4444-8444-444444444444',
      courseId: 'a2222222-2222-4222-8222-222222222222',
    },
  );
  await insert(
    `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at)
     VALUES (:id, :enrollmentId, :lessonId, 1, CURRENT_TIMESTAMP)`,
    {
      id: 'p2222222-2222-4222-8222-222222222221',
      enrollmentId: 'e2222222-2222-4222-8222-222222222221',
      lessonId: 'd2222222-2222-4222-8222-222222222201',
    },
  );

  await insert(
    `INSERT INTO enrollments (id, user_id, course_id, status, source, progress_percent, completed_at)
     VALUES (:id, :userId, :courseId, 'completed', 'free', 100, CURRENT_TIMESTAMP)`,
    {
      id: 'e4444444-4444-4444-8444-444444444441',
      userId: '55555555-5555-4555-8555-555555555555',
      courseId: 'a4444444-4444-4444-8444-444444444444',
    },
  );
  for (const [progressId, lessonId] of [
    ['p4444444-4444-4444-8444-444444444401', 'd4444444-4444-4444-8444-444444444401'],
    ['p4444444-4444-4444-8444-444444444402', 'd4444444-4444-4444-8444-444444444402'],
    ['p4444444-4444-4444-8444-444444444403', 'd4444444-4444-4444-8444-444444444403'],
  ] as const) {
    await insert(
      `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at)
       VALUES (:id, :enrollmentId, :lessonId, 1, CURRENT_TIMESTAMP)`,
      {
        id: progressId,
        enrollmentId: 'e4444444-4444-4444-8444-444444444441',
        lessonId,
      },
    );
  }
  await insert(
    `INSERT INTO certificates (id, enrollment_id, user_id, course_id, certificate_code)
     VALUES (:id, :enrollmentId, :userId, :courseId, :code)`,
    {
      id: 'f4444444-4444-4444-8444-444444444441',
      enrollmentId: 'e4444444-4444-4444-8444-444444444441',
      userId: '55555555-5555-4555-8555-555555555555',
      courseId: 'a4444444-4444-4444-8444-444444444444',
      code: 'OL-JONAHWRITE',
    },
  );

  await insert(
    `INSERT INTO reviews (id, user_id, course_id, rating, comment)
     VALUES (:id, :userId, :courseId, :rating, :comment)`,
    {
      id: 'r2222222-2222-4222-8222-222222222221',
      userId: '44444444-4444-4444-8444-444444444444',
      courseId: 'a2222222-2222-4222-8222-222222222222',
      rating: 5,
      comment: 'The second lesson stopped me from averaging my way into a bad decision.',
    },
  );
  await insert(
    `INSERT INTO reviews (id, user_id, course_id, rating, comment)
     VALUES (:id, :userId, :courseId, :rating, :comment)`,
    {
      id: 'r4444444-4444-4444-8444-444444444441',
      userId: '55555555-5555-4555-8555-555555555555',
      courseId: 'a4444444-4444-4444-8444-444444444444',
      rating: 4,
      comment: 'Clear structure. I wanted one more example of a bad paragraph rewritten.',
    },
  );

  const seedPath = path.resolve(__dirname, '../../../../database/seed.sql');
  const header = `-- Oakline demo seed. Regenerated by apps/api/src/db/seed.ts.
-- Passwords are bcrypt hashes. Demo sign-in details live in the README.
-- This file stores no card data. Payment tables are left empty on purpose.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE certificates;
TRUNCATE TABLE lesson_progress;
TRUNCATE TABLE reviews;
TRUNCATE TABLE payments;
TRUNCATE TABLE orders;
TRUNCATE TABLE enrollments;
TRUNCATE TABLE lessons;
TRUNCATE TABLE sections;
TRUNCATE TABLE courses;
TRUNCATE TABLE categories;
TRUNCATE TABLE platform_settings;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;
`;
  fs.writeFileSync(seedPath, `${header}\n${statements.join('\n')}\n`);
}

async function main() {
  try {
    await seed();
    console.log('Demo data seeded.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
