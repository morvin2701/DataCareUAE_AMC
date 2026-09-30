import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { fieldUpdate, schemaStatus } from '../services/schemaService.js';
import { paging } from '../utils/validate.js';
import { rq, sql } from '../config/db.js';

/** Field update, the audit log viewer and the login log — the owner only. */
const r = Router();
r.get('/maintenance/schema', requireAuth, requireOwner, wrap(async (_req, res) => res.json({ success: true, ...(await schemaStatus()) })));
r.post('/maintenance/field-update', requireAuth, requireOwner, wrap(async (req, res) => { const out = await fieldUpdate(); await audit(req.ctx, 'SCHEMA_VER', out.database, 'FIELD_UPDATE', { applied: out.applied }); res.json({ success: true, ...out }); }));
r.get('/audit', requireAuth, requireOwner, wrap(async (req, res) => {
  const p = paging(req, ['LOG_TIME'], 'LOG_TIME'); const dir = req.query.dir ? p.dir : 'DESC';
  const where = `FROM AUDIT_LOG A LEFT JOIN AMC_USER U ON U.USER_ID = A.USER_ID WHERE (@q = '%%' OR A.TABLE_NAME LIKE @q OR A.ACTION LIKE @q OR U.LOGIN_NAME LIKE @q OR A.REC_KEY LIKE @q OR A.DETAIL LIKE @q)`;
  const q = await (await rq()).input('q', sql.NVarChar, `%${p.q}%`).input('off', sql.Int, p.offset).input('ps', sql.Int, p.pageSize)
    .query(`SELECT COUNT(*) AS N ${where}; SELECT A.LOG_ID, A.LOG_TIME, A.TABLE_NAME, A.REC_KEY, A.ACTION, A.DETAIL, U.LOGIN_NAME, U.USER_NAME ${where} ORDER BY A.LOG_TIME ${dir} OFFSET @off ROWS FETCH NEXT @ps ROWS ONLY`);
  res.json({ success: true, total: q.recordsets[0][0].N, page: p.page, pageSize: p.pageSize, rows: q.recordsets[1] });
}));
r.get('/login-log', requireAuth, requireOwner, wrap(async (req, res) => {
  const p = paging(req, ['LOG_TIME'], 'LOG_TIME');
  const q = await (await rq()).input('off', sql.Int, p.offset).input('ps', sql.Int, p.pageSize).query('SELECT COUNT(*) AS N FROM LOGIN_LOG; SELECT LOG_ID, LOGIN_NAME, RESULT, IP_ADDR, USER_AGENT, LOG_TIME FROM LOGIN_LOG ORDER BY LOG_TIME DESC OFFSET @off ROWS FETCH NEXT @ps ROWS ONLY');
  res.json({ success: true, total: q.recordsets[0][0].N, page: p.page, pageSize: p.pageSize, rows: q.recordsets[1] });
}));
export default r;
