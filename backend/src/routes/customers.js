import { Router } from 'express';
import { requireAuth, requireRole, noMoney } from '../middleware/auth.js';
import { wrap, notFound, badRequest } from '../utils/httpError.js';
import { rq, sql } from '../config/db.js';
import { audit } from '../services/audit.js';

/**
 * Customers arrive from heartbeats — there is no "add customer". We keep only NOTES, INSTALLER and ACTIVE of our own.
 * List: search, filter by version / status / server / expiry. Detail: everything the heartbeat said, plus the AMC side.
 */
const r = Router();
export const CUST_COLS = `C.CUST_ID, C.SERVER_ID, S.SERVER_CODE, S.NAME AS SERVER_NAME, S.LAST_HEARTBEAT, CASE WHEN S.LAST_HEARTBEAT IS NULL OR S.LAST_HEARTBEAT < DATEADD(hour, -48, SYSUTCDATETIME()) THEN 1 ELSE 0 END AS OFFLINE,
  C.SHOP_CODE, C.SHOP_NAME, C.HDD, C.PLAN_CODE, C.STATUS, C.TILLS, C.LIC_START, C.LIC_END, C.CONTACT_NAME, C.MOBILE_NO, C.EMAIL_ID, C.EMIRATE_CODE, C.LAST_LOGIN, C.USERS, C.ENTRIES_TODAY, C.ENTRIES_30D, C.INSTALLER, C.NOTES, C.ACTIVE, C.LAST_SEEN, C.ENTRY_DATE,
  CASE WHEN C.LIC_END IS NULL THEN NULL ELSE DATEDIFF(day, CAST(SYSUTCDATETIME() AS DATE), C.LIC_END) END AS LIC_DAYS,
  A.CONTRACT_NO AS AMC_NO, A.END_DATE AS AMC_END, A.STATUS AS AMC_STATUS, CASE WHEN A.END_DATE IS NULL THEN NULL ELSE DATEDIFF(day, CAST(SYSUTCDATETIME() AS DATE), A.END_DATE) END AS AMC_DAYS,
  (SELECT ISNULL(SUM(I.TOTAL - I.PAID), 0) FROM AMC_INVOICE I WHERE I.CUST_ID = C.CUST_ID AND I.STATUS <> 'CANCELLED') AS OUTSTANDING,
  (SELECT COUNT(*) FROM AMC_TICKET T WHERE T.CUST_ID = C.CUST_ID AND T.STATUS <> 'CLOSED') AS OPEN_TICKETS`;
export const CUST_FROM = `FROM AMC_CUSTOMER C JOIN AMC_SERVER S ON S.SERVER_ID = C.SERVER_ID
  OUTER APPLY (SELECT TOP 1 CONTRACT_NO, END_DATE, STATUS FROM AMC_CONTRACT X WHERE X.CUST_ID = C.CUST_ID AND X.STATUS IN ('LIVE', 'EXPIRED', 'DRAFT') ORDER BY CASE X.STATUS WHEN 'LIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END, X.END_DATE DESC) A`;
const out = (ctx, rows) => noMoney(ctx, rows.map((c) => ({ ...c, ACTIVE: !!c.ACTIVE, OFFLINE: !!c.OFFLINE })));

r.get('/customers', requireAuth, wrap(async (req, res) => {
  const { q = '', plan = '', status = '', server = '', expiry = '', active = '1' } = req.query;
  const where = [];
  if (q) where.push('(C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q OR C.HDD LIKE @q OR C.CONTACT_NAME LIKE @q OR C.MOBILE_NO LIKE @q OR C.EMAIL_ID LIKE @q)');
  if (plan) where.push('C.PLAN_CODE = @plan'); if (status) where.push('C.STATUS = @status'); if (server) where.push('C.SERVER_ID = @server');
  if (active === '1') where.push('C.ACTIVE = 1'); else if (active === '0') where.push('C.ACTIVE = 0');
  if (expiry === '30') where.push('C.LIC_END BETWEEN CAST(SYSUTCDATETIME() AS DATE) AND DATEADD(day, 30, CAST(SYSUTCDATETIME() AS DATE))');
  else if (expiry === 'expired') where.push('C.LIC_END < CAST(SYSUTCDATETIME() AS DATE)');
  else if (expiry === 'noamc') where.push('A.CONTRACT_NO IS NULL');
  else if (expiry === 'amc30') where.push("A.STATUS = 'LIVE' AND A.END_DATE BETWEEN CAST(SYSUTCDATETIME() AS DATE) AND DATEADD(day, 30, CAST(SYSUTCDATETIME() AS DATE))");
  else if (expiry === 'offline') where.push('(S.LAST_HEARTBEAT IS NULL OR S.LAST_HEARTBEAT < DATEADD(hour, -48, SYSUTCDATETIME()))');
  const qr = await (await rq()).input('q', sql.NVarChar(120), `%${String(q).trim().slice(0, 100)}%`).input('plan', sql.VarChar(20), String(plan).toUpperCase()).input('status', sql.VarChar(10), String(status).toUpperCase()).input('server', sql.Int, Number(server) || 0)
    .query(`SELECT ${CUST_COLS} ${CUST_FROM} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY C.SHOP_NAME`);
  res.json({ success: true, rows: out(req.ctx, qr.recordset) });
}));
r.get('/customers/:id', requireAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const c = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${CUST_COLS} ${CUST_FROM} WHERE C.CUST_ID = @id`)).recordset[0];
  if (!c) throw notFound('Customer not found');
  res.json({ success: true, customer: out(req.ctx, [c])[0] });
}));
/** Only what is ours: notes, who installed it, whether we still count them. */
r.put('/customers/:id', requireAuth, requireRole('SUPPORT', 'ACCOUNTS'), wrap(async (req, res) => {
  const id = Number(req.params.id); const b = req.body || {};
  const inst = b.INSTALLER === undefined ? undefined : String(b.INSTALLER || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || null;
  const q = await (await rq()).input('id', sql.Int, id).input('n', sql.NVarChar(2000), b.NOTES === undefined ? null : String(b.NOTES || '').slice(0, 2000) || null).input('i', sql.VarChar(10), inst ?? null).input('a', sql.Bit, b.ACTIVE === undefined ? null : !!b.ACTIVE)
    .input('hasN', sql.Bit, b.NOTES !== undefined).input('hasI', sql.Bit, inst !== undefined).input('hasA', sql.Bit, b.ACTIVE !== undefined)
    .query('UPDATE AMC_CUSTOMER SET NOTES = CASE WHEN @hasN = 1 THEN @n ELSE NOTES END, INSTALLER = CASE WHEN @hasI = 1 THEN @i ELSE INSTALLER END, ACTIVE = CASE WHEN @hasA = 1 THEN @a ELSE ACTIVE END, EDIT_DATE = SYSUTCDATETIME() WHERE CUST_ID = @id; SELECT @@ROWCOUNT AS N');
  if (!q.recordset[0].N) throw notFound('Customer not found');
  await audit(req.ctx, 'AMC_CUSTOMER', id, 'UPDATE', { notes: b.NOTES !== undefined, installer: inst, active: b.ACTIVE });
  res.json({ success: true });
}));
/** One customer's whole story, newest first: heartbeats are not listed (they are every day), everything else is. */
r.get('/customers/:id/history', requireAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const q = await (await rq()).input('id', sql.Int, id).query(`
    SELECT 'CONTRACT' AS KIND, CONTRACT_NO AS REF, START_DATE AS D, CAST(STATUS AS NVARCHAR(200)) AS TEXT, TOTAL AS AMOUNT FROM AMC_CONTRACT WHERE CUST_ID = @id
    UNION ALL SELECT 'INVOICE', INV_NO, INV_DATE, CAST(STATUS AS NVARCHAR(200)), TOTAL FROM AMC_INVOICE WHERE CUST_ID = @id
    UNION ALL SELECT 'PAYMENT', RCPT_NO, PAY_DATE, CAST(PAY_MODE + ISNULL(' ' + REF_NO, '') AS NVARCHAR(200)), AMOUNT FROM AMC_PAYMENT WHERE CUST_ID = @id AND CANCELLED = 0
    UNION ALL SELECT 'TICKET', TICKET_NO, CAST(OPENED_AT AS DATE), CAST(TITLE AS NVARCHAR(200)), NULL FROM AMC_TICKET WHERE CUST_ID = @id
    UNION ALL SELECT 'VISIT', CAST(VISIT_ID AS VARCHAR), VISIT_DATE, CAST(PURPOSE AS NVARCHAR(200)), NULL FROM AMC_VISIT WHERE CUST_ID = @id
    UNION ALL SELECT 'REMINDER', REF_KEY, CAST(SENT_AT AS DATE), CAST(CHANNEL + ' → ' + ISNULL(SENT_TO, '') AS NVARCHAR(200)), NULL FROM AMC_REMINDER_LOG WHERE CUST_ID = @id AND OK = 1
    ORDER BY D DESC, KIND`);
  res.json({ success: true, rows: noMoney(req.ctx, q.recordset) });
}));
export default r;
