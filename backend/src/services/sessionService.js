import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { rq, sql } from '../config/db.js';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/httpError.js';

/** Idle limit 0 = no sign-out for inactivity; a session nobody touched for 7 days still ends. */
const ABANDONED_MINUTES = 7 * 24 * 60;
const effectiveIdle = (m) => (Number(m) > 0 ? Number(m) : ABANDONED_MINUTES);
export const signToken = (payload, idleMinutes) => jwt.sign(payload, env.sessionSecret, { expiresIn: Number(idleMinutes) > 0 ? '12h' : '30d' });
export function verifyToken(token) { try { return jwt.verify(token, env.sessionSecret); } catch { throw unauthorized('Session expired. Please sign in again.', 'TOKEN_INVALID'); } }

export async function openSession({ userId, idleMinutes, ip, userAgent }) {
  await (await rq()).input('idle', sql.Int, effectiveIdle(idleMinutes)).query(`UPDATE USER_SESSION SET END_TIME = SYSUTCDATETIME(), END_REASON = 'IDLE' WHERE END_TIME IS NULL AND LAST_TIME < DATEADD(minute, -@idle, SYSUTCDATETIME())`);
  const sid = randomBytes(24).toString('base64url');
  await (await rq()).input('sid', sql.VarChar(64), sid).input('uid', sql.Int, userId).input('ip', sql.VarChar(64), ip || '').input('ua', sql.NVarChar(300), (userAgent || '').slice(0, 300))
    .query('INSERT INTO USER_SESSION (SESSION_ID, USER_ID, IP_ADDR, USER_AGENT) VALUES (@sid, @uid, @ip, @ua)');
  return sid;
}
/** Live session row (touches LAST_TIME) or 401 SESSION_IDLE. */
export async function touchSession(sid, idleMinutes) {
  const r = await (await rq()).input('sid', sql.VarChar(64), sid).input('idle', sql.Int, effectiveIdle(idleMinutes)).query(`UPDATE USER_SESSION SET LAST_TIME = SYSUTCDATETIME()
    OUTPUT inserted.SESSION_ID, inserted.USER_ID WHERE SESSION_ID = @sid AND END_TIME IS NULL AND LAST_TIME >= DATEADD(minute, -@idle, SYSUTCDATETIME())`);
  const s = r.recordset[0];
  if (!s) { await (await rq()).input('sid', sql.VarChar(64), sid).query(`UPDATE USER_SESSION SET END_TIME = SYSUTCDATETIME(), END_REASON = 'IDLE' WHERE SESSION_ID = @sid AND END_TIME IS NULL`); throw unauthorized('You were signed out after inactivity.', 'SESSION_IDLE'); }
  return s;
}
export async function closeSession(sid, reason = 'LOGOUT') {
  await (await rq()).input('sid', sql.VarChar(64), sid).input('r', sql.VarChar(20), reason).query('UPDATE USER_SESSION SET END_TIME = SYSUTCDATETIME(), END_REASON = @r WHERE SESSION_ID = @sid AND END_TIME IS NULL');
}
export async function endUserSessions(userId, reason = 'KICKED', keep = null) {
  await (await rq()).input('u', sql.Int, userId).input('r', sql.VarChar(20), reason).input('keep', sql.VarChar(64), keep).query('UPDATE USER_SESSION SET END_TIME = SYSUTCDATETIME(), END_REASON = @r WHERE USER_ID = @u AND END_TIME IS NULL AND (@keep IS NULL OR SESSION_ID <> @keep)');
}
