# Oakline

Oakline is a learning management system with a public catalog, student learning, an instructor studio, and an admin console. The Next.js frontend talks only to the Express API. The API owns MySQL, authentication, uploads, and payments.

## Requirements

- Node.js 20 or newer
- A TiDB Cloud Serverless cluster (MySQL compatible)

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

`apps/api/.env` controls the API port, JWT secret, TiDB Cloud connection, the first admin account, the upload directory, and Stripe sandbox keys. `apps/web/.env.local` sets `NEXT_PUBLIC_API_URL`, which must match the API origin. npm 11 ignores dependency install scripts until they are approved. This repo already allows the `bcrypt` and `esbuild` scripts in the root `package.json`.

## Database

The database lives on TiDB Cloud. This repository has the Next.js frontend and the Express API only. `apps/api/.env` holds `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_SSL=true`.

On startup the API connects to that cluster, creates the `oakline` database if it is missing, and creates tables that are not already there. It does not load sample users or courses. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set and that email is not already registered, the API creates that one admin account so you can sign in.

```bash
npm run db:setup
```

Creating or deleting a student, instructor, or course in the website writes or removes that row in TiDB. The catalog, enrollments, and certificates are read from the same database.

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
