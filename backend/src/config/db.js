import sql from 'mssql';
import { env } from './env.js';

/** One database (DcAmc), one cached pool. Routes never close it. */
const baseOptions = {
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 20000, requestTimeout: 120000 },
  pool: { max: 10, min: 0, idleTimeoutMillis: 300000 },
};
export function authConfig({ user, password, auth = 'sql', domain = '' }) {
  if (String(auth).toLowerCase() === 'ntlm') return { authentication: { type: 'ntlm', options: { domain: domain || '', userName: user, password } } };
  return { user, password };
}
let poolPromise = null;
export function db() {
  if (!poolPromise) {
    const cfg = { ...baseOptions, server: env.db.server, port: env.db.port, database: env.db.database, ...authConfig(env.db) };
    poolPromise = new sql.ConnectionPool(cfg).connect().catch((e) => { poolPromise = null; throw e; });
  }
  return poolPromise;
}
/** Server-level connection (master) with the same login — creating the database, backups. Caller closes it. */
export const adminPool = (database = 'master') => new sql.ConnectionPool({ ...baseOptions, pool: { max: 2, min: 0, idleTimeoutMillis: 30000 }, server: env.db.server, port: env.db.port, database, ...authConfig(env.db) }).connect();
/** A request on the main pool. */
export async function rq() { return (await db()).request(); }
export async function dbStatus() {
  try { const p = await db(); const r = await p.request().query('SELECT DB_NAME() AS db, @@SERVERNAME AS server'); return { ok: true, ...r.recordset[0] }; }
  catch (e) { return { ok: false, error: e.message }; }
}
export { sql };
