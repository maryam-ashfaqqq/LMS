# Oakline

Oakline is a learning management system with a public catalog, student learning, an instructor studio, and an admin console. The Next.js frontend talks only to the Express API. The API owns MySQL, authentication, uploads, and payments.

## Requirements

- Node.js 20 or newer
- MySQL 8

## Install

From the project root:

```bash
npm install
```

Copy the environment examples if you do not already have local env files:

```bash
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

`apps/api/.env` controls the API port, JWT secret, MySQL connection, upload directory, and Stripe sandbox keys. `apps/web/.env.local` sets `NEXT_PUBLIC_API_URL`, which must match the API origin. npm 11 ignores dependency install scripts until they are approved. This repo already allows the `bcrypt` and `esbuild` scripts in the root `package.json`.

## Database

The setup script drops and recreates the database named in `DB_NAME`, applies `database/schema.sql`, and seeds demo data. `npm run db:seed` reloads demo data without dropping the schema. Seeding also writes `database/seed.sql`.

Local MySQL on port 3306, using the account in `apps/api/.env`. The example file assumes `root` with an empty password. If MySQL rejects that login, set `DB_PASSWORD` (and `DB_USER` if needed) before setup:

```bash
npm run db:setup
```

To use the included Docker MySQL instead, start it and point the API at port 3307:

```bash
docker compose up -d
```

Then set these values in `apps/api/.env` before `npm run db:setup`:

```text
DB_PORT=3307
DB_PASSWORD=oakline-dev
```

The container root password is `oakline-dev`. The database name remains `oakline`.

### Demo accounts

These accounts exist only after seeding. They are not production credentials.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@oakline.test | Admin#Oakline2026 |
| Instructor | ada@oakline.test | Teach#Oakline2026 |
| Instructor | leo@oakline.test | Teach#Oakline2026 |
| Student | maya@oakline.test | Learn#Oakline2026 |
| Student | jonah@oakline.test | Learn#Oakline2026 |

Maya is enrolled in the free SQL course. Jonah completed Writing Reports and has certificate `OL-JONAHWRITE`. Pricing Conversations is waiting for admin review. Available Light is still a draft.

## Run

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

Other scripts:

```bash
npm run dev:web
npm run dev:api
npm run build
npm run typecheck
npm run lint
npm test
```

## Payments

Paid checkout uses Stripe test mode when both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set. Leave them blank and the API refuses to pretend a payment succeeded. Card numbers are never stored. Free enrollment does not create a payment. An admin grant opens a course and records that it was granted, not paid.

After a configured checkout, Stripe returns the learner to Orders, and the app asks Stripe whether that session was paid before creating the enrollment.

## Uploads

Thumbnails and lesson resources are stored through the API storage adapter on local disk (`UPLOAD_DIR`, default `apps/api/uploads`). Allowed types are PNG, JPG, WEBP, GIF, PDF, and ZIP. Lesson video stays a URL (YouTube, Vimeo, or a direct file URL) so video hosting is not faked.
