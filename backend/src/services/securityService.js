import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { rq, sql } from '../config/db.js';
import { getSetting } from './settingsService.js';

export const ROLES = ['OWNER', 'ACCOUNTS', 'SUPPORT'];
export async function getPolicy() { return getSetting('SECURITY'); }
export function passwordProblems(pwd, p) {
  const s = String(pwd || ''); const out = [];
  if (s.length < (p.MIN_LEN || 8)) out.push(`at least ${p.MIN_LEN || 8} characters`);   /* the team signs in with their mobile numbers, so digits alone are fine */
  if (s.length > 128) out.push('at most 128 characters');
  return out;
}
export async function logLogin({ userId = null, loginName = null, result, ip = null, userAgent = null }) {
  try { await (await rq()).input('u', sql.Int, userId).input('n', sql.NVarChar(50), loginName ? String(loginName).slice(0, 50) : null).input('r', sql.VarChar(20), result).input('ip', sql.VarChar(64), ip || null).input('ua', sql.NVarChar(300), (userAgent || '').slice(0, 300) || null)
    .query('INSERT INTO LOGIN_LOG (USER_ID, LOGIN_NAME, RESULT, IP_ADDR, USER_AGENT) VALUES (@u, @n, @r, @ip, @ua)'); } catch (e) { console.warn('[login-log]', e.message); }
}
// ───────────────────────── TOTP (RFC 6238, 30 s, 6 digits, SHA-1 — Google / Microsoft Authenticator)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
function unbase32(s) { const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, val = 0; const out = []; for (const c of clean) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
export const newTotpSecret = () => base32(randomBytes(20));
export function totpAt(secret, counter) { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter)); const h = createHmac('sha1', unbase32(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1000000)).padStart(6, '0'); }
export function verifyTotp(secret, code, now = Date.now()) {
  const c = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 30000);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(c)));
}
export const otpauthUrl = ({ secret, account, issuer }) => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
