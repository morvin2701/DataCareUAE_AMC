import { api, setToken } from './api.js';
export const authService = {
  async login({ username, password, remember }) { const d = await api('/auth/login', { method: 'POST', body: { username, password } }); if (d.token) setToken(d.token, remember); return d; },
  async verify2fa({ ticket, code, remember }) { const d = await api('/auth/2fa', { method: 'POST', body: { ticket, code } }); setToken(d.token, remember); return d; },
  me: () => api('/auth/me'),
  heartbeat: () => api('/auth/heartbeat', { method: 'POST' }),
  async logout() { try { await api('/auth/logout', { method: 'POST' }); } catch {} setToken(null); },
  updateMe: (b) => api('/me', { method: 'PUT', body: b }),
  changePassword: (current, password) => api('/me/password', { method: 'POST', body: { current, password } }),
  setup2fa: (password) => api('/me/2fa/setup', { method: 'POST', body: { password } }),
  enable2fa: (code) => api('/me/2fa/enable', { method: 'POST', body: { code } }),
  disable2fa: (password) => api('/me/2fa/disable', { method: 'POST', body: { password } }),
  sessions: () => api('/me/sessions'), endOthers: () => api('/me/sessions/end-others', { method: 'POST' }),
};
export const userService = {
  list: () => api('/users'),
  save: (u) => (u.USER_ID ? api(`/users/${u.USER_ID}`, { method: 'PUT', body: u }) : api('/users', { method: 'POST', body: u })),
  resetPassword: (id, password, CHANGE_PWD) => api(`/users/${id}/password`, { method: 'POST', body: { password, CHANGE_PWD } }),
  unlock: (id) => api(`/users/${id}/unlock`, { method: 'POST' }), reset2fa: (id) => api(`/users/${id}/reset-2fa`, { method: 'POST' }), signOut: (id) => api(`/users/${id}/sign-out`, { method: 'POST' }),
};
export const settingsService = {
  all: () => api('/settings'), save: (key, value, extra = {}) => api(`/settings/${key}`, { method: 'PUT', body: { value, ...extra } }),
  schema: () => api('/maintenance/schema'), fieldUpdate: () => api('/maintenance/field-update', { method: 'POST' }),
  audit: (p) => api(`/audit?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null))}`),
  loginLog: (p) => api(`/login-log?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '' && v != null))}`),
};
