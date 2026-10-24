export const API_BASE_URL = '/api/v1';
export interface AuthResult { token: string; user: { id: number; email: string } }
let token: string | null = null;
let epoch = 0;
let controller = new AbortController();
let onUnauthorized: (() => void) | null = null;
let onRefreshed: ((data: AuthResult) => void) | null = null;
let refreshing: Promise<AuthResult | null> | null = null;
export const getToken = () => token;
export const setToken = (value: string) => { token = value; };
export const getSessionEpoch = () => epoch;
export const clearToken = () => { token = null; epoch++; controller.abort(); controller = new AbortController(); };
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
export const setRefreshHandler = (fn: (data: AuthResult) => void) => { onRefreshed = fn; };
export async function refreshSession(): Promise<AuthResult | null> {
  if (refreshing) return refreshing;
  const started = epoch;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include',
        headers: { 'X-HealthGuard-Client': 'web', 'Content-Type': 'application/json' } });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error('Session service unavailable. Please retry.');
      const data = await res.json() as AuthResult;
      if (epoch !== started) return null;
      token = data.token; onRefreshed?.(data); return data;
    } catch { throw new Error('Session service unavailable. Please retry.'); }
    finally { refreshing = null; }
  })();
  return refreshing;
}
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const started = epoch;
  const execute = () => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json'); headers.set('X-HealthGuard-Client', 'web');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include', signal: init.signal || controller.signal });
  };
  let res = await execute();
  if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError');
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await execute();
    if (res.status === 401) { clearToken(); onUnauthorized?.(); }
  }
  if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError');
  return res;
}
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const started = epoch;
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({ error: `Request failed (${response.status}). Please retry.` }));
  if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError');
  if (!response.ok) throw new Error(data.error || data.detail || `Request failed (${response.status})`);
  return data as T;
}
