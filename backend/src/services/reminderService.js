import { rq, sql } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { getSetting, setSetting } from './settingsService.js';
import { sendWhatsApp } from './whatsappService.js';
import { sendMail } from './emailService.js';
import { audit } from './audit.js';
import { ddmmyyyy, money, today } from '../utils/dates.js';

/**
 * Reminders. A rule says what (LIC_EXPIRY, AMC_EXPIRY, PAY_OVERDUE, TICKET_OVERDUE), when (DAYS before expiry / after due),
 * on which channels (WA, EMAIL), with a template. Each rule fires once per thing (rule + customer + reference), so a run
 * that was missed still sends the next day. The scheduler runs daily at Settings → Reminders → time (Dubai); the screen can
 * also run now, or preview what is due. Everything sent (or refused) lands in AMC_REMINDER_LOG.
 */
export const KINDS = ['LIC_EXPIRY', 'AMC_EXPIRY', 'PAY_OVERDUE', 'TICKET_OVERDUE'];
export async function listRules() { return (await (await rq()).query("SELECT RULE_ID, KIND, DAYS, CHANNELS, TEMPLATE, TO_TEAM, ACTIVE, EDIT_DATE FROM AMC_REMINDER_RULE ORDER BY CASE KIND WHEN 'LIC_EXPIRY' THEN 0 WHEN 'AMC_EXPIRY' THEN 1 WHEN 'PAY_OVERDUE' THEN 2 ELSE 3 END, DAYS DESC")).recordset.map((r) => ({ ...r, TO_TEAM: !!r.TO_TEAM, ACTIVE: !!r.ACTIVE })); }
const readRule = (b) => {
  const kind = String(b.KIND || '').toUpperCase(); if (!KINDS.includes(kind)) throw badRequest('Kind is licence expiry, AMC expiry, payment overdue or ticket overdue.', 'VALIDATION');
  const channels = String(b.CHANNELS || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => ['WA', 'EMAIL'].includes(x)); if (!channels.length) throw badRequest('Pick WhatsApp, e-mail or both.', 'VALIDATION');
  return { kind, days: Math.max(0, parseInt(b.DAYS, 10) || 0), channels: channels.join(','), template: String(b.TEMPLATE || '').slice(0, 2000) || null, toTeam: !!b.TO_TEAM, active: b.ACTIVE !== false };
};
export async function saveRule(ctx, id, b) {
  const d = readRule(b);
  if (id) { const q = await (await rq()).input('id', sql.Int, id).input('k', sql.VarChar(20), d.kind).input('d', sql.Int, d.days).input('c', sql.VarChar(20), d.channels).input('t', sql.NVarChar(2000), d.template).input('tt', sql.Bit, d.toTeam).input('a', sql.Bit, d.active).query('UPDATE AMC_REMINDER_RULE SET KIND = @k, DAYS = @d, CHANNELS = @c, TEMPLATE = @t, TO_TEAM = @tt, ACTIVE = @a, EDIT_DATE = SYSUTCDATETIME() WHERE RULE_ID = @id; SELECT @@ROWCOUNT AS N'); if (!q.recordset[0].N) throw notFound('Rule not found'); }
  else { const q = await (await rq()).input('k', sql.VarChar(20), d.kind).input('d', sql.Int, d.days).input('c', sql.VarChar(20), d.channels).input('t', sql.NVarChar(2000), d.template).input('tt', sql.Bit, d.toTeam).input('a', sql.Bit, d.active).query('INSERT INTO AMC_REMINDER_RULE (KIND, DAYS, CHANNELS, TEMPLATE, TO_TEAM, ACTIVE) OUTPUT inserted.RULE_ID VALUES (@k, @d, @c, @t, @tt, @a)'); id = q.recordset[0].RULE_ID; }
  await audit(ctx, 'AMC_REMINDER_RULE', id, 'SAVE', d); return id;
}
export async function deleteRule(ctx, id) { await (await rq()).input('id', sql.Int, id).query('DELETE FROM AMC_REMINDER_RULE WHERE RULE_ID = @id'); await audit(ctx, 'AMC_REMINDER_RULE', id, 'DELETE'); }
const fill = (tpl, v) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const DEFAULT_TPL = { LIC_EXPIRY: 'Dear {contact}, the DataCare ERP licence of {shop} expires on {date} ({days} days). Please renew in time. — DataCare Softech FZCO', AMC_EXPIRY: 'Dear {contact}, the annual maintenance contract {no} of {shop} ends on {date}. Please contact DataCare to renew. — DataCare Softech FZCO', PAY_OVERDUE: 'Dear {contact}, invoice {no} of AED {amount} for {shop} was due on {date}. Kindly arrange payment. — DataCare Softech FZCO', TICKET_OVERDUE: 'Ticket {no} for {shop} ({title}) is past its response time ({date}). — DcAMC' };
/** Everything the active rules would send right now, minus what was already sent for the same rule + customer + reference. */
export async function computeDue() {
  const rules = (await listRules()).filter((r) => r.ACTIVE); const team = await getSetting('REMINDERS'); const out = [];
  const sent = new Set((await (await rq()).query('SELECT RULE_ID, CUST_ID, REF_KEY, CHANNEL, SENT_TO FROM AMC_REMINDER_LOG WHERE OK = 1')).recordset.map((x) => `${x.RULE_ID}|${x.CUST_ID}|${x.REF_KEY}|${x.CHANNEL}|${x.SENT_TO}`));
  const push = (rule, c, refKey, vars, subject) => {
    const msg = fill(rule.TEMPLATE || DEFAULT_TPL[rule.KIND], vars);
    const targets = [];
    for (const ch of rule.CHANNELS.split(',')) {
      const to = ch === 'WA' ? c.MOBILE_NO : c.EMAIL_ID; if (to) targets.push({ channel: ch, to, name: c.CONTACT_NAME || c.SHOP_NAME, team: false });
      if (rule.TO_TEAM) { const tt = ch === 'WA' ? team.teamMobile : team.teamEmail; if (tt) targets.push({ channel: ch, to: tt, name: 'DataCare team', team: true }); }
      if (!to && !(rule.TO_TEAM && (ch === 'WA' ? team.teamMobile : team.teamEmail))) targets.push({ channel: ch, to: null, name: c.CONTACT_NAME || c.SHOP_NAME, team: false });
    }
    for (const t of targets) { const key = `${rule.RULE_ID}|${c.CUST_ID}|${refKey}|${t.channel}|${t.to}`; if (t.to && sent.has(key)) continue; out.push({ RULE_ID: rule.RULE_ID, KIND: rule.KIND, DAYS: rule.DAYS, CUST_ID: c.CUST_ID, SHOP_CODE: c.SHOP_CODE, SHOP_NAME: c.SHOP_NAME, REF_KEY: refKey, CHANNEL: t.channel, SENT_TO: t.to, NAME: t.name, TEAM: t.team, MESSAGE: msg, SUBJECT: subject }); }
  };
  for (const rule of rules) {
    if (rule.KIND === 'LIC_EXPIRY') for (const c of (await (await rq()).input('d', sql.Int, rule.DAYS).query("SELECT CUST_ID, SHOP_CODE, SHOP_NAME, CONTACT_NAME, MOBILE_NO, EMAIL_ID, LIC_END, DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), LIC_END) AS DAYS_LEFT FROM AMC_CUSTOMER WHERE ACTIVE = 1 AND STATUS = 'ACTIVE' AND LIC_END IS NOT NULL AND DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), LIC_END) BETWEEN 0 AND @d")).recordset) push(rule, c, `LIC:${today(new Date(c.LIC_END))}`, { shop: c.SHOP_NAME, contact: c.CONTACT_NAME || c.SHOP_NAME, date: ddmmyyyy(c.LIC_END), days: c.DAYS_LEFT }, `Licence of ${c.SHOP_NAME} expires ${ddmmyyyy(c.LIC_END)}`);
    if (rule.KIND === 'AMC_EXPIRY') for (const c of (await (await rq()).input('d', sql.Int, rule.DAYS).query("SELECT C.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.CONTACT_NAME, C.MOBILE_NO, C.EMAIL_ID, K.CONTRACT_NO, K.END_DATE, DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), K.END_DATE) AS DAYS_LEFT FROM AMC_CONTRACT K JOIN AMC_CUSTOMER C ON C.CUST_ID = K.CUST_ID WHERE C.ACTIVE = 1 AND K.STATUS = 'LIVE' AND DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), K.END_DATE) BETWEEN 0 AND @d AND NOT EXISTS (SELECT 1 FROM AMC_CONTRACT R WHERE R.RENEWED_FROM = K.CONTRACT_ID AND R.STATUS IN ('LIVE', 'DRAFT'))")).recordset) push(rule, c, c.CONTRACT_NO, { shop: c.SHOP_NAME, contact: c.CONTACT_NAME || c.SHOP_NAME, date: ddmmyyyy(c.END_DATE), days: c.DAYS_LEFT, no: c.CONTRACT_NO }, `AMC ${c.CONTRACT_NO} of ${c.SHOP_NAME} ends ${ddmmyyyy(c.END_DATE)}`);
    if (rule.KIND === 'PAY_OVERDUE') for (const c of (await (await rq()).input('d', sql.Int, rule.DAYS).query("SELECT C.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.CONTACT_NAME, C.MOBILE_NO, C.EMAIL_ID, I.INV_NO, I.DUE_DATE, I.TOTAL - I.PAID AS BALANCE FROM AMC_INVOICE I JOIN AMC_CUSTOMER C ON C.CUST_ID = I.CUST_ID WHERE C.ACTIVE = 1 AND I.STATUS = 'OPEN' AND I.TOTAL - I.PAID > 0.004 AND DATEDIFF(day, I.DUE_DATE, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE)) >= @d")).recordset) push(rule, c, c.INV_NO, { shop: c.SHOP_NAME, contact: c.CONTACT_NAME || c.SHOP_NAME, date: ddmmyyyy(c.DUE_DATE), no: c.INV_NO, amount: money(c.BALANCE) }, `Invoice ${c.INV_NO} of ${c.SHOP_NAME} is overdue`);
    if (rule.KIND === 'TICKET_OVERDUE') for (const c of (await (await rq()).input('d', sql.Int, rule.DAYS).query("SELECT C.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.CONTACT_NAME, C.MOBILE_NO, C.EMAIL_ID, T.TICKET_NO, T.TITLE, T.DUE_AT FROM AMC_TICKET T JOIN AMC_CUSTOMER C ON C.CUST_ID = T.CUST_ID WHERE T.STATUS <> 'CLOSED' AND DATEDIFF(hour, T.DUE_AT, SYSUTCDATETIME()) >= @d")).recordset) push({ ...rule, CHANNELS: rule.CHANNELS, TO_TEAM: true }, { ...c, MOBILE_NO: null, EMAIL_ID: null }, c.TICKET_NO, { shop: c.SHOP_NAME, contact: 'team', date: ddmmyyyy(c.DUE_AT), no: c.TICKET_NO, title: c.TITLE }, `Ticket ${c.TICKET_NO} past SLA — ${c.SHOP_NAME}`);   // ticket overdue is for the team only
  }
  return out;
}
const log = async (d, ok, result, userId) => (await rq()).input('r', sql.Int, d.RULE_ID).input('k', sql.VarChar(20), d.KIND).input('c', sql.Int, d.CUST_ID).input('rk', sql.VarChar(60), d.REF_KEY).input('ch', sql.VarChar(10), d.CHANNEL).input('to', sql.NVarChar(150), d.SENT_TO).input('m', sql.NVarChar(2000), d.MESSAGE).input('ok', sql.Bit, ok).input('res', sql.NVarChar(1000), String(result || '').slice(0, 1000)).input('u', sql.Int, userId)
  .query('INSERT INTO AMC_REMINDER_LOG (RULE_ID, KIND, CUST_ID, REF_KEY, CHANNEL, SENT_TO, MESSAGE, OK, RESULT, USER_ID) VALUES (@r, @k, @c, @rk, @ch, @to, @m, @ok, @res, @u)');
/** Send everything due (or one rule). Returns counts. */
export async function runReminders({ userId = null, ruleId = null } = {}) {
  const due = (await computeDue()).filter((d) => !ruleId || d.RULE_ID === Number(ruleId)); let sent = 0, failed = 0;
  for (const d of due) {
    if (!d.SENT_TO) { await log(d, false, d.CHANNEL === 'WA' ? 'No mobile number on the customer.' : 'No e-mail address on the customer.', userId); failed += 1; continue; }
    const r = d.CHANNEL === 'WA' ? await sendWhatsApp({ mobile: d.SENT_TO, name: d.NAME, message: d.MESSAGE }) : await sendMail({ to: d.SENT_TO, subject: d.SUBJECT, text: d.MESSAGE });
    await log(d, r.ok, r.answer, userId); if (r.ok) sent += 1; else failed += 1;
  }
  await setSetting('REMINDER_LAST_RUN', { at: new Date().toISOString(), sent, failed, by: userId });
  if (due.length) await audit({ userId }, 'AMC_REMINDER_LOG', today(), 'RUN', { sent, failed });
  return { due: due.length, sent, failed };
}
export async function listLog({ page = 1, pageSize = 50, kind = '', ok = '' } = {}) {
  const off = (Math.max(1, Number(page)) - 1) * pageSize; const where = ['1 = 1']; if (kind) where.push('L.KIND = @kind'); if (ok === '1') where.push('L.OK = 1'); else if (ok === '0') where.push('L.OK = 0');
  const q = await (await rq()).input('kind', sql.VarChar(20), kind).input('off', sql.Int, off).input('ps', sql.Int, pageSize).query(`SELECT COUNT(*) AS N FROM AMC_REMINDER_LOG L WHERE ${where.join(' AND ')}; SELECT L.LOG_ID, L.KIND, L.CUST_ID, C.SHOP_NAME, L.REF_KEY, L.CHANNEL, L.SENT_TO, L.MESSAGE, L.OK, L.RESULT, L.SENT_AT, U.USER_NAME FROM AMC_REMINDER_LOG L LEFT JOIN AMC_CUSTOMER C ON C.CUST_ID = L.CUST_ID LEFT JOIN AMC_USER U ON U.USER_ID = L.USER_ID WHERE ${where.join(' AND ')} ORDER BY L.LOG_ID DESC OFFSET @off ROWS FETCH NEXT @ps ROWS ONLY`);
  return { total: q.recordsets[0][0].N, rows: q.recordsets[1].map((r) => ({ ...r, OK: !!r.OK })) };
}
/** A test message to one number / address with the live settings. */
export async function sendTest({ channel, to, userId }) {
  const msg = `DcAMC test message — ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`;
  const r = channel === 'WA' ? await sendWhatsApp({ mobile: to, name: 'Test', message: msg }) : await sendMail({ to, subject: 'DcAMC test', text: msg });
  await log({ RULE_ID: null, KIND: 'TEST', CUST_ID: null, REF_KEY: 'TEST', CHANNEL: channel, SENT_TO: to, MESSAGE: msg }, r.ok, r.answer, userId); return r;
}
/** Every 5 minutes: once the Dubai clock passes the configured time and today's run has not happened, run. */
export function startReminderScheduler() {
  const tick = async () => {
    try {
      const s = await getSetting('REMINDERS'); const last = await getSetting('REMINDER_LAST_RUN');
      const now = new Date(Date.now() + 4 * 3600e3); const hhmm = now.toISOString().slice(11, 16); const dubaiToday = now.toISOString().slice(0, 10);
      if (hhmm < (s.time || '09:00')) return;
      if (last?.at && new Date(new Date(last.at).getTime() + 4 * 3600e3).toISOString().slice(0, 10) === dubaiToday) return;
      const r = await runReminders({ userId: null }); console.log(`[reminders] ran: ${r.sent} sent, ${r.failed} failed of ${r.due} due`);
    } catch (e) { console.warn('[reminders]', e.message); }
  };
  const t = setInterval(tick, 5 * 60 * 1000); t.unref?.(); setTimeout(tick, 30 * 1000).unref?.();
  return () => clearInterval(t);
}
