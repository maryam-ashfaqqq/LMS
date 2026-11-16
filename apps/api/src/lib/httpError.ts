export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class PaymentNotConfiguredError extends HttpError {
  constructor(message: string) {
    super(503, message, 'PAYMENT_NOT_CONFIGURED');
    this.name = 'PaymentNotConfiguredError';
  }
}
