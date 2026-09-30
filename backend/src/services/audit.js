import { rq, sql } from '../config/db.js';
/** Every write lands here: who, when, table, key, action, detail. Failures are logged, never swallowed silently into a feature switch. */
export async function audit(ctx, table, recKey, action, detail) {
  try {
    (await rq()).input('u', sql.Int, ctx?.userId ?? null).input('t', sql.VarChar(40), table).input('k', sql.VarChar(60), recKey == null ? null : String(recKey).slice(0, 60))
      .input('a', sql.VarChar(20), action).input('d', sql.NVarChar(sql.MAX), detail ? JSON.stringify(detail).slice(0, 4000) : null)
      .query('INSERT INTO AUDIT_LOG (USER_ID, TABLE_NAME, REC_KEY, ACTION, DETAIL) VALUES (@u, @t, @k, @a, @d)');
  } catch (e) { console.warn('[audit]', e.message); }
}
