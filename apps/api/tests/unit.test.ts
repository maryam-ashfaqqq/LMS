import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { signToken, verifyToken } from '../src/lib/tokens';
import { slugify } from '../src/lib/slug';
import { UnconfiguredPaymentProvider, verifyStripeSignature } from '../src/lib/payments';
import { paymentNotConfiguredMessage } from '../src/config';
import { registerSchema } from '../src/schemas';

describe('authentication primitives', () => {
  it('hashes passwords and rejects the wrong one', async () => {
    const hash = await hashPassword('Learn#Oakline2026');
    expect(hash).not.toContain('Learn#Oakline2026');
    expect(await verifyPassword('Learn#Oakline2026', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('signs and verifies a role-bearing token', () => {
    const token = signToken({ id: '44444444-4444-4444-8444-444444444444', role: 'student', email: 'maya@oakline.test' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('44444444-4444-4444-8444-444444444444');
    expect(payload.role).toBe('student');
    expect(() => verifyToken(`${token}x`)).toThrow();
  });

  it('rejects a public registration that tries to invent an admin', () => {
    const parsed = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'short',
      firstName: '',
      lastName: 'Chen',
      role: 'admin',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('catalog helpers', () => {
  it('slugifies titles into stable urls', () => {
    expect(slugify('SQL for Decision Makers')).toBe('sql-for-decision-makers');
    expect(slugify('   ')).toBe('item');
  });
});

describe('payments', () => {
  it('refuses to invent a successful charge when no provider is configured', async () => {
    const provider = new UnconfiguredPaymentProvider();
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.createCheckout({
        orderId: 'order',
        userId: 'user',
        courseId: 'course',
        email: 'maya@oakline.test',
        courseTitle: 'TypeScript at Work',
        courseSubtitle: '',
        amount: 79,
        currency: 'USD',
        successUrl: 'http://localhost:3000/orders',
        cancelUrl: 'http://localhost:3000/courses/typescript-at-work',
      }),
    ).rejects.toThrow(paymentNotConfiguredMessage);
  });

  it('verifies a Stripe signature and rejects a forged one', () => {
    const payload = Buffer.from('{"type":"checkout.session.completed"}');
    const secret = 'whsec_test_secret';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret)).toBe(true);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${'ab'.repeat(32)}`, secret)).toBe(false);
  });
});
