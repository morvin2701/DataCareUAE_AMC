import { api, qs } from './api.js';
export const serverService = {
  list: () => api('/servers'), create: (b) => api('/servers', { method: 'POST', body: b }), update: (id, b) => api(`/servers/${id}`, { method: 'PUT', body: b }),
  rotate: (id) => api(`/servers/${id}/rotate-key`, { method: 'POST' }), test: (id) => api(`/servers/${id}/test`, { method: 'POST' }),
};
export const customerService = {
  list: (p) => api(`/customers${qs(p)}`), get: (id) => api(`/customers/${id}`), meta: (p) => api(`/customers/meta${qs(p)}`), create: (b) => api('/customers', { method: 'POST', body: b }), update: (id, b) => api(`/customers/${id}`, { method: 'PUT', body: b }), remove: (id) => api(`/customers/${id}`, { method: 'DELETE' }), history: (id) => api(`/customers/${id}/history`),
};
export const leadService = {
  list: (p) => api(`/leads${qs(p)}`), get: (id) => api(`/leads/${id}`), create: (b) => api('/leads', { method: 'POST', body: b }), update: (id, b) => api(`/leads/${id}`, { method: 'PUT', body: b }), followUp: (id, b) => api(`/leads/${id}/followup`, { method: 'POST', body: b }), convert: (id, b = {}) => api(`/leads/${id}/convert`, { method: 'POST', body: b }), remove: (id) => api(`/leads/${id}`, { method: 'DELETE' }),
};
export const notifyService = { list: (all) => api(`/notify${all ? '?all=1' : ''}`), read: (id) => api(`/notify/${id}/read`, { method: 'POST' }), readAll: () => api('/notify/read-all', { method: 'POST' }), create: (b) => api('/notify', { method: 'POST', body: b }), generate: () => api('/notify/generate', { method: 'POST' }) };
export const contractService = {
  list: (p) => api(`/contracts${qs(p)}`), get: (id) => api(`/contracts/${id}`), defaults: (custId) => api(`/contracts/defaults/${custId}`),
  create: (b) => api('/contracts', { method: 'POST', body: b }), update: (id, b) => api(`/contracts/${id}`, { method: 'PUT', body: b }), status: (id, status) => api(`/contracts/${id}/status`, { method: 'POST', body: { status } }),
  print: (id) => api(`/contracts/${id}/print`),
};
export const invoiceService = {
  list: (p) => api(`/invoices${qs(p)}`), get: (id) => api(`/invoices/${id}`), create: (b) => api('/invoices', { method: 'POST', body: b }), cancel: (id) => api(`/invoices/${id}/cancel`, { method: 'POST' }), print: (id) => api(`/invoices/${id}/print`),
  outstanding: () => api('/invoices/outstanding'), statement: (custId) => api(`/customers/${custId}/statement`),
};
export const paymentService = { list: (p) => api(`/payments${qs(p)}`), create: (b) => api('/payments', { method: 'POST', body: b }), cancel: (id) => api(`/payments/${id}/cancel`, { method: 'POST' }), print: (id) => api(`/payments/${id}/print`) };
export const ticketService = {
  list: (p) => api(`/tickets${qs(p)}`), get: (id) => api(`/tickets/${id}`), create: (b) => api('/tickets', { method: 'POST', body: b }), update: (id, b) => api(`/tickets/${id}`, { method: 'PUT', body: b }),
  note: (id, b) => api(`/tickets/${id}/notes`, { method: 'POST', body: b }), close: (id, b) => api(`/tickets/${id}/close`, { method: 'POST', body: b }), reopen: (id) => api(`/tickets/${id}/reopen`, { method: 'POST' }),
};
export const visitService = { list: (p) => api(`/visits${qs(p)}`), create: (b) => api('/visits', { method: 'POST', body: b }), update: (id, b) => api(`/visits/${id}`, { method: 'PUT', body: b }), remove: (id) => api(`/visits/${id}`, { method: 'DELETE' }) };
export const reminderService = { rules: () => api('/reminders/rules'), saveRule: (r) => (r.RULE_ID ? api(`/reminders/rules/${r.RULE_ID}`, { method: 'PUT', body: r }) : api('/reminders/rules', { method: 'POST', body: r })), removeRule: (id) => api(`/reminders/rules/${id}`, { method: 'DELETE' }), log: (p) => api(`/reminders/log${qs(p)}`), run: (b) => api('/reminders/run', { method: 'POST', body: b }), due: () => api('/reminders/due'), test: (b) => api('/reminders/test', { method: 'POST', body: b }) };
export const reportService = { get: (name, p) => api(`/reports/${name}${qs(p)}`) };
export const dashboardService = { snapshot: () => api('/dashboard') };
export const backupService = { status: () => api('/backup'), run: () => api('/backup/run', { method: 'POST' }), save: (b) => api('/backup/settings', { method: 'PUT', body: b }), driveConnect: () => api('/backup/drive/connect'), driveDisconnect: () => api('/backup/drive/disconnect', { method: 'POST' }) };
