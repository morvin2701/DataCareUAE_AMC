import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, verify2fa, userOut, USER_COLS } from '../services/authService.js';
import { closeSession, endUserSessions } from '../services/sessionService.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, badRequest } from '../utils/httpError.js';
import { rq, sql } from '../config/db.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { getPolicy, passwordProblems, newTotpSecret, verifyTotp, otpauthUrl } from '../services/securityService.js';
import { getSetting } from '../services/settingsService.js';
import { audit } from '../services/audit.js';

const r = Router();
const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => String(req.body?.username || req.ip).toLowerCase(), message: { success: false, code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } });

r.post('/auth/login', loginLimiter, wrap(async (req, res) => { const { username, password } = req.body || {}; res.json({ success: true, ...(await login({ username, password, ip: req.ip, userAgent: req.headers['user-agent'] })) }); }));
r.post('/auth/2fa', loginLimiter, wrap(async (req, res) => { const { ticket, code } = req.body || {}; res.json({ success: true, ...(await verify2fa({ ticket, code, ip: req.ip, userAgent: req.headers['user-agent'] })) }); }));
r.get('/auth/me', requireAuth, wrap(async (req, res) => {
  const company = await getSetting('COMPANY');
  res.json({ success: true, user: userOut(req.ctx.user), idleMinutes: req.ctx.idleMinutes, mustChangePassword: req.ctx.mustChange, company: { name: company.name } });
}));
r.post('/auth/heartbeat', requireAuth, (req, res) => res.json({ success: true, idleMinutes: req.ctx.idleMinutes, serverTime: new Date().toISOString() }));
r.post('/auth/logout', requireAuth, wrap(async (req, res) => { await closeSession(req.ctx.sessionId, 'LOGOUT'); res.json({ success: true }); }));

// ---- self service
r.put('/me', requireAuth, wrap(async (req, res) => {
  const name = String(req.body?.USER_NAME || '').trim().slice(0, 100); if (!name) throw badRequest('Your name cannot be empty.');
  await (await rq()).input('id', sql.Int, req.ctx.userId).input('n', sql.NVarChar(100), name).input('m', sql.VarChar(20), String(req.body?.MOBILE_NO || '').replace(/\D/g, '').slice(0, 20) || null).input('e', sql.NVarChar(150), String(req.body?.EMAIL_ID || '').trim().slice(0, 150) || null)
    .query('UPDATE AMC_USER SET USER_NAME = @n, MOBILE_NO = @m, EMAIL_ID = @e, EDIT_DATE = SYSUTCDATETIME() WHERE USER_ID = @id');
  await audit(req.ctx, 'AMC_USER', req.ctx.userId, 'UPDATE', { self: true }); res.json({ success: true });
}));
r.post('/me/password', requireAuth, wrap(async (req, res) => {
  const { current, password } = req.body || {};
  const u = (await (await rq()).input('id', sql.Int, req.ctx.userId).query('SELECT LOGIN_PWD FROM AMC_USER WHERE USER_ID = @id')).recordset[0];
  if (!(await verifyPassword(current, u.LOGIN_PWD))) throw badRequest('Current password is incorrect.');
  if (current === password) throw badRequest('The new password must be different from the current one.');
  const bad = passwordProblems(password, await getPolicy()); if (bad.length) throw badRequest(`Password needs ${bad.join(', ')}.`, 'PASSWORD_POLICY');
  await (await rq()).input('id', sql.Int, req.ctx.userId).input('h', sql.VarChar(100), await hashPassword(password)).query('UPDATE AMC_USER SET LOGIN_PWD = @h, CHANGE_PWD = 0, EDIT_DATE = SYSUTCDATETIME() WHERE USER_ID = @id');
  await endUserSessions(req.ctx.userId, 'PWD_CHANGED', req.ctx.sessionId);
  await audit(req.ctx, 'AMC_USER', req.ctx.userId, 'PWD_CHANGE'); res.json({ success: true });
}));
/** Authenticator app: setup gives the secret + otpauth link, enable proves it with a code, disable needs the password. */
r.post('/me/2fa/setup', requireAuth, wrap(async (req, res) => {
  const u = (await (await rq()).input('id', sql.Int, req.ctx.userId).query('SELECT LOGIN_NAME, LOGIN_PWD FROM AMC_USER WHERE USER_ID = @id')).recordset[0];
  if (!(await verifyPassword(req.body?.password, u.LOGIN_PWD))) throw badRequest('Password is incorrect.');
  const secret = newTotpSecret();
  await (await rq()).input('id', sql.Int, req.ctx.userId).input('s', sql.VarChar(100), secret).query('UPDATE AMC_USER SET TOTP_SECRET = @s, TOTP_ON = 0 WHERE USER_ID = @id');
  res.json({ success: true, secret, url: otpauthUrl({ secret, account: u.LOGIN_NAME, issuer: 'DcAMC' }) });
}));
r.post('/me/2fa/enable', requireAuth, wrap(async (req, res) => {
  const u = (await (await rq()).input('id', sql.Int, req.ctx.userId).query('SELECT TOTP_SECRET FROM AMC_USER WHERE USER_ID = @id')).recordset[0];
  if (!u?.TOTP_SECRET || !verifyTotp(u.TOTP_SECRET, req.body?.code)) throw badRequest('That code is not right — try the next one the app shows.');
  await (await rq()).input('id', sql.Int, req.ctx.userId).query('UPDATE AMC_USER SET TOTP_ON = 1 WHERE USER_ID = @id');
  await audit(req.ctx, 'AMC_USER', req.ctx.userId, '2FA_ON'); res.json({ success: true });
}));
r.post('/me/2fa/disable', requireAuth, wrap(async (req, res) => {
  const u = (await (await rq()).input('id', sql.Int, req.ctx.userId).query('SELECT LOGIN_PWD FROM AMC_USER WHERE USER_ID = @id')).recordset[0];
  if (!(await verifyPassword(req.body?.password, u.LOGIN_PWD))) throw badRequest('Password is incorrect.');
  await (await rq()).input('id', sql.Int, req.ctx.userId).query('UPDATE AMC_USER SET TOTP_ON = 0, TOTP_SECRET = NULL WHERE USER_ID = @id');
  await audit(req.ctx, 'AMC_USER', req.ctx.userId, '2FA_OFF'); res.json({ success: true });
}));
r.get('/me/sessions', requireAuth, wrap(async (req, res) => {
  const q = await (await rq()).input('u', sql.Int, req.ctx.userId).query('SELECT SESSION_ID, IP_ADDR, USER_AGENT, START_TIME, LAST_TIME FROM USER_SESSION WHERE USER_ID = @u AND END_TIME IS NULL ORDER BY LAST_TIME DESC');
  res.json({ success: true, rows: q.recordset.map((s) => ({ IP_ADDR: s.IP_ADDR, USER_AGENT: s.USER_AGENT, START_TIME: s.START_TIME, LAST_TIME: s.LAST_TIME, CURRENT: s.SESSION_ID === req.ctx.sessionId })) });
}));
r.post('/me/sessions/end-others', requireAuth, wrap(async (req, res) => { await endUserSessions(req.ctx.userId, 'KICKED', req.ctx.sessionId); res.json({ success: true }); }));
export default r;
