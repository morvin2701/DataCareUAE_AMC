import { rq, sql } from '../config/db.js';
import { badRequest } from '../utils/httpError.js';
import { audit } from './audit.js';
import { ddmmyyyy } from '../utils/dates.js';

/**
 * Notifications for the team, shown under the bell. Made every 5 minutes from what is due — a lead follow-up or demo
 * whose time has come (to its owner), a ticket past its SLA (to its assignee), a licence or AMC ending within 7 days (to
 * everyone) — each once (REF_KEY), plus any the owner writes by hand for one person or all, timed for later.
 */
export async function listMine(userId, { all = false } = {}) {
  const q = await (await rq()).input('u', sql.Int, userId).input('all', sql.Bit, all).query(`SELECT TOP 100 N.NOTIFY_ID, N.KIND, N.TITLE, N.BODY, N.LINK, N.DUE_AT, N.READ_AT, B.USER_NAME AS BY_NAME FROM AMC_NOTIFY N LEFT JOIN AMC_USER B ON B.USER_ID = N.BY_USER WHERE (N.USER_ID IS NULL OR N.USER_ID = @u) AND N.DUE_AT <= SYSUTCDATETIME() AND (@all = 1 OR N.READ_AT IS NULL) ORDER BY N.DUE_AT DESC;
    SELECT COUNT(*) AS N FROM AMC_NOTIFY WHERE (USER_ID IS NULL OR USER_ID = @u) AND DUE_AT <= SYSUTCDATETIME() AND READ_AT IS NULL`);
  return { rows: q.recordsets[0], unread: q.recordsets[1][0].N };
}
/* a broadcast (USER_ID null) read by one person is copied to them as read, so it stays unread for the others */
export async function markRead(userId, id) { await (await rq()).input('u', sql.Int, userId).input('id', sql.Int, id).query('UPDATE AMC_NOTIFY SET READ_AT = SYSUTCDATETIME() WHERE NOTIFY_ID = @id AND USER_ID = @u; INSERT INTO AMC_NOTIFY (USER_ID, KIND, TITLE, BODY, LINK, REF_KEY, DUE_AT, READ_AT, BY_USER) SELECT @u, KIND, TITLE, BODY, LINK, NULL, DUE_AT, SYSUTCDATETIME(), BY_USER FROM AMC_NOTIFY WHERE NOTIFY_ID = @id AND USER_ID IS NULL AND NOT EXISTS (SELECT 1 FROM AMC_NOTIFY X WHERE X.USER_ID = @u AND X.TITLE = AMC_NOTIFY.TITLE AND X.DUE_AT = AMC_NOTIFY.DUE_AT)'); }
export async function markAllRead(userId) { const { rows } = await listMine(userId); for (const r of rows) await markRead(userId, r.NOTIFY_ID); }
const put = async ({ userId = null, kind, title, body = null, link = null, refKey = null, dueAt = null, byUser = null }) => (await rq()).input('u', sql.Int, userId).input('k', sql.VarChar(12), kind).input('t', sql.NVarChar(200), String(title).slice(0, 200)).input('b', sql.NVarChar(1000), body ? String(body).slice(0, 1000) : null).input('l', sql.VarChar(200), link).input('r', sql.VarChar(80), refKey).input('d', sql.DateTime2, dueAt || new Date()).input('by', sql.Int, byUser)
  .query('IF @r IS NULL OR NOT EXISTS (SELECT 1 FROM AMC_NOTIFY WHERE REF_KEY = @r AND ((USER_ID IS NULL AND @u IS NULL) OR USER_ID = @u)) INSERT INTO AMC_NOTIFY (USER_ID, KIND, TITLE, BODY, LINK, REF_KEY, DUE_AT, BY_USER) VALUES (@u, @k, @t, @b, @l, @r, @d, @by)');
/** The owner writes one: for a person or everyone, now or at a time. */
export async function createCustom(ctx, { USER_ID, TITLE, BODY, DUE_AT, LINK }) {
  const title = String(TITLE || '').trim(); if (!title) throw badRequest('Give the notification a title.', 'VALIDATION');
  const due = DUE_AT ? new Date(DUE_AT) : new Date(); if (Number.isNaN(due.getTime())) throw badRequest('The time is not readable.', 'VALIDATION');
  await put({ userId: USER_ID ? Number(USER_ID) : null, kind: 'CUSTOM', title, body: BODY, link: LINK || null, dueAt: due, byUser: ctx.userId });
  await audit(ctx, 'AMC_NOTIFY', title, 'CREATE', { to: USER_ID || 'all', due });
}
/** What is due now, made once each. */
export async function generate() {
  const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  const leads = (await (await rq()).query("SELECT LEAD_ID, NAME, STAGE, OWNER_ID, NEXT_FOLLOW FROM AMC_LEAD WHERE STAGE NOT IN ('WON', 'LOST') AND NEXT_FOLLOW IS NOT NULL AND NEXT_FOLLOW <= SYSUTCDATETIME()")).recordset;
  for (const l of leads) await put({ userId: l.OWNER_ID, kind: l.STAGE === 'DEMO' ? 'DEMO' : 'FOLLOWUP', title: `${l.STAGE === 'DEMO' ? 'Demo' : 'Follow up'}: ${l.NAME}`, body: `${l.STAGE === 'DEMO' ? 'Demo scheduled for' : 'Follow-up due'} ${new Date(l.NEXT_FOLLOW).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`, link: `/leads?open=${l.LEAD_ID}`, refKey: `LEAD:${l.LEAD_ID}:${new Date(l.NEXT_FOLLOW).toISOString().slice(0, 16)}` });
  const tickets = (await (await rq()).query("SELECT T.TICKET_ID, T.TICKET_NO, T.TITLE, T.ASSIGNED_TO, C.SHOP_NAME FROM AMC_TICKET T JOIN AMC_CUSTOMER C ON C.CUST_ID = T.CUST_ID WHERE T.STATUS <> 'CLOSED' AND T.DUE_AT < SYSUTCDATETIME()")).recordset;
  for (const t of tickets) await put({ userId: t.ASSIGNED_TO, kind: 'TICKET', title: `${t.TICKET_NO} past its response time`, body: `${t.SHOP_NAME} — ${t.TITLE}`, link: `/tickets?open=${t.TICKET_ID}`, refKey: `TKT:${t.TICKET_ID}:SLA` });
  const lic = (await (await rq()).query("SELECT CUST_ID, SHOP_NAME, LIC_END FROM AMC_CUSTOMER WHERE ACTIVE = 1 AND LIC_END IS NOT NULL AND DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), LIC_END) BETWEEN 0 AND 7")).recordset;
  for (const c of lic) await put({ kind: 'LICENCE', title: `Licence of ${c.SHOP_NAME} ends ${ddmmyyyy(c.LIC_END)}`, link: `/customers/${c.CUST_ID}`, refKey: `LIC:${c.CUST_ID}:${d(c.LIC_END)}` });
  const amc = (await (await rq()).query("SELECT K.CUST_ID, K.CONTRACT_NO, K.END_DATE, C.SHOP_NAME FROM AMC_CONTRACT K JOIN AMC_CUSTOMER C ON C.CUST_ID = K.CUST_ID WHERE K.STATUS = 'LIVE' AND DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), K.END_DATE) BETWEEN 0 AND 7")).recordset;
  for (const k of amc) await put({ kind: 'AMC', title: `AMC ${k.CONTRACT_NO} of ${k.SHOP_NAME} ends ${ddmmyyyy(k.END_DATE)}`, link: `/customers/${k.CUST_ID}?tab=contracts`, refKey: `AMC:${k.CONTRACT_NO}` });
}
export function startNotifyScheduler() { const tick = () => generate().catch((e) => console.warn('[notify]', e.message)); const t = setInterval(tick, 5 * 60 * 1000); t.unref?.(); setTimeout(tick, 20 * 1000).unref?.(); return () => clearInterval(t); }
