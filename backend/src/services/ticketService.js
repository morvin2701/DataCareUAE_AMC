import { rq, sql } from '../config/db.js';
import { notFound, badRequest } from '../utils/httpError.js';
import { getSetting } from './settingsService.js';
import { withNo } from './numbering.js';
import { audit } from './audit.js';

/** Support tickets with a note thread. DUE_AT is the SLA deadline from the priority (Settings → SLA hours). */
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']; export const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']; export const CHANNELS = ['CALL', 'WHATSAPP', 'EMAIL', 'VISIT'];
export const TICKET_COLS = `T.TICKET_ID, T.TICKET_NO, T.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.HDD, C.CONTACT_NAME, C.MOBILE_NO, T.OPENED_AT, T.CHANNEL, T.TITLE, T.DETAIL, T.PRIORITY, T.STATUS, T.ASSIGNED_TO, A.USER_NAME AS ASSIGNED_NAME, T.DUE_AT, T.CLOSED_AT, T.RESOLUTION, T.MINUTES_SPENT, T.USER_ID, U.USER_NAME AS OPENED_BY, T.EDIT_DATE,
  CASE WHEN T.STATUS <> 'CLOSED' AND T.DUE_AT < SYSUTCDATETIME() THEN 1 ELSE 0 END AS OVERDUE, DATEDIFF(minute, SYSUTCDATETIME(), T.DUE_AT) AS MINUTES_TO_DUE, (SELECT COUNT(*) FROM AMC_TICKET_NOTE N WHERE N.TICKET_ID = T.TICKET_ID) AS NOTES`;
export const TICKET_FROM = 'FROM AMC_TICKET T JOIN AMC_CUSTOMER C ON C.CUST_ID = T.CUST_ID LEFT JOIN AMC_USER A ON A.USER_ID = T.ASSIGNED_TO LEFT JOIN AMC_USER U ON U.USER_ID = T.USER_ID';
const shape = (t) => ({ ...t, OVERDUE: !!t.OVERDUE });
export async function getTicket(id) {
  const t = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${TICKET_COLS} ${TICKET_FROM} WHERE T.TICKET_ID = @id`)).recordset[0]; if (!t) return null;
  const notes = (await (await rq()).input('id', sql.Int, id).query('SELECT N.NOTE_ID, N.USER_ID, U.USER_NAME, N.NOTE, N.MINUTES, N.KIND, N.ENTRY_DATE FROM AMC_TICKET_NOTE N LEFT JOIN AMC_USER U ON U.USER_ID = N.USER_ID WHERE N.TICKET_ID = @id ORDER BY N.NOTE_ID')).recordset;
  const visits = (await (await rq()).input('id', sql.Int, id).query('SELECT V.VISIT_ID, V.VISIT_DATE, V.VISIT_TIME, V.STATUS, V.PURPOSE, E.USER_NAME AS ENGINEER_NAME FROM AMC_VISIT V LEFT JOIN AMC_USER E ON E.USER_ID = V.ENGINEER WHERE V.TICKET_ID = @id ORDER BY V.VISIT_DATE')).recordset;
  return { ...shape(t), notes, visits };
}
export async function listTickets({ q = '', status = '', priority = '', assigned = '', custId = 0, open = '' } = {}) {
  const where = ['1 = 1'];
  if (q) where.push('(T.TICKET_NO LIKE @q OR T.TITLE LIKE @q OR C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q)');
  if (status) where.push('T.STATUS = @status'); else if (open === '1') where.push("T.STATUS <> 'CLOSED'");
  if (priority) where.push('T.PRIORITY = @priority'); if (assigned === 'none') where.push('T.ASSIGNED_TO IS NULL'); else if (assigned) where.push('T.ASSIGNED_TO = @assigned'); if (custId) where.push('T.CUST_ID = @cust');
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${q}%`).input('status', sql.VarChar(12), String(status).toUpperCase()).input('priority', sql.VarChar(10), String(priority).toUpperCase()).input('assigned', sql.Int, Number(assigned) || 0).input('cust', sql.Int, Number(custId) || 0)
    .query(`SELECT ${TICKET_COLS} ${TICKET_FROM} WHERE ${where.join(' AND ')} ORDER BY CASE WHEN T.STATUS = 'CLOSED' THEN 1 ELSE 0 END, CASE T.PRIORITY WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, T.DUE_AT, T.TICKET_ID DESC`);
  return r.recordset.map(shape);
}
const read = (b) => {
  const title = String(b.TITLE || '').trim().slice(0, 200); if (!title) throw badRequest('Give the ticket a title.', 'VALIDATION');
  const priority = String(b.PRIORITY || 'NORMAL').toUpperCase(); if (!PRIORITIES.includes(priority)) throw badRequest('Priority is low, normal, high or urgent.', 'VALIDATION');
  const channel = String(b.CHANNEL || 'CALL').toUpperCase(); if (!CHANNELS.includes(channel)) throw badRequest('Channel is call, WhatsApp, e-mail or visit.', 'VALIDATION');
  return { title, priority, channel, detail: String(b.DETAIL || '').slice(0, 8000) || null, assigned: b.ASSIGNED_TO ? Number(b.ASSIGNED_TO) : null };
};
const note = async (ticketId, userId, text, kind = 'NOTE', minutes = 0) => (await rq()).input('t', sql.Int, ticketId).input('u', sql.Int, userId).input('n', sql.NVarChar(sql.MAX), text).input('k', sql.VarChar(10), kind).input('m', sql.Int, minutes).query('INSERT INTO AMC_TICKET_NOTE (TICKET_ID, USER_ID, NOTE, KIND, MINUTES) VALUES (@t, @u, @n, @k, @m); UPDATE AMC_TICKET SET MINUTES_SPENT = MINUTES_SPENT + @m, EDIT_DATE = SYSUTCDATETIME() WHERE TICKET_ID = @t');
export async function createTicket(ctx, b) {
  const custId = Number(b.CUST_ID); const c = (await (await rq()).input('id', sql.Int, custId).query('SELECT SHOP_CODE FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0]; if (!c) throw notFound('Customer not found');
  const d = read(b); const sla = await getSetting('SLA_HOURS'); const hours = Number(sla[d.priority]) || 24;
  const id = await withNo('TICKET', async (no) => (await (await rq()).input('no', sql.VarChar(20), no).input('c', sql.Int, custId).input('ch', sql.VarChar(10), d.channel).input('t', sql.NVarChar(200), d.title).input('d', sql.NVarChar(sql.MAX), d.detail).input('p', sql.VarChar(10), d.priority).input('a', sql.Int, d.assigned).input('h', sql.Int, hours).input('u', sql.Int, ctx.userId)
    .query("INSERT INTO AMC_TICKET (TICKET_NO, CUST_ID, CHANNEL, TITLE, DETAIL, PRIORITY, STATUS, ASSIGNED_TO, DUE_AT, USER_ID) OUTPUT inserted.TICKET_ID VALUES (@no, @c, @ch, @t, @d, @p, 'OPEN', @a, DATEADD(hour, @h, SYSUTCDATETIME()), @u)")).recordset[0].TICKET_ID);
  const t = await getTicket(id); await audit(ctx, 'AMC_TICKET', t.TICKET_NO, 'CREATE', { shop: c.SHOP_CODE, priority: d.priority, title: d.title }); return t;
}
/** Change title / detail / priority / channel / assignee / status. Status and assignee changes leave a line in the thread. */
export async function updateTicket(ctx, id, b) {
  const t = await getTicket(id); if (!t) throw notFound('Ticket not found');
  const d = read({ ...t, ...b }); const status = String(b.STATUS || t.STATUS).toUpperCase(); if (!STATUSES.includes(status)) throw badRequest('Status is open, in progress, waiting or closed.', 'VALIDATION');
  if (status === 'CLOSED' && t.STATUS !== 'CLOSED') return closeTicket(ctx, id, b);
  const sla = await getSetting('SLA_HOURS'); const reprio = d.priority !== t.PRIORITY;
  await (await rq()).input('id', sql.Int, id).input('ch', sql.VarChar(10), d.channel).input('t', sql.NVarChar(200), d.title).input('d', sql.NVarChar(sql.MAX), d.detail).input('p', sql.VarChar(10), d.priority).input('a', sql.Int, d.assigned).input('s', sql.VarChar(12), status === 'CLOSED' ? t.STATUS : status).input('h', sql.Int, Number(sla[d.priority]) || 24).input('rp', sql.Bit, reprio)
    .query('UPDATE AMC_TICKET SET CHANNEL = @ch, TITLE = @t, DETAIL = @d, PRIORITY = @p, ASSIGNED_TO = @a, STATUS = @s, DUE_AT = CASE WHEN @rp = 1 THEN DATEADD(hour, @h, OPENED_AT) ELSE DUE_AT END, EDIT_DATE = SYSUTCDATETIME() WHERE TICKET_ID = @id');
  if (status !== t.STATUS) await note(id, ctx.userId, `Status ${t.STATUS} → ${status}`, 'STATUS');
  if ((d.assigned || null) !== (t.ASSIGNED_TO || null)) { const who = d.assigned ? (await (await rq()).input('id', sql.Int, d.assigned).query('SELECT USER_NAME FROM AMC_USER WHERE USER_ID = @id')).recordset[0]?.USER_NAME : null; await note(id, ctx.userId, who ? `Assigned to ${who}` : 'Unassigned', 'ASSIGN'); }
  await audit(ctx, 'AMC_TICKET', t.TICKET_NO, 'UPDATE', { status, priority: d.priority, assigned: d.assigned }); return getTicket(id);
}
export async function addNote(ctx, id, { NOTE, MINUTES, STATUS }) {
  const t = await getTicket(id); if (!t) throw notFound('Ticket not found');
  const text = String(NOTE || '').trim().slice(0, 8000); if (!text) throw badRequest('Type the note.', 'VALIDATION');
  const minutes = Math.max(0, parseInt(MINUTES, 10) || 0);
  await note(id, ctx.userId, text, 'NOTE', minutes);
  if (STATUS && String(STATUS).toUpperCase() !== t.STATUS && String(STATUS).toUpperCase() !== 'CLOSED') await updateTicket(ctx, id, { STATUS });
  await audit(ctx, 'AMC_TICKET_NOTE', t.TICKET_NO, 'CREATE', { minutes }); return getTicket(id);
}
export async function closeTicket(ctx, id, { RESOLUTION, MINUTES }) {
  const t = await getTicket(id); if (!t) throw notFound('Ticket not found');
  const res = String(RESOLUTION || '').trim().slice(0, 8000); if (!res) throw badRequest('Say how it was resolved.', 'VALIDATION');
  const minutes = Math.max(0, parseInt(MINUTES, 10) || 0);
  await (await rq()).input('id', sql.Int, id).input('r', sql.NVarChar(sql.MAX), res).query("UPDATE AMC_TICKET SET STATUS = 'CLOSED', CLOSED_AT = SYSUTCDATETIME(), RESOLUTION = @r, EDIT_DATE = SYSUTCDATETIME() WHERE TICKET_ID = @id");
  await note(id, ctx.userId, `Closed — ${res}`, 'CLOSE', minutes);
  await audit(ctx, 'AMC_TICKET', t.TICKET_NO, 'CLOSE', { minutes }); return getTicket(id);
}
export async function reopenTicket(ctx, id) {
  const t = await getTicket(id); if (!t) throw notFound('Ticket not found'); if (t.STATUS !== 'CLOSED') return t;
  await (await rq()).input('id', sql.Int, id).query("UPDATE AMC_TICKET SET STATUS = 'OPEN', CLOSED_AT = NULL, EDIT_DATE = SYSUTCDATETIME() WHERE TICKET_ID = @id");
  await note(id, ctx.userId, 'Reopened', 'STATUS'); await audit(ctx, 'AMC_TICKET', t.TICKET_NO, 'REOPEN'); return getTicket(id);
}
// ───────────────────────── visits
export const VISIT_COLS = 'V.VISIT_ID, V.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.EMIRATE_CODE, C.CONTACT_NAME, C.MOBILE_NO, V.TICKET_ID, T.TICKET_NO, V.VISIT_DATE, V.VISIT_TIME, V.ENGINEER, E.USER_NAME AS ENGINEER_NAME, V.PURPOSE, V.STATUS, V.MINUTES, V.TRAVEL_KM, V.SIGNED_BY, V.REMARK, V.USER_ID, V.ENTRY_DATE';
export const VISIT_FROM = 'FROM AMC_VISIT V JOIN AMC_CUSTOMER C ON C.CUST_ID = V.CUST_ID LEFT JOIN AMC_TICKET T ON T.TICKET_ID = V.TICKET_ID LEFT JOIN AMC_USER E ON E.USER_ID = V.ENGINEER';
const shapeV = (v) => ({ ...v, VISIT_DATE: v.VISIT_DATE ? new Date(v.VISIT_DATE).toISOString().slice(0, 10) : null });
export async function getVisit(id) { const v = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${VISIT_COLS} ${VISIT_FROM} WHERE V.VISIT_ID = @id`)).recordset[0]; return v ? shapeV(v) : null; }
export async function listVisits({ from = '', to = '', engineer = '', custId = 0, status = '', q = '' } = {}) {
  const where = ['1 = 1'];
  if (from) where.push('V.VISIT_DATE >= @from'); if (to) where.push('V.VISIT_DATE <= @to'); if (engineer) where.push('V.ENGINEER = @eng'); if (custId) where.push('V.CUST_ID = @cust'); if (status) where.push('V.STATUS = @status');
  if (q) where.push('(C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q OR V.PURPOSE LIKE @q OR T.TICKET_NO LIKE @q)');
  const r = await (await rq()).input('from', sql.Date, from || null).input('to', sql.Date, to || null).input('eng', sql.Int, Number(engineer) || 0).input('cust', sql.Int, Number(custId) || 0).input('status', sql.VarChar(10), String(status).toUpperCase()).input('q', sql.NVarChar(120), `%${q}%`)
    .query(`SELECT ${VISIT_COLS} ${VISIT_FROM} WHERE ${where.join(' AND ')} ORDER BY V.VISIT_DATE DESC, V.VISIT_TIME DESC, V.VISIT_ID DESC`);
  return r.recordset.map(shapeV);
}
const readV = (b) => {
  const date = String(b.VISIT_DATE || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('The visit date reads 2026-09-30.', 'VALIDATION');
  const purpose = String(b.PURPOSE || '').trim().slice(0, 300); if (!purpose) throw badRequest('Say what the visit is for.', 'VALIDATION');
  const status = String(b.STATUS || 'PLANNED').toUpperCase(); if (!['PLANNED', 'DONE', 'CANCELLED'].includes(status)) throw badRequest('Status is planned, done or cancelled.', 'VALIDATION');
  const time = b.VISIT_TIME ? String(b.VISIT_TIME).slice(0, 5) : null; if (time && !/^\d{2}:\d{2}$/.test(time)) throw badRequest('Time reads 10:30.', 'VALIDATION');
  return { date, time, purpose, status, engineer: b.ENGINEER ? Number(b.ENGINEER) : null, ticketId: b.TICKET_ID ? Number(b.TICKET_ID) : null, minutes: Math.max(0, parseInt(b.MINUTES, 10) || 0), km: Math.max(0, Number(b.TRAVEL_KM) || 0), signed: String(b.SIGNED_BY || '').slice(0, 100) || null, remark: String(b.REMARK || '').slice(0, 1000) || null };
};
export async function createVisit(ctx, b) {
  const custId = Number(b.CUST_ID); const c = (await (await rq()).input('id', sql.Int, custId).query('SELECT SHOP_CODE FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0]; if (!c) throw notFound('Customer not found');
  const d = readV(b);
  const q = await (await rq()).input('c', sql.Int, custId).input('t', sql.Int, d.ticketId).input('d', sql.Date, d.date).input('tm', sql.VarChar(5), d.time).input('e', sql.Int, d.engineer).input('p', sql.NVarChar(300), d.purpose).input('s', sql.VarChar(10), d.status).input('m', sql.Int, d.minutes).input('km', sql.Decimal(8, 1), d.km).input('sg', sql.NVarChar(100), d.signed).input('rm', sql.NVarChar(1000), d.remark).input('u', sql.Int, ctx.userId)
    .query('INSERT INTO AMC_VISIT (CUST_ID, TICKET_ID, VISIT_DATE, VISIT_TIME, ENGINEER, PURPOSE, STATUS, MINUTES, TRAVEL_KM, SIGNED_BY, REMARK, USER_ID) OUTPUT inserted.VISIT_ID VALUES (@c, @t, @d, @tm, @e, @p, @s, @m, @km, @sg, @rm, @u)');
  const v = await getVisit(q.recordset[0].VISIT_ID); await audit(ctx, 'AMC_VISIT', v.VISIT_ID, 'CREATE', { shop: c.SHOP_CODE, date: d.date, ticket: d.ticketId }); return v;
}
export async function updateVisit(ctx, id, b) {
  const v = await getVisit(id); if (!v) throw notFound('Visit not found'); const d = readV({ ...v, ...b });
  await (await rq()).input('id', sql.Int, id).input('t', sql.Int, d.ticketId).input('d', sql.Date, d.date).input('tm', sql.VarChar(5), d.time).input('e', sql.Int, d.engineer).input('p', sql.NVarChar(300), d.purpose).input('s', sql.VarChar(10), d.status).input('m', sql.Int, d.minutes).input('km', sql.Decimal(8, 1), d.km).input('sg', sql.NVarChar(100), d.signed).input('rm', sql.NVarChar(1000), d.remark)
    .query('UPDATE AMC_VISIT SET TICKET_ID = @t, VISIT_DATE = @d, VISIT_TIME = @tm, ENGINEER = @e, PURPOSE = @p, STATUS = @s, MINUTES = @m, TRAVEL_KM = @km, SIGNED_BY = @sg, REMARK = @rm, EDIT_DATE = SYSUTCDATETIME() WHERE VISIT_ID = @id');
  await audit(ctx, 'AMC_VISIT', id, 'UPDATE', { date: d.date, status: d.status }); return getVisit(id);
}
export async function deleteVisit(ctx, id) { const v = await getVisit(id); if (!v) throw notFound('Visit not found'); await (await rq()).input('id', sql.Int, id).query('DELETE FROM AMC_VISIT WHERE VISIT_ID = @id'); await audit(ctx, 'AMC_VISIT', id, 'DELETE', { shop: v.SHOP_CODE, date: v.VISIT_DATE }); }
