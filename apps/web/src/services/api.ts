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
export const clearToken = () => { token = null; epoch++; refreshing = null; controller.abort(); controller = new AbortController(); };
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
export const setRefreshHandler = (fn: (data: AuthResult) => void) => { onRefreshed = fn; };
export async function refreshSession(): Promise<AuthResult | null> {
  if (refreshing) return refreshing;
  const started = epoch;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        headers: { 'X-HealthGuard-Client': 'web', 'Content-Type': 'application/json' } });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error('Session service unavailable. Please retry.');
      const data = await res.json() as AuthResult;
      if (epoch !== started) return null;
      token = data.token; onRefreshed?.(data); return data;
    } catch {
      if (epoch !== started) return null;
      throw new Error('Session service unavailable. Please retry.');
    }
    finally { if (epoch === started) refreshing = null; }
  })();
  return refreshing;
}
// Revocation must survive the local reset that cancels all patient requests.
// Capture the signed session before clearing it; never refresh during logout.
export async function logoutSession(): Promise<void> {
  const headers = new Headers({ 'X-HealthGuard-Client': 'web' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers,
    credentials: 'include', keepalive: true, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Server logout failed. Please retry.');
}
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const started = epoch;
  const lifetime = controller.signal;
  let sentToken: string | null = null;
  const checkSession = () => { if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError'); };
  const execute = () => {
    checkSession();
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json'); headers.set('X-HealthGuard-Client', 'web');
    sentToken = token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include',
      signal: init.signal ? AbortSignal.any([init.signal, lifetime]) : lifetime });
  };
  let res = await execute();
  checkSession();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    // A parallel request may already have rotated the token while this 401
    // was in transit. Reuse it instead of spending another refresh rotation.
    const renewed = token && token !== sentToken ? true : Boolean(await refreshSession());
    checkSession();
    if (renewed) res = await execute();
    checkSession();
    if (res.status === 401) { clearToken(); onUnauthorized?.(); }
  }
  checkSession();
  return res;
}
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const started = epoch;
  const response = await apiFetch(path, init);
  let data;
  try { data = await response.json(); }
  catch {
    if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError');
    throw new Error(response.ok ? 'The server returned an invalid response. Please retry.' : `Request failed (${response.status}). Please retry.`);
  }
  if (started !== epoch) throw new DOMException('Obsolete session', 'AbortError');
  if (!response.ok) throw new Error(data?.error || data?.detail || `Request failed (${response.status})`);
  return data as T;
}
