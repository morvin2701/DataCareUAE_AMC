const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'dcamc.token';
export const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export function setToken(t, remember = false) { try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); } catch {} }
export class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' }; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken(); if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new ApiError(res.status, data.code || 'ERROR', data.message || `Request failed (${res.status})`); if (data.fields) err.fields = data.fields;
    if (res.status === 401 && token && path !== '/auth/login') window.dispatchEvent(new CustomEvent('auth:expired', { detail: err }));
    throw err;
  }
  return data;
}
/** ?a=1&b=2 from an object, blanks left out. */
export const qs = (p = {}) => { const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null)).toString(); return s ? `?${s}` : ''; };
