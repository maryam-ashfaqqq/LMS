import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, override: true });

function requiredInProduction(name: string, value: string | undefined, fallback: string): string {
  const resolved = value && value.trim() ? value.trim() : fallback;
  if (process.env.NODE_ENV === 'production' && resolved === fallback) {
    throw new Error(`${name} must be set to a non-default value in production.`);
  }
  return resolved;
}

const dbName = process.env.DB_NAME?.trim() || 'oakline';
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000',
  apiPublicUrl: (process.env.API_PUBLIC_URL?.trim() || 'http://localhost:4000').replace(/\/$/, ''),
  jwtSecret: requiredInProduction('JWT_SECRET', process.env.JWT_SECRET, 'dev-only-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '7d',
  db: {
    host: process.env.DB_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER?.trim() || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: dbName,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' as const } : undefined,
  },
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || '',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 8),
};

export const paymentNotConfiguredMessage =
  'Paid checkout needs a payment provider. Set STRIPE_SECRET_KEY to a Stripe test key and STRIPE_WEBHOOK_SECRET so Oakline can confirm payment with Stripe. Card numbers are never stored here, and an order is not marked paid without the provider.';
