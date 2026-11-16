import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { config, paymentNotConfiguredMessage } from '../config';
import { PaymentNotConfiguredError } from './httpError';

export type CheckoutInput = {
  orderId: string;
  userId: string;
  courseId: string;
  email: string;
  courseTitle: string;
  courseSubtitle: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  url: string;
  providerReference: string;
};

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  retrieveSession(sessionId: string): Promise<{
    orderId: string;
    userId: string;
    paid: boolean;
    providerStatus: string;
    providerReference: string;
  }>;
  readWebhook(rawBody: Buffer, signature: string | undefined): { orderId: string; providerReference: string } | null;
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = 'unconfigured';

  isConfigured(): boolean {
    return false;
  }

  async createCheckout(): Promise<CheckoutResult> {
    throw new PaymentNotConfiguredError(paymentNotConfiguredMessage);
  }

  async retrieveSession(): Promise<never> {
    throw new PaymentNotConfiguredError(paymentNotConfiguredMessage);
  }

  readWebhook(): null {
    throw new PaymentNotConfiguredError(paymentNotConfiguredMessage);
  }
}

type StripeSession = {
  id: string;
  url: string | null;
  payment_status: string;
  metadata?: { orderId?: string; userId?: string };
};

async function stripeRequest<T>(path: string, secret: string, params?: Record<string, string>, method = 'POST'): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message || 'Stripe rejected the request.');
  }
  return body;
}

export function verifyStripeSignature(payload: Buffer, header: string, secret: string): boolean {
  const timestamp = header
    .split(',')
    .find((part) => part.startsWith('t='))
    ?.slice(2);
  const signatures = header
    .split(',')
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 5 * 60) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  });
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const amount = Math.round(input.amount * 100);
    if (amount < 50) {
      throw new Error('Stripe requires a charge of at least 0.50 in the selected currency.');
    }
    const session = await stripeRequest<StripeSession>('checkout/sessions', this.secretKey, {
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.email,
      client_reference_id: input.orderId,
      'metadata[orderId]': input.orderId,
      'metadata[userId]': input.userId,
      'metadata[courseId]': input.courseId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][product_data][name]': input.courseTitle.slice(0, 120),
      ...(input.courseSubtitle
        ? { 'line_items[0][price_data][product_data][description]': input.courseSubtitle.slice(0, 200) }
        : {}),
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { url: session.url, providerReference: session.id };
  }

  async retrieveSession(sessionId: string) {
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      throw new Error('Unrecognized checkout session.');
    }
    const session = await stripeRequest<StripeSession>(`checkout/sessions/${sessionId}`, this.secretKey, undefined, 'GET');
    return {
      orderId: session.metadata?.orderId ?? '',
      userId: session.metadata?.userId ?? '',
      paid: session.payment_status === 'paid',
      providerStatus: session.payment_status ?? 'unknown',
      providerReference: session.id,
    };
  }

  readWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.webhookSecret) {
      throw new PaymentNotConfiguredError('STRIPE_WEBHOOK_SECRET is not configured, so webhook events cannot be verified.');
    }
    if (!signature || !verifyStripeSignature(rawBody, signature, this.webhookSecret)) {
      throw new Error('Invalid Stripe signature.');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: { object?: StripeSession };
    };
    if (event.type !== 'checkout.session.completed') return null;
    const session = event.data?.object;
    if (!session || session.payment_status !== 'paid' || !session.metadata?.orderId) return null;
    return { orderId: session.metadata.orderId, providerReference: session.id };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (config.stripeSecretKey) {
    return new StripePaymentProvider(config.stripeSecretKey, config.stripeWebhookSecret);
  }
  return new UnconfiguredPaymentProvider();
}

export function newId(): string {
  return randomUUID();
}
