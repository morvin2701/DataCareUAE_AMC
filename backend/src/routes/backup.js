import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, badRequest } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { runBackup, backupStatus } from '../services/backupService.js';
import { getSetting, setSetting, DEFAULTS } from '../services/settingsService.js';
import { driveConfigured, driveAuthUrl, exchangeCode, revokeDrive } from '../services/driveService.js';
import { audit } from '../services/audit.js';
/** Data backup (owner): run now, settings (auto time, keep, Google Drive), the log; the Drive OAuth round trip. */
const r = Router();
r.get('/backup', requireAuth, requireOwner, wrap(async (_req, res) => res.json({ success: true, ...(await backupStatus()) })));
r.post('/backup/run', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, log: await runBackup(req.ctx, 'MANUAL') })));
r.put('/backup/settings', requireAuth, requireOwner, wrap(async (req, res) => { const cur = await getSetting('BACKUP'); const v = { ...DEFAULTS.BACKUP, ...cur, ...(req.body?.value || {}) }; v.keep = Math.min(60, Math.max(1, parseInt(v.keep, 10) || 7)); if (!/^\d{2}:\d{2}$/.test(String(v.time))) throw badRequest('Time reads 02:00.'); await setSetting('BACKUP', v); await audit(req.ctx, 'APP_SET', 'BACKUP', 'UPDATE', { autoOn: v.autoOn, time: v.time, keep: v.keep, driveOn: v.driveOn }); res.json({ success: true, value: v }); }));
r.get('/backup/drive/connect', requireAuth, requireOwner, wrap(async (req, res) => { if (!driveConfigured()) throw badRequest('Google Drive is not set up on this server (GDRIVE_OAUTH_CLIENT_ID / SECRET and APP_BASE_URL in .env).'); res.json({ success: true, url: driveAuthUrl(jwt.sign({ uid: req.ctx.userId, purpose: 'drive' }, env.sessionSecret, { expiresIn: '10m' })) }); }));
r.get('/backup/drive/callback', wrap(async (req, res) => {
  let claims; try { claims = jwt.verify(String(req.query.state || ''), env.sessionSecret); } catch { return res.status(400).type('text').send('The Google Drive link expired — open Data backup and connect again.'); }
  if (claims.purpose !== 'drive' || !req.query.code) return res.status(400).type('text').send('Google did not return a code.');
  const { refreshToken, email } = await exchangeCode(String(req.query.code)); await setSetting('DRIVE_SECRET', refreshToken); const s = await getSetting('BACKUP'); await setSetting('BACKUP', { ...s, driveOn: true, driveEmail: email || '' });
  await audit({ userId: claims.uid }, 'APP_SET', 'BACKUP', 'DRIVE_CONNECT', { email }); res.redirect(`${env.baseUrl || ''}/backup?drive=connected`);
}));
r.post('/backup/drive/disconnect', requireAuth, requireOwner, wrap(async (req, res) => { await revokeDrive(await getSetting('DRIVE_SECRET')); await setSetting('DRIVE_SECRET', null); const s = await getSetting('BACKUP'); await setSetting('BACKUP', { ...s, driveOn: false, driveEmail: '', driveFolderId: null }); await audit(req.ctx, 'APP_SET', 'BACKUP', 'DRIVE_DISCONNECT'); res.json({ success: true }); }));
export default r;
