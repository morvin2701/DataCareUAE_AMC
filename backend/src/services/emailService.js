import nodemailer from 'nodemailer';
import { getSetting } from './settingsService.js';
/** E-mail through the SMTP mailbox in Settings → E-mail. Never throws: { ok, answer }. */
let cached = null; let cachedKey = '';
export const mailReady = async () => { const s = await getSetting('SMTP'); return !!(s.on && s.host && s.from); };
export const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
function reason(e) { const m = String(e?.message || e); if (/Invalid login|535|not accepted/i.test(m)) return 'The mail server refused the user name or password (Gmail needs an App password).'; if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return 'The SMTP host could not be found.'; if (/ETIMEDOUT|ECONNREFUSED|Greeting never received/i.test(m)) return 'The mail server did not answer — check the port (587 or 465).'; return m.slice(0, 300); }
export async function sendMail({ to, subject, text, html }) {
  const s = await getSetting('SMTP'); const pwd = await getSetting('SMTP_SECRET');
  if (!s.on) return { ok: false, answer: 'E-mail is switched off (Settings → E-mail).' };
  if (!s.host || !s.from) return { ok: false, answer: 'SMTP host or From address missing (Settings → E-mail).' };
  const list = String(to || '').split(',').map((x) => x.trim()).filter(looksLikeEmail); if (!list.length) return { ok: false, answer: `No usable e-mail address (${to || 'blank'}).` };
  const key = JSON.stringify([s.host, s.port, s.secure, s.user, !!pwd]);
  if (!cached || cachedKey !== key) { cached = nodemailer.createTransport({ host: s.host, port: Number(s.port) || 587, secure: !!s.secure, auth: s.user || pwd ? { user: s.user || s.from, pass: pwd || '' } : undefined, connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 30000 }); cachedKey = key; }
  try { const info = await cached.sendMail({ from: s.name ? { name: s.name, address: s.from } : s.from, to: list.join(', '), subject: String(subject || 'DataCare').slice(0, 300), text, html: html || undefined }); return { ok: true, to: list, answer: String(info.response || info.messageId || 'sent').slice(0, 300) }; }
  catch (e) { cached = null; return { ok: false, to: list, answer: reason(e) }; }
}
