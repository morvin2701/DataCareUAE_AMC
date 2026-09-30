import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Split a T-SQL file on GO lines and run each batch. */
export async function runSqlFile(pool, file) {
  const batches = readFileSync(file, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  for (const b of batches) await pool.request().batch(b);
}
/** Apply every *.sql in `dir` that SCHEMA_VER has not seen, in name order. */
export async function runSqlDir(pool, dir, log = console.log) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await pool.request().input('n', f).query('SELECT 1 FROM SCHEMA_VER WHERE SCRIPT_NAME = @n').catch(() => ({ recordset: [] }));
    if (done.recordset.length) { log(`  = ${f} (already applied)`); continue; }
    try { await runSqlFile(pool, join(dir, f)); } catch (e) { e.sqlFile = f; throw e; }
    await pool.request().input('n', f).query('INSERT INTO SCHEMA_VER (SCRIPT_NAME) VALUES (@n)').catch(() => {});
    log(`  + ${f}`);
  }
}
export async function ensureDatabase(adminPool, name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name ${name}`);
  await adminPool.request().batch(`IF DB_ID('${name}') IS NULL CREATE DATABASE [${name}]`);
}
