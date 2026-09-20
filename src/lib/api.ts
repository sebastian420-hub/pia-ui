/**
 * Single place for the API base URL and the bearer token.
 * Configure via .env: VITE_API_URL, VITE_API_TOKEN (see .env.example).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8001').replace(/\/$/, '');
export const API_TOKEN: string = import.meta.env.VITE_API_TOKEN ?? '';
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

export interface ApiEnvelope<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  reply?: string;
  pagination?: { page: number; limit: number; total: number; total_pages: number };
  total?: number;
}

/** fetch() with the Authorization header; never throws on HTTP errors, returns the envelope. */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
    if (body.status === 'success') return body as ApiEnvelope<T>;
    return { status: 'error', message: body.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Network error' };
  }
}

export function apiJson<T = unknown>(path: string, payload: unknown, method = 'POST'): Promise<ApiEnvelope<T>> {
  return apiFetch<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

/** Media URLs for <img>/<video>: those tags cannot send headers, so the token goes in the query. */
export function mediaUrl(path: string, bust?: number | string): string {
  const sep = path.includes('?') ? '&' : '?';
  const t = bust != null ? `&t=${bust}` : '';
  return `${API_BASE}${path}${sep}token=${encodeURIComponent(API_TOKEN)}${t}`;
}

/** URL for the live WebSocket, token passed on the handshake. */
export function liveSocketUrl(): string {
  return `${WS_BASE}/ws/live?token=${encodeURIComponent(API_TOKEN)}`;
}
