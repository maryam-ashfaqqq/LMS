import type { Role } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;

  constructor(status: number, message: string, code: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: FormData;
};

type ErrorPayload = {
  error?: { message?: string; code?: string; fields?: Record<string, string[]> };
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'The Oakline API is not reachable. Start the backend and check NEXT_PUBLIC_API_URL.', 'NETWORK');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let payload: ErrorPayload | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ErrorPayload;
    } catch {
      throw new ApiError(response.status, 'The server returned a response that could not be read.', 'BAD_RESPONSE');
    }
  }
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.message || 'The request could not be completed.',
      error?.code || 'REQUEST_FAILED',
      error?.fields,
    );
  }
  return payload as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function applyFieldErrors(
  error: unknown,
  setError: (name: string, error: { message: string }) => void,
) {
  if (!(error instanceof ApiError) || !error.fields) return false;
  let applied = false;
  for (const [key, messages] of Object.entries(error.fields)) {
    if (messages[0]) {
      setError(key, { message: messages[0] });
      applied = true;
    }
  }
  return applied;
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function dashboardPath(role: Role) {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'instructor') return '/dashboard/instructor';
  return '/dashboard/student';
}

export function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export async function uploadFile(file: File, token: string) {
  const form = new FormData();
  form.append('file', file);
  return api<import('./types').StoredObject>('/api/uploads', { method: 'POST', token, formData: form });
}
