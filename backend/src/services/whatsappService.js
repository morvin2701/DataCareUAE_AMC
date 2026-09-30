import { getSetting } from './settingsService.js';
/**
 * WhatsApp through DataCare Chat: one JSON POST to the configured URL with the licence (HDD) and the TYPE the licence
 * maps to a template. TYPE is case-sensitive on DataCare Chat — it is sent exactly as typed in Settings → WhatsApp.
 */
const dubaiDate = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
export function waMobile(raw, cc = '971') { let d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = cc + d.slice(1); else if (d.length <= 10 && !d.startsWith(cc)) d = cc + d; return d.length >= 10 && d.length <= 15 ? d : null; }
function judge(status, text) {
  if (status < 200 || status >= 300) return false;
  if (/message sent successfully/i.test(text)) return true;
  if (/^\s*\{\s*"status"\s*:\s*"error"/i.test(text)) return false;
  let j = null; try { j = JSON.parse(text); } catch { /* plain text */ }
  if (j && typeof j === 'object') { if (j.success === false || j.status === false) return false; const st = String(j.status ?? j.result ?? '').toLowerCase(); return !/^(fail|failed|error|invalid|false|0)$/.test(st); }
  return !/\b(error|fail(ed|ure)?|invalid|expired|not\s+(found|valid|active))\b/i.test(String(text).slice(0, 300));
}
export const waReady = async () => { const s = await getSetting('WHATSAPP'); return !!(s.on && (await getSetting('WHATSAPP_SECRET'))); };
/** Never throws: { ok, to, status, answer }. */
export async function sendWhatsApp({ mobile, name, message }) {
  const s = await getSetting('WHATSAPP'); const hdd = await getSetting('WHATSAPP_SECRET');
  if (!s.on) return { ok: false, answer: 'WhatsApp is switched off (Settings → WhatsApp).' };
  if (!hdd) return { ok: false, answer: 'No DataCare Chat licence entered (Settings → WhatsApp).' };
  const to = waMobile(mobile, s.cc); if (!to) return { ok: false, answer: `No usable WhatsApp number (${mobile || 'blank'}).` };
  const payload = { HDD: hdd, TYPE: s.type, CO_NAME: s.coName || 'DataCare Softech FZCO', CUST_MO: to, CUST_NAME: String(name || '').slice(0, 150), DEFULT_MESS: String(message || '').slice(0, 4000), DATE: dubaiDate() };
  try {
    const res = await fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) });
    const answer = (await res.text()).trim(); return { ok: judge(res.status, answer), to, status: res.status, answer: answer.slice(0, 500) };
  } catch (e) { return { ok: false, to, answer: e.name === 'TimeoutError' ? 'DataCare Chat did not answer within 60 seconds.' : `Could not reach DataCare Chat: ${e.message}` }; }
}
