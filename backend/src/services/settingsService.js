import { rq, sql } from '../config/db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * APP_SET — one row per key. Values are JSON. Keys ending in _SECRET are AES-encrypted and never read back to a screen
 * (only whether they are set).
 */
export const DEFAULTS = {
  COMPANY: { name: 'DataCare Softech FZCO', trn: '', address: 'Dubai, United Arab Emirates', mobile: '', email: '', website: '', logo: null, bank: '' },
  NUMBERING: { CONTRACT: 'AMC-', INVOICE: 'INV-', RECEIPT: 'RCP-', TICKET: 'TKT-', WIDTH: 5 },
  VAT_PRC: 5,
  PRICES: { BASIC: 4000, PRO: 6000, ADVANCE: 8000, ENTERPRISE: 10000 },   // AED before VAT; the convert amount is the difference between two of these
  IDLE_MINUTES: 15,
  SECURITY: { LOCK_ATTEMPTS: 5, LOCK_MINUTES: 15, MIN_LEN: 8 },
  SLA_HOURS: { LOW: 72, NORMAL: 24, HIGH: 8, URGENT: 2 },
  SMTP: { on: false, host: '', port: 587, secure: false, user: '', from: '', name: 'DataCare Softech FZCO' },
  WHATSAPP: { on: false, url: 'https://www.datacarechat.com/App_Notification.aspx?action=App_Notification', type: 'NF_UPDATE', cc: '971', coName: 'DataCare Softech FZCO' },
  REMINDERS: { time: '09:00', teamMobile: '', teamEmail: '' },
  BACKUP: { autoOn: false, time: '02:00', keep: 7, driveOn: false, driveEmail: '' },
};
const cache = new Map();
export async function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const r = (await rq()).input('k', sql.VarChar(60), key).query('SELECT SET_VALUE FROM APP_SET WHERE SET_KEY = @k');
  const raw = (await r).recordset[0]?.SET_VALUE;
  let v = DEFAULTS[key] ?? null;
  if (raw != null) { try { v = key.endsWith('_SECRET') ? decrypt(raw) : JSON.parse(raw); } catch { v = DEFAULTS[key] ?? null; } }
  if (v && typeof v === 'object' && !Array.isArray(v) && DEFAULTS[key]) v = { ...DEFAULTS[key], ...v };
  cache.set(key, v); return v;
}
export async function setSetting(key, value) {
  const raw = key.endsWith('_SECRET') ? (value ? encrypt(value) : null) : JSON.stringify(value);
  await (await rq()).input('k', sql.VarChar(60), key).input('v', sql.NVarChar(sql.MAX), raw)
    .query('IF EXISTS (SELECT 1 FROM APP_SET WHERE SET_KEY = @k) UPDATE APP_SET SET SET_VALUE = @v, EDIT_DATE = SYSUTCDATETIME() WHERE SET_KEY = @k ELSE INSERT INTO APP_SET (SET_KEY, SET_VALUE) VALUES (@k, @v)');
  cache.delete(key);
}
export const hasSecret = async (key) => !!(await getSetting(key));
export const forgetSettings = () => cache.clear();
