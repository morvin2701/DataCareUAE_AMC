import { env } from '../config/env.js';
export function notFoundHandler(_req, res) { res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route not found' }); }
function sqlError(err) {
  const seen = [err, err?.originalError, err?.originalError?.info, ...(err?.precedingErrors || [])];
  for (const e of seen) { const n = Number(e?.number); if (n > 0) return { number: n, message: e?.message || err?.message }; }
  return null;
}
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  const sqlE = err.status ? null : sqlError(err);
  if (sqlE) { err.number = sqlE.number; if (!err.message || err.code === 'EREQUEST') err.message = sqlE.message || err.message; err.fromSql = true; }
  if (!err.status && (err.number === 2627 || err.number === 2601)) { status = 409; err.code = 'DUPLICATE'; err.message = 'A record with the same number already exists.'; }
  if (!err.status && err.number === 547) { status = 409; err.code = 'IN_USE'; err.message = 'This record is referenced by other data and cannot be removed.'; }
  if (!err.status && (err.number === 208 || err.number === 207)) {
    const what = /'([^']+)'/.exec(String(err.message || ''))?.[1];
    status = 503; err.code = 'SCHEMA_BEHIND'; err.schemaBehind = true;
    err.message = `The database is behind the program${what ? ` (${what} is missing)` : ''} — run Settings → Field update, then try again.`;
  }
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ success: false, code: err.code || (status >= 500 ? 'SERVER_ERROR' : 'ERROR'),
    message: status >= 500 && env.isProd && !err.schemaBehind && !err.fromSql ? 'Server error' : String(err.message || '').slice(0, 400), ...(err.fields ? { fields: err.fields } : {}) });
}
