import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';
import { db, adminPool } from '../config/db.js';
import { env } from '../config/env.js';
import { runSqlDir, ensureDatabase } from '../../scripts/sqlRunner.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Field update — bring DcAmc up to the running version: create the database if missing and apply every
 * database/*.sql not yet in SCHEMA_VER. Safe to press again. `bootstrap()` does the same on a fresh server at start,
 * so the very first sign-in is possible; after that only the button applies new scripts.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const DB_ROOT = [join(here, '..', '..', '..', 'database'), join(here, '..', '..', 'database')].find(existsSync) || join(here, '..', '..', '..', 'database');
const files = () => (existsSync(DB_ROOT) ? readdirSync(DB_ROOT).filter((f) => f.endsWith('.sql')).sort() : []);

export async function fieldUpdate() {
  if (!files().length) throw new HttpError(500, `No database scripts on the server (looked in ${DB_ROOT}).`, 'NO_SCRIPTS');
  const master = await adminPool('master'); try { await ensureDatabase(master, env.db.database); } finally { await master.close(); }
  const steps = [];
  try { await runSqlDir(await db(), DB_ROOT, (line) => steps.push(String(line).trim())); }
  catch (e) { const err = new HttpError(500, `${env.db.database}: ${e.sqlFile || 'a script'} could not be applied — ${String(e.message || e).slice(0, 300)}`, 'SCRIPT_FAILED'); err.fromSql = true; throw err; }
  const applied = steps.filter((s) => s.startsWith('+')).map((s) => s.slice(2));
  return { database: env.db.database, applied, skipped: steps.length - applied.length };
}
export async function schemaStatus() {
  const done = (await (await db()).request().query('SELECT SCRIPT_NAME FROM SCHEMA_VER').catch(() => ({ recordset: [] }))).recordset.map((r) => r.SCRIPT_NAME);
  const all = files();
  return { root: DB_ROOT, database: env.db.database, scripts: all.length, pending: all.filter((f) => !done.includes(f)) };
}
/** Fresh server: no SCHEMA_VER yet → apply everything so the owner can sign in. */
export async function bootstrap() {
  const master = await adminPool('master'); try { await ensureDatabase(master, env.db.database); } finally { await master.close(); }
  const has = (await (await db()).request().query("SELECT OBJECT_ID('SCHEMA_VER') AS O")).recordset[0].O;
  if (has) { const s = await schemaStatus(); if (s.pending.length) console.log(`[schema] ${s.pending.length} script(s) pending — run Settings → Field update`); return false; }
  console.log('[schema] fresh database — applying scripts');
  await runSqlDir(await db(), DB_ROOT, (l) => console.log(l));
  return true;
}
