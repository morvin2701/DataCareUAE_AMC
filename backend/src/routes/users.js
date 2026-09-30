import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, notFound, badRequest } from '../utils/httpError.js';
import { Validator } from '../utils/validate.js';
import { rq, sql } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { endUserSessions } from '../services/sessionService.js';
import { audit } from '../services/audit.js';
import { getPolicy, passwordProblems, ROLES } from '../services/securityService.js';
import { USER_COLS } from '../services/authService.js';

/** Users & roles — the owner only. OWNER everything · ACCOUNTS contracts, invoices, payments, reports · SUPPORT customers, tickets, visits. */
const r = Router();
const userV = (b) => new Validator(b).str('LOGIN_NAME', { required: true, max: 50 }).str('USER_NAME', { required: true, max: 100 }).oneOf('ROLE', ROLES, { required: true }).mobile('MOBILE_NO').email('EMAIL_ID').bool('ACTIVE', { def: true }).bool('CHANGE_PWD').done();
const checkPwd = async (pwd) => { const bad = passwordProblems(pwd, await getPolicy()); if (bad.length) throw badRequest(`Password needs ${bad.join(', ')}.`, 'PASSWORD_POLICY'); };

r.get('/users', requireAuth, wrap(async (req, res) => {
  const q = await (await rq()).query(`SELECT ${USER_COLS}, CASE WHEN LOCK_UNTIL > SYSUTCDATETIME() THEN LOCK_UNTIL END AS LOCKED_UNTIL, (SELECT COUNT(*) FROM USER_SESSION S WHERE S.USER_ID = U.USER_ID AND S.END_TIME IS NULL) AS LIVE_SESSIONS FROM AMC_USER U ORDER BY CASE ROLE WHEN 'OWNER' THEN 0 WHEN 'ACCOUNTS' THEN 1 ELSE 2 END, USER_NAME`);
  const full = req.ctx.role === 'OWNER';   /* everyone sees the team (to assign tickets); only the owner sees contact and status details */
  res.json({ success: true, rows: q.recordset.map((u) => full ? { ...u, ACTIVE: !!u.ACTIVE, CHANGE_PWD: !!u.CHANGE_PWD, TOTP_ON: !!u.TOTP_ON } : { USER_ID: u.USER_ID, USER_NAME: u.USER_NAME, LOGIN_NAME: u.LOGIN_NAME, ROLE: u.ROLE, ACTIVE: !!u.ACTIVE }) });
}));
r.post('/users', requireAuth, requireOwner, wrap(async (req, res) => {
  const d = userV(req.body); await checkPwd(req.body.password);
  const q = await (await rq()).input('u', sql.NVarChar(50), d.LOGIN_NAME).input('n', sql.NVarChar(100), d.USER_NAME).input('h', sql.VarChar(100), await hashPassword(req.body.password)).input('r', sql.VarChar(10), d.ROLE).input('m', sql.VarChar(20), d.MOBILE_NO).input('e', sql.NVarChar(150), d.EMAIL_ID).input('a', sql.Bit, d.ACTIVE).input('c', sql.Bit, d.CHANGE_PWD)
    .query('INSERT INTO AMC_USER (LOGIN_NAME, USER_NAME, LOGIN_PWD, ROLE, MOBILE_NO, EMAIL_ID, ACTIVE, CHANGE_PWD) OUTPUT inserted.USER_ID VALUES (@u, @n, @h, @r, @m, @e, @a, @c)');
  await audit(req.ctx, 'AMC_USER', q.recordset[0].USER_ID, 'CREATE', { LOGIN_NAME: d.LOGIN_NAME, ROLE: d.ROLE });
  res.status(201).json({ success: true, USER_ID: q.recordset[0].USER_ID });
}));
r.put('/users/:id', requireAuth, requireOwner, wrap(async (req, res) => {
  const id = Number(req.params.id); const d = userV(req.body);
  if (id === req.ctx.userId && (d.ROLE !== 'OWNER' || !d.ACTIVE)) throw badRequest('You cannot remove your own owner role or deactivate yourself.');
  const q = await (await rq()).input('id', sql.Int, id).input('u', sql.NVarChar(50), d.LOGIN_NAME).input('n', sql.NVarChar(100), d.USER_NAME).input('r', sql.VarChar(10), d.ROLE).input('m', sql.VarChar(20), d.MOBILE_NO).input('e', sql.NVarChar(150), d.EMAIL_ID).input('a', sql.Bit, d.ACTIVE).input('c', sql.Bit, d.CHANGE_PWD)
    .query('UPDATE AMC_USER SET LOGIN_NAME = @u, USER_NAME = @n, ROLE = @r, MOBILE_NO = @m, EMAIL_ID = @e, ACTIVE = @a, CHANGE_PWD = @c, EDIT_DATE = SYSUTCDATETIME() WHERE USER_ID = @id; SELECT @@ROWCOUNT AS N');
  if (!q.recordset[0].N) throw notFound('User not found');
  if (!d.ACTIVE) await endUserSessions(id, 'KICKED');
  await audit(req.ctx, 'AMC_USER', id, 'UPDATE', { LOGIN_NAME: d.LOGIN_NAME, ROLE: d.ROLE, ACTIVE: d.ACTIVE }); res.json({ success: true });
}));
r.post('/users/:id/password', requireAuth, requireOwner, wrap(async (req, res) => {
  const id = Number(req.params.id); await checkPwd(req.body.password);
  await (await rq()).input('id', sql.Int, id).input('h', sql.VarChar(100), await hashPassword(req.body.password)).input('c', sql.Bit, !!req.body.CHANGE_PWD).query('UPDATE AMC_USER SET LOGIN_PWD = @h, CHANGE_PWD = @c, FAIL_COUNT = 0, LOCK_UNTIL = NULL WHERE USER_ID = @id');
  await endUserSessions(id, 'PWD_CHANGED', id === req.ctx.userId ? req.ctx.sessionId : null);
  await audit(req.ctx, 'AMC_USER', id, 'PWD_RESET'); res.json({ success: true });
}));
r.post('/users/:id/unlock', requireAuth, requireOwner, wrap(async (req, res) => { await (await rq()).input('id', sql.Int, Number(req.params.id)).query('UPDATE AMC_USER SET FAIL_COUNT = 0, LOCK_UNTIL = NULL WHERE USER_ID = @id'); await audit(req.ctx, 'AMC_USER', req.params.id, 'UNLOCK'); res.json({ success: true }); }));
r.post('/users/:id/reset-2fa', requireAuth, requireOwner, wrap(async (req, res) => { await (await rq()).input('id', sql.Int, Number(req.params.id)).query('UPDATE AMC_USER SET TOTP_ON = 0, TOTP_SECRET = NULL WHERE USER_ID = @id'); await audit(req.ctx, 'AMC_USER', req.params.id, '2FA_RESET'); res.json({ success: true }); }));
r.post('/users/:id/sign-out', requireAuth, requireOwner, wrap(async (req, res) => { await endUserSessions(Number(req.params.id), 'KICKED'); await audit(req.ctx, 'AMC_USER', req.params.id, 'KICK'); res.json({ success: true }); }));
export default r;
