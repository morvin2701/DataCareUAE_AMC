import { HttpError } from './httpError.js';

/** Collect field errors then throw one 422 with { fields }. Output keys are the column names. */
export class Validator {
  constructor(body = {}) { this.b = body; this.errors = {}; this.out = {}; }
  fail(field, msg) { if (!this.errors[field]) this.errors[field] = msg; return this; }
  str(field, { required = false, max = 200, upper = false, out = field } = {}) {
    let v = this.b[field]; v = v == null ? '' : String(v).trim(); if (upper) v = v.toUpperCase();
    if (required && !v) this.fail(field, 'Required'); else if (v.length > max) this.fail(field, `Max ${max} characters`);
    this.out[out] = v || null; return this;
  }
  num(field, { required = false, min = -Infinity, max = Infinity, integer = false, out = field, def = null } = {}) {
    const raw = this.b[field];
    if (raw === undefined || raw === null || raw === '') { if (required) this.fail(field, 'Required'); this.out[out] = def; return this; }
    const n = Number(raw);
    if (!Number.isFinite(n)) this.fail(field, 'Must be a number'); else if (integer && !Number.isInteger(n)) this.fail(field, 'Must be a whole number'); else if (n < min || n > max) this.fail(field, `Must be between ${min} and ${max}`);
    this.out[out] = Number.isFinite(n) ? n : def; return this;
  }
  bool(field, { out = field, def = false } = {}) { const v = this.b[field]; this.out[out] = v === undefined ? def : (v === true || v === 1 || v === '1' || v === 'true'); return this; }
  oneOf(field, values, { required = false, out = field, def = null } = {}) {
    const v = this.b[field] == null || this.b[field] === '' ? null : String(this.b[field]).toUpperCase();
    if (v == null) { if (required) this.fail(field, 'Required'); this.out[out] = def; return this; }
    if (!values.includes(v)) this.fail(field, `Must be one of ${values.join(', ')}`); this.out[out] = v; return this;
  }
  date(field, { required = false, out = field } = {}) {
    const v = this.b[field]; if (!v) { if (required) this.fail(field, 'Required'); this.out[out] = null; return this; }
    const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) { this.fail(field, 'Invalid date'); this.out[out] = null; } else this.out[out] = s; return this;
  }
  mobile(field = 'MOBILE_NO', { required = false } = {}) {
    const raw = this.b[field]; if (!raw) { if (required) this.fail(field, 'Required'); this.out[field] = null; return this; }
    let d = String(raw).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); else if (d.length === 9 && d.startsWith('5')) d = '971' + d;
    if (d.length < 10 || d.length > 15) this.fail(field, 'Enter a valid mobile with its country code (e.g. +971 50 123 4567)'); this.out[field] = d; return this;
  }
  email(field = 'EMAIL_ID') { const v = String(this.b[field] ?? '').trim(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) this.fail(field, 'Invalid e-mail'); this.out[field] = v || null; return this; }
  done() { if (Object.keys(this.errors).length) { const e = new HttpError(422, 'Please fix the highlighted fields.', 'VALIDATION'); e.fields = this.errors; throw e; } return this.out; }
}
/** Paging + search params: ?q=&page=1&pageSize=25&sort=&dir=asc */
export function paging(req, allowedSorts, defSort) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(5, parseInt(req.query.pageSize, 10) || 50));
  const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : defSort;
  const dir = String(req.query.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const q = String(req.query.q || '').trim().slice(0, 100);
  return { page, pageSize, sort, dir, q, offset: (page - 1) * pageSize };
}
