import fs from 'node:fs';
import { adminPool, rq, sql } from '../config/db.js';
import { env } from '../config/env.js';
import { getSetting, setSetting } from './settingsService.js';
import { uploadFile, pruneDrive, driveConfigured } from './driveService.js';
import { audit } from './audit.js';

/**
 * Backups of DcAmc. SQL Server writes the .bak into BACKUP_PATH (.env) on its own machine — DcAMC runs on that same
 * machine, so the file is then read from disk for the optional Google Drive copy. Automatic backups run daily at the
 * configured Dubai time and keep the newest KEEP files; manual ones are made from the screen. Everything lands in BACKUP_LOG.
 */
const TZ_MS = 4 * 3600e3;
const stamp = () => new Date(Date.now() + TZ_MS).toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
const q = (s) => String(s).replace(/'/g, "''");
let running = false;
export async function runBackup(ctx, kind = 'MANUAL') {
  if (running) { const e = new Error('A backup is already running — wait for it to finish.'); e.status = 409; throw e; }
  running = true; const s = await getSetting('BACKUP'); const dir = String(env.backupPath || 'C:\\AmcBkps').replace(/[\\/]+$/, ''); const file = `${dir}\\${kind}_DcAmc_${stamp()}.bak`;
  const id = (await (await rq()).input('k', sql.VarChar(10), kind).input('u', sql.Int, ctx?.userId ?? null).query('INSERT INTO BACKUP_LOG (KIND, USER_ID) OUTPUT inserted.BK_ID VALUES (@k, @u)')).recordset[0].BK_ID;
  try {
    const master = await adminPool('master');
    try { try { await master.request().batch(`EXEC master.dbo.xp_create_subdir N'${q(dir)}'`); } catch { /* folder may exist, or no rights: the backup says so */ } await master.request().batch(`BACKUP DATABASE [${env.db.database}] TO DISK = N'${q(file)}' WITH INIT, FORMAT, COPY_ONLY, CHECKSUM, NAME = N'DcAmc ${kind} ${stamp()}'`); } finally { await master.close(); }
    let bytes = null; try { bytes = fs.statSync(file).size; } catch { /* SQL Server on another machine: the file is not on this disk */ }
    await (await rq()).input('id', sql.Int, id).input('f', sql.NVarChar(400), file).input('b', sql.BigInt, bytes).query("UPDATE BACKUP_LOG SET STATUS = 'OK', END_TIME = SYSUTCDATETIME(), FILE_PATH = @f, BYTES = @b WHERE BK_ID = @id");
    if (s.driveOn && (await getSetting('DRIVE_SECRET')) && bytes != null) {
      try { const up = await uploadFile({ refreshToken: await getSetting('DRIVE_SECRET'), folderId: s.driveFolderId, filePath: file, name: file.split('\\').pop(), onFolder: (fid) => setSetting('BACKUP', { ...s, driveFolderId: fid }) }); await (await rq()).input('id', sql.Int, id).input('d', sql.VarChar(100), up.fileId).query("UPDATE BACKUP_LOG SET DRIVE_STATUS = 'OK', DRIVE_FILE_ID = @d WHERE BK_ID = @id"); await pruneDrive({ refreshToken: await getSetting('DRIVE_SECRET'), folderId: up.folderId, keep: Number(s.keep) || 7 }).catch(() => {}); }
      catch (e) { await (await rq()).input('id', sql.Int, id).input('m', sql.NVarChar(1000), `Google Drive copy failed: ${e.message}`.slice(0, 1000)).query("UPDATE BACKUP_LOG SET DRIVE_STATUS = 'FAILED', ERROR_MSG = @m WHERE BK_ID = @id"); }
    }
    await prune(dir, Number(s.keep) || 7);
    await audit(ctx || { userId: null }, 'BACKUP_LOG', id, kind, { file, bytes });
    return getLog(id);
  } catch (e) {
    const msg = [...(e.precedingErrors || []).map((x) => x.message), e.message].filter(Boolean).join(' ').slice(0, 1000);
    await (await rq()).input('id', sql.Int, id).input('m', sql.NVarChar(1000), msg).query("UPDATE BACKUP_LOG SET STATUS = 'FAILED', END_TIME = SYSUTCDATETIME(), ERROR_MSG = @m WHERE BK_ID = @id");
    const err = new Error(`Backup failed — ${msg}. Make sure ${dir} exists on the SQL Server machine and its service account may write there.`); err.status = 500; err.fromSql = true; throw err;
  } finally { running = false; }
}
/** Keep the newest `keep` AUTO files on disk (manual ones stay). Best effort: only when the folder is on this machine. */
async function prune(dir, keep) {
  try { const files = fs.readdirSync(dir).filter((f) => /^AUTO_DcAmc_.*\.bak$/i.test(f)).sort().reverse(); for (const f of files.slice(keep)) fs.unlinkSync(`${dir}\\${f}`); } catch { /* not local, or nothing to do */ }
}
export const getLog = async (id) => (await (await rq()).input('id', sql.Int, id).query('SELECT * FROM BACKUP_LOG WHERE BK_ID = @id')).recordset[0];
export const listLog = async () => (await (await rq()).query('SELECT TOP 30 B.*, U.USER_NAME FROM BACKUP_LOG B LEFT JOIN AMC_USER U ON U.USER_ID = B.USER_ID ORDER BY B.BK_ID DESC')).recordset;
export async function backupStatus() { const s = await getSetting('BACKUP'); return { settings: { ...s, driveConfigured: driveConfigured(), driveConnected: !!(await getSetting('DRIVE_SECRET')) }, path: env.backupPath, rows: await listLog(), running }; }
/** Daily at the configured Dubai time (checked every 5 minutes). */
export function startBackupScheduler() {
  const tick = async () => {
    try {
      const s = await getSetting('BACKUP'); if (!s.autoOn) return;
      const now = new Date(Date.now() + TZ_MS); const hhmm = now.toISOString().slice(11, 16); const day = now.toISOString().slice(0, 10);
      if (hhmm < (s.time || '02:00')) return; if (s.lastAuto === day) return;
      await setSetting('BACKUP', { ...s, lastAuto: day }); const r = await runBackup(null, 'AUTO'); console.log(`[backup] automatic backup ${r.STATUS} ${r.FILE_PATH || ''}`);
    } catch (e) { console.warn('[backup]', e.message); }
  };
  const t = setInterval(tick, 5 * 60 * 1000); t.unref?.(); setTimeout(tick, 60 * 1000).unref?.();
  return () => clearInterval(t);
}
