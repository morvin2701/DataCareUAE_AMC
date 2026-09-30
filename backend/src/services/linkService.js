import { rq, sql } from '../config/db.js';
import { encrypt, decrypt, sha256, safeEqual, newSecret } from '../utils/crypto.js';
import { HttpError } from '../utils/httpError.js';
import { audit } from './audit.js';

/**
 * The link between DcAMC and every customer's ERP server.
 *   A link key reads SRV0001.<secret>. The server code before the dot names the AMC_SERVER row; the secret is kept as
 *   sha256 (LINK_KEY_HASH) to verify an incoming heartbeat and AES-encrypted (LINK_KEY_ENC) for the ping test. Shown once.
 *   Heartbeat: POST /api/link/heartbeat with X-Link-Key → upsert AMC_SERVER + AMC_CUSTOMER, then retry that server's queue.
 *   The link is one way: DcAMC reads what the ERP sends and never changes anything there.
 */
export const OFFLINE_HOURS = 48;
export const SERVER_COLS = 'SERVER_ID, SERVER_CODE, NAME, BASE_URL, IP, HOSTNAME, APP_VERSION, PENDING_SCRIPTS, LAST_HEARTBEAT, ACTIVE, ENTRY_DATE, EDIT_DATE, CASE WHEN LINK_KEY_HASH IS NULL THEN 0 ELSE 1 END AS HAS_KEY, CASE WHEN LAST_HEARTBEAT IS NULL OR LAST_HEARTBEAT < DATEADD(hour, -48, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS OFFLINE';

const nextCode = async () => { const n = (await (await rq()).query("SELECT MAX(TRY_CAST(SUBSTRING(SERVER_CODE, 4, 4) AS INT)) AS N FROM AMC_SERVER WHERE SERVER_CODE LIKE 'SRV[0-9][0-9][0-9][0-9]'")).recordset[0].N || 0; return `SRV${String(n + 1).padStart(4, '0')}`; };
const keyFor = (code, secret) => `${code}.${secret}`;

export async function listServers() {
  const q = await (await rq()).query(`SELECT ${SERVER_COLS}, (SELECT COUNT(*) FROM AMC_CUSTOMER C WHERE C.SERVER_ID = S.SERVER_ID) AS SHOPS, 0 AS QUEUED FROM AMC_SERVER S ORDER BY SERVER_CODE`);
  return q.recordset.map((s) => ({ ...s, ACTIVE: !!s.ACTIVE, HAS_KEY: !!s.HAS_KEY, OFFLINE: !!s.OFFLINE }));
}
export async function getServer(id) { const q = await (await rq()).input('id', sql.Int, id).query(`SELECT ${SERVER_COLS} FROM AMC_SERVER WHERE SERVER_ID = @id`); const s = q.recordset[0]; return s ? { ...s, ACTIVE: !!s.ACTIVE, HAS_KEY: !!s.HAS_KEY, OFFLINE: !!s.OFFLINE } : null; }
/** A new server row with its one-time key. */
export async function createServer(ctx, { name, baseUrl }) {
  const n = String(name || '').trim().slice(0, 150); if (!n) throw new HttpError(400, 'Give the server a name (the customer, or the machine).', 'VALIDATION');
  const code = await nextCode(); const secret = newSecret();
  const q = await (await rq()).input('c', sql.VarChar(20), code).input('n', sql.NVarChar(150), n).input('u', sql.VarChar(300), cleanUrl(baseUrl)).input('h', sql.VarChar(100), sha256(secret)).input('e', sql.VarChar(500), encrypt(secret))
    .query('INSERT INTO AMC_SERVER (SERVER_CODE, NAME, BASE_URL, LINK_KEY_HASH, LINK_KEY_ENC) OUTPUT inserted.SERVER_ID VALUES (@c, @n, @u, @h, @e)');
  const id = q.recordset[0].SERVER_ID;
  await audit(ctx, 'AMC_SERVER', code, 'CREATE', { name: n, baseUrl });
  return { server: await getServer(id), key: keyFor(code, secret) };
}
export async function updateServer(ctx, id, { name, baseUrl, active }) {
  const s = await getServer(id); if (!s) throw new HttpError(404, 'Server not found', 'NOT_FOUND');
  await (await rq()).input('id', sql.Int, id).input('n', sql.NVarChar(150), String(name ?? s.NAME).trim().slice(0, 150) || s.NAME).input('u', sql.VarChar(300), baseUrl === undefined ? s.BASE_URL : cleanUrl(baseUrl)).input('a', sql.Bit, active === undefined ? s.ACTIVE : !!active)
    .query('UPDATE AMC_SERVER SET NAME = @n, BASE_URL = @u, ACTIVE = @a, EDIT_DATE = SYSUTCDATETIME() WHERE SERVER_ID = @id');
  await audit(ctx, 'AMC_SERVER', s.SERVER_CODE, 'UPDATE', { name, baseUrl, active });
  return getServer(id);
}
/** A fresh key; the old one stops working at once (the customer's .env must be updated). */
export async function rotateKey(ctx, id) {
  const s = await getServer(id); if (!s) throw new HttpError(404, 'Server not found', 'NOT_FOUND');
  const secret = newSecret();
  await (await rq()).input('id', sql.Int, id).input('h', sql.VarChar(100), sha256(secret)).input('e', sql.VarChar(500), encrypt(secret)).query('UPDATE AMC_SERVER SET LINK_KEY_HASH = @h, LINK_KEY_ENC = @e, EDIT_DATE = SYSUTCDATETIME() WHERE SERVER_ID = @id');
  await audit(ctx, 'AMC_SERVER', s.SERVER_CODE, 'ROTATE_KEY');
  return { key: keyFor(s.SERVER_CODE, secret) };
}
const cleanUrl = (u) => { const s = String(u || '').trim().replace(/\/+$/, '').slice(0, 300); if (s && !/^https?:\/\//i.test(s)) throw new HttpError(400, 'The server address must start with http:// or https://', 'VALIDATION'); return s || null; };

/** X-Link-Key → the AMC_SERVER row, or 401. */
export async function serverForKey(key) {
  const m = /^([A-Z0-9]{4,20})\.([A-Za-z0-9_-]{16,})$/.exec(String(key || '').trim()); if (!m) throw new HttpError(401, 'The link key is missing or malformed.', 'BAD_KEY');
  const q = await (await rq()).input('c', sql.VarChar(20), m[1]).query('SELECT SERVER_ID, SERVER_CODE, NAME, BASE_URL, LINK_KEY_HASH, ACTIVE FROM AMC_SERVER WHERE SERVER_CODE = @c');
  const s = q.recordset[0];
  if (!s || !s.LINK_KEY_HASH || !safeEqual(s.LINK_KEY_HASH, sha256(m[2]))) throw new HttpError(401, 'The link key is not recognised.', 'BAD_KEY');
  if (!s.ACTIVE) throw new HttpError(403, 'This server is switched off in DcAMC.', 'SERVER_OFF');
  return s;
}
const str = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const date = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);
const dt = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
/** One heartbeat: the server's own facts, then every shop it carries. Nothing beyond the payload is stored. */
export async function applyHeartbeat(server, body, ip) {
  const sv = body?.server || {}; const shops = Array.isArray(body?.shops) ? body.shops : [];
  await (await rq()).input('id', sql.Int, server.SERVER_ID).input('v', sql.VarChar(60), str(sv.appVersion, 60)).input('h', sql.NVarChar(150), str(sv.hostname, 150)).input('ip', sql.VarChar(64), str(sv.ip, 64) || ip || null).input('p', sql.Int, int(sv.pendingScripts) || 0)
    .query('UPDATE AMC_SERVER SET APP_VERSION = @v, HOSTNAME = @h, IP = @ip, PENDING_SCRIPTS = @p, LAST_HEARTBEAT = SYSUTCDATETIME(), EDIT_DATE = SYSUTCDATETIME() WHERE SERVER_ID = @id');
  let n = 0;
  for (const s of shops) {
    const code = str(s.shopCode, 20)?.toUpperCase(); if (!code) continue;
    await (await rq()).input('sid', sql.Int, server.SERVER_ID).input('code', sql.VarChar(20), code).input('name', sql.NVarChar(150), str(s.shopName, 150) || code).input('hdd', sql.VarChar(20), str(s.hdd, 20)?.toUpperCase())
      .input('plan', sql.VarChar(20), str(s.plan, 20)?.toUpperCase()).input('st', sql.VarChar(10), str(s.status, 10)?.toUpperCase()).input('tills', sql.Int, int(s.tills) ?? 0).input('ls', sql.Date, date(s.startDate)).input('le', sql.Date, date(s.endDate))
      .input('cn', sql.NVarChar(100), str(s.contact, 100)).input('mo', sql.VarChar(20), str(String(s.mobile || '').replace(/\D/g, ''), 20)).input('em', sql.NVarChar(150), str(s.email, 150)).input('ec', sql.VarChar(3), str(s.emirate, 3)?.toUpperCase())
      .input('ll', sql.DateTime2, dt(s.lastLogin)).input('us', sql.Int, int(s.users)).input('et', sql.Int, int(s.entriesToday)).input('e30', sql.Int, int(s.entries30d))
      .query(`DECLARE @id INT = (SELECT TOP 1 CUST_ID FROM AMC_CUSTOMER WHERE SERVER_ID = @sid AND SHOP_CODE = @code);
        IF @id IS NULL SET @id = (SELECT TOP 1 CUST_ID FROM AMC_CUSTOMER WHERE SERVER_ID IS NULL AND ((@hdd IS NOT NULL AND HDD = @hdd) OR SHOP_CODE = @code) ORDER BY CASE WHEN HDD = @hdd THEN 0 ELSE 1 END);   /* a party typed here before its ERP reported */
        IF @id IS NOT NULL
          UPDATE AMC_CUSTOMER SET SERVER_ID = @sid, SHOP_CODE = @code, SHOP_NAME = @name, HDD = ISNULL(@hdd, HDD), PLAN_CODE = ISNULL(@plan, PLAN_CODE), STATUS = ISNULL(@st, STATUS), TILLS = @tills, LIC_START = ISNULL(@ls, LIC_START), LIC_END = ISNULL(@le, LIC_END), CONTACT_NAME = ISNULL(@cn, CONTACT_NAME), MOBILE_NO = ISNULL(@mo, MOBILE_NO), EMAIL_ID = ISNULL(@em, EMAIL_ID), EMIRATE_CODE = ISNULL(@ec, EMIRATE_CODE), LAST_LOGIN = @ll, USERS = @us, ENTRIES_TODAY = @et, ENTRIES_30D = @e30, LAST_SEEN = SYSUTCDATETIME(), EDIT_DATE = SYSUTCDATETIME() WHERE CUST_ID = @id
        ELSE INSERT INTO AMC_CUSTOMER (SOURCE, SERVER_ID, SHOP_CODE, SHOP_NAME, HDD, PLAN_CODE, STATUS, TILLS, LIC_START, LIC_END, INSTALL_DATE, CONTACT_NAME, MOBILE_NO, EMAIL_ID, EMIRATE_CODE, LAST_LOGIN, USERS, ENTRIES_TODAY, ENTRIES_30D, INSTALLER, LAST_SEEN)
          VALUES ('ERP', @sid, @code, @name, @hdd, @plan, @st, @tills, @ls, @le, @ls, @cn, @mo, @em, @ec, @ll, @us, @et, @e30, CASE WHEN LEN(@hdd) = 10 THEN RIGHT(@hdd, 2) END, SYSUTCDATETIME())`);
    n += 1;
  }
  await audit({ userId: null }, 'AMC_SERVER', server.SERVER_CODE, 'HEARTBEAT', { shops: n, version: str(sv.appVersion, 60) });
  return { shops: n };
}

// ───────────────────────── the link is one way: nothing is ever sent to a customer's ERP
async function secretOf(serverId) { const r = (await (await rq()).input('id', sql.Int, serverId).query('SELECT SERVER_CODE, BASE_URL, LINK_KEY_ENC FROM AMC_SERVER WHERE SERVER_ID = @id')).recordset[0]; if (!r?.LINK_KEY_ENC) throw new Error('This server has no link key yet.'); return { ...r, secret: decrypt(r.LINK_KEY_ENC) }; }
/** A dry run against the server: is it reachable and does the key open it? Uses a probe the ERP answers without changing anything. */
export async function testServer(serverId) {
  const s = await secretOf(serverId); if (!s.BASE_URL) return { ok: false, answer: 'No server address (BASE_URL).' };
  try { const res = await fetch(`${s.BASE_URL}/api/link/ping`, { headers: { 'X-Link-Key': keyFor(s.SERVER_CODE, s.secret) }, signal: AbortSignal.timeout(10000) }); const j = await res.json().catch(() => ({})); return { ok: res.ok && j.success !== false, status: res.status, answer: j.message || (res.ok ? 'The server answered.' : `HTTP ${res.status}`), version: j.appVersion || null }; }
  catch (e) { return { ok: false, answer: `Could not reach ${s.BASE_URL}: ${e.message}` }; }
}
