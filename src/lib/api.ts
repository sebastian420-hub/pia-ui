/**
 * Single place for the API base URL and the bearer token.
 * Configure the URL via .env (VITE_API_URL); the token is the signed-in user's, never built in.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8001').replace(/\/$/, '');
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

const TOKEN_KEY = 'pia_token';

/** The signed-in user's token: pasted on the sign-in screen, kept in this browser only. */
export function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}
export function setToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t.trim()); } catch { /* private window */ } }
export function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

export interface ApiEnvelope<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  reply?: string;
  pagination?: { page: number; limit: number; total: number; total_pages: number };
  total?: number;
  code?: number;
}

/** fetch() with the Authorization header; never throws on HTTP errors, returns the envelope. */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
    if (body.status === 'success') return body as ApiEnvelope<T>;
    if (res.status === 401) window.dispatchEvent(new Event('pia:unauthorized'));
    return { status: 'error', message: body.message ?? `HTTP ${res.status}`, code: res.status };
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
  return `${API_BASE}${path}${sep}token=${encodeURIComponent(getToken())}${t}`;
}

/** URL for the live WebSocket, token passed on the handshake. */
export function liveSocketUrl(): string {
  return `${WS_BASE}/ws/live?token=${encodeURIComponent(getToken())}`;
}
