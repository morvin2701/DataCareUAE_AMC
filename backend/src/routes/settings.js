import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, badRequest } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { getSetting, setSetting, hasSecret, DEFAULTS } from '../services/settingsService.js';

/**
 * Settings (owner): company details, numbering, VAT %, idle minutes, security, SLA hours, reminders, SMTP, WhatsApp, backup.
 * Secrets (SMTP password, WhatsApp licence) go to *_SECRET keys and are only ever reported as set / not set.
 */
const r = Router();
const PUBLIC = ['COMPANY', 'NUMBERING', 'VAT_PRC', 'IDLE_MINUTES', 'SECURITY', 'SLA_HOURS', 'SMTP', 'WHATSAPP', 'REMINDERS', 'BACKUP'];
const SECRETS = { SMTP: 'SMTP_SECRET', WHATSAPP: 'WHATSAPP_SECRET' };
r.get('/settings', requireAuth, wrap(async (req, res) => {
  const out = {}; for (const k of PUBLIC) out[k] = await getSetting(k);
  if (req.ctx.role !== 'OWNER') { const { COMPANY, NUMBERING, VAT_PRC, SLA_HOURS } = out; return res.json({ success: true, settings: { COMPANY, NUMBERING, VAT_PRC, SLA_HOURS } }); }
  out.SMTP = { ...out.SMTP, hasPassword: await hasSecret('SMTP_SECRET') }; out.WHATSAPP = { ...out.WHATSAPP, hasLicence: await hasSecret('WHATSAPP_SECRET') };
  res.json({ success: true, settings: out });
}));
r.put('/settings/:key', requireAuth, requireOwner, wrap(async (req, res) => {
  const key = String(req.params.key).toUpperCase(); if (!PUBLIC.includes(key)) throw badRequest('Unknown setting.');
  let value = req.body?.value;
  if (key === 'VAT_PRC' || key === 'IDLE_MINUTES') { value = Number(value); if (!Number.isFinite(value) || value < 0 || value > (key === 'VAT_PRC' ? 100 : 1440)) throw badRequest('Give a sensible number.'); }
  else if (typeof value !== 'object' || value == null) throw badRequest('Give the settings as an object.');
  else { value = { ...DEFAULTS[key], ...value }; delete value.hasPassword; delete value.hasLicence; delete value.password; delete value.licence; }
  await setSetting(key, value);
  const secret = req.body?.secret; if (SECRETS[key] && typeof secret === 'string' && secret.trim()) await setSetting(SECRETS[key], secret.trim());
  if (SECRETS[key] && req.body?.clearSecret) await setSetting(SECRETS[key], null);
  await audit(req.ctx, 'APP_SET', key, 'UPDATE', key === 'COMPANY' ? { name: value.name } : typeof value === 'object' ? Object.keys(value) : value);
  res.json({ success: true, value: await getSetting(key) });
}));
export default r;
