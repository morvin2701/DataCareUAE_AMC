import jwt from 'jsonwebtoken';
import { rq, sql } from '../config/db.js';
import { env } from '../config/env.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { openSession, signToken } from './sessionService.js';
import { unauthorized, badRequest, HttpError } from '../utils/httpError.js';
import { getPolicy, logLogin, verifyTotp } from './securityService.js';
import { getSetting } from './settingsService.js';

export const USER_COLS = 'USER_ID, LOGIN_NAME, USER_NAME, ROLE, MOBILE_NO, EMAIL_ID, ACTIVE, CHANGE_PWD, FAIL_COUNT, LOCK_UNTIL, TOTP_ON, LAST_LOGIN, ENTRY_DATE';
export const userOut = (u) => ({ USER_ID: u.USER_ID, LOGIN_NAME: u.LOGIN_NAME, USER_NAME: u.USER_NAME, ROLE: u.ROLE, MOBILE_NO: u.MOBILE_NO, EMAIL_ID: u.EMAIL_ID, ACTIVE: !!u.ACTIVE, CHANGE_PWD: !!u.CHANGE_PWD, TOTP_ON: !!u.TOTP_ON, LAST_LOGIN: u.LAST_LOGIN, ENTRY_DATE: u.ENTRY_DATE });
export const getIdleMinutes = async () => { const n = Number(await getSetting('IDLE_MINUTES')); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 15; };

/** Sign-in: user → lockout → password (failures count towards the lock) → authenticator code when switched on. */
export async function login({ username, password, ip, userAgent }) {
  if (!username || !password) throw badRequest('User name and password are required.');
  const name = String(username).trim(); const policy = await getPolicy();
  const user = (await (await rq()).input('u', sql.NVarChar(50), name).query(`SELECT TOP 1 ${USER_COLS}, LOGIN_PWD, TOTP_SECRET FROM AMC_USER WHERE LOWER(LOGIN_NAME) = LOWER(@u)`)).recordset[0];
  const log = (result) => logLogin({ userId: user?.USER_ID ?? null, loginName: name, result, ip, userAgent });
  if (!user) { await log('NO_USER'); throw unauthorized('Invalid user name or password.', 'BAD_CREDENTIALS'); }
  if (user.LOCK_UNTIL && new Date(user.LOCK_UNTIL) > new Date()) {
    await log('LOCKED'); const mins = Math.max(1, Math.ceil((new Date(user.LOCK_UNTIL) - Date.now()) / 60000));
    throw new HttpError(423, `This account is locked after too many wrong passwords. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or ask the owner to unlock it.`, 'ACCOUNT_LOCKED');
  }
  if (!(await verifyPassword(password, user.LOGIN_PWD))) {
    let msg = 'Invalid user name or password.';
    if (policy.LOCK_ATTEMPTS > 0) {
      const fails = Number(user.FAIL_COUNT || 0) + 1;
      if (fails >= policy.LOCK_ATTEMPTS) {
        await (await rq()).input('id', sql.Int, user.USER_ID).input('m', sql.Int, policy.LOCK_MINUTES).query('UPDATE AMC_USER SET FAIL_COUNT = 0, LOCK_UNTIL = DATEADD(minute, @m, SYSUTCDATETIME()) WHERE USER_ID = @id');
        await log('LOCKED'); throw new HttpError(423, `Too many wrong passwords — this account is locked for ${policy.LOCK_MINUTES} minutes.`, 'ACCOUNT_LOCKED');
      }
      await (await rq()).input('id', sql.Int, user.USER_ID).input('f', sql.Int, fails).query('UPDATE AMC_USER SET FAIL_COUNT = @f WHERE USER_ID = @id');
      const left = policy.LOCK_ATTEMPTS - fails; if (left <= 2) msg += ` ${left} attempt${left === 1 ? '' : 's'} left before the account locks.`;
    }
    await log('BAD_PASSWORD'); throw unauthorized(msg, 'BAD_CREDENTIALS');
  }
  if (!user.ACTIVE) { await log('INACTIVE'); throw unauthorized('Invalid user name or password.', 'BAD_CREDENTIALS'); }
  await (await rq()).input('id', sql.Int, user.USER_ID).query('UPDATE AMC_USER SET FAIL_COUNT = 0, LOCK_UNTIL = NULL WHERE USER_ID = @id');
  if (user.TOTP_ON) { await log('2FA_NEEDED'); return { twoFactor: true, ticket: jwt.sign({ uid: user.USER_ID, purpose: '2fa' }, env.sessionSecret, { expiresIn: '5m' }) }; }
  await log('OK');
  return startSession({ user, ip, userAgent });
}
export async function verify2fa({ ticket, code, ip, userAgent }) {
  let claims; try { claims = jwt.verify(ticket, env.sessionSecret); } catch { throw new HttpError(401, 'The sign-in ticket expired — enter your password again.', 'TICKET_EXPIRED'); }
  if (claims.purpose !== '2fa') throw unauthorized();
  const user = (await (await rq()).input('id', sql.Int, claims.uid).query(`SELECT ${USER_COLS}, TOTP_SECRET FROM AMC_USER WHERE USER_ID = @id`)).recordset[0];
  if (!user || !user.ACTIVE) throw unauthorized();
  if (!verifyTotp(user.TOTP_SECRET, code)) { await logLogin({ userId: user.USER_ID, loginName: user.LOGIN_NAME, result: 'BAD_CODE', ip, userAgent }); throw unauthorized('That code is not right. Codes change every 30 seconds.', 'BAD_CODE'); }
  await logLogin({ userId: user.USER_ID, loginName: user.LOGIN_NAME, result: 'OK', ip, userAgent });
  return startSession({ user, ip, userAgent });
}
export async function startSession({ user, ip, userAgent }) {
  const idleMinutes = await getIdleMinutes();
  const sid = await openSession({ userId: user.USER_ID, idleMinutes, ip, userAgent });
  await (await rq()).input('uid', sql.Int, user.USER_ID).query('UPDATE AMC_USER SET LAST_LOGIN = SYSUTCDATETIME() WHERE USER_ID = @uid');
  return { token: signToken({ uid: user.USER_ID, sid }, idleMinutes), user: userOut(user), mustChangePassword: !!user.CHANGE_PWD, idleMinutes };
}
/** The first owner, made once from .env when there is nobody to sign in. */
export async function seedOwner() {
  const n = (await (await rq()).query('SELECT COUNT(*) AS N FROM AMC_USER')).recordset[0].N;
  if (n > 0) return false;
  if (!env.owner.password) { console.warn('[users] AMC_USER is empty and OWNER_PASSWORD is not set — nobody can sign in yet'); return false; }
  await (await rq()).input('u', sql.NVarChar(50), env.owner.login).input('n', sql.NVarChar(100), env.owner.name).input('h', sql.VarChar(100), await hashPassword(env.owner.password))
    .query("INSERT INTO AMC_USER (LOGIN_NAME, USER_NAME, LOGIN_PWD, ROLE, ACTIVE) VALUES (@u, @n, @h, 'OWNER', 1)");
  console.log(`[users] owner login ${env.owner.login} created`);
  return true;
}
