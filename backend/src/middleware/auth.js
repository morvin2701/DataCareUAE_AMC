import { verifyToken, touchSession } from '../services/sessionService.js';
import { getIdleMinutes, USER_COLS } from '../services/authService.js';
import { unauthorized, forbidden, wrap, HttpError } from '../utils/httpError.js';
import { rq, sql } from '../config/db.js';

const MUST_CHANGE_OK = [/^\/auth\/(me|logout|heartbeat)$/, /^\/me\/password$/];
/**
 * Bearer token → live session → req.ctx { userId, sessionId, user, role, idleMinutes }.
 * Roles: OWNER opens everything · ACCOUNTS money and contracts · SUPPORT customers, tickets and visits.
 */
export const requireAuth = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw unauthorized();
  const claims = verifyToken(token);
  const idleMinutes = await getIdleMinutes();
  const s = await touchSession(claims.sid, idleMinutes);
  if (s.USER_ID !== claims.uid) throw unauthorized();
  const u = (await (await rq()).input('id', sql.Int, s.USER_ID).query(`SELECT ${USER_COLS} FROM AMC_USER WHERE USER_ID = @id`)).recordset[0];
  if (!u || !u.ACTIVE) throw unauthorized('This login is switched off.', 'INACTIVE');
  req.ctx = { userId: u.USER_ID, sessionId: s.SESSION_ID, user: u, role: u.ROLE, idleMinutes, mustChange: !!u.CHANGE_PWD };
  if (req.ctx.mustChange && !MUST_CHANGE_OK.some((re) => re.test(req.path))) throw new HttpError(403, 'Change your password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
  next();
});
/** requireRole('OWNER', 'ACCOUNTS') — the owner is always allowed. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (req.ctx?.role === 'OWNER' || roles.includes(req.ctx?.role)) return next();
  next(forbidden(`This needs the ${roles.map((r) => r.toLowerCase()).join(' or ')} role — ask the owner.`, 'NO_RIGHT'));
};
export const requireOwner = requireRole('OWNER');
/** SUPPORT never sees money: strip amounts from a row or list. */
const MONEY = ['AMOUNT', 'VAT_AMT', 'TOTAL', 'PAID', 'BALANCE', 'OUTSTANDING', 'VAT_PRC', 'INSTALL_AMT', 'BILLED', 'RECEIVED', 'EST_AMT'];
export const noMoney = (ctx, rows) => {
  if (ctx.role !== 'SUPPORT') return rows;
  const strip = (r) => { const o = { ...r }; for (const k of MONEY) if (k in o) o[k] = null; return o; };
  return Array.isArray(rows) ? rows.map(strip) : rows ? strip(rows) : rows;
};
