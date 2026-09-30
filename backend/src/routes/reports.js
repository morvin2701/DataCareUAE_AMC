import { Router } from 'express';
import { requireAuth, requireRole, noMoney } from '../middleware/auth.js';
import { wrap, badRequest } from '../utils/httpError.js';
import { rq, sql } from '../config/db.js';
import { CUST_COLS, CUST_FROM } from '../services/partyService.js';
import { expireContracts } from '../services/contractService.js';
/** Reports. Money reports need ACCOUNTS; the rest are for everyone (SUPPORT sees no amounts). */
const r = Router(); const money = requireRole('ACCOUNTS');
const range = (q) => { const from = q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : null; const to = q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? q.to : null; return { from, to }; };
r.get('/reports/expiring-licences', requireAuth, wrap(async (req, res) => {
  const days = Math.min(365, Math.max(0, parseInt(req.query.days, 10) || 30)); const expired = req.query.expired === '1';
  const q = await (await rq()).input('d', sql.Int, days).query(`SELECT ${CUST_COLS} ${CUST_FROM} WHERE C.ACTIVE = 1 AND C.LIC_END IS NOT NULL AND ${expired ? 'C.LIC_END < CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE)' : 'DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), C.LIC_END) BETWEEN 0 AND @d'} ORDER BY C.LIC_END`);
  res.json({ success: true, rows: noMoney(req.ctx, q.recordset) });
}));
r.get('/reports/expiring-amcs', requireAuth, wrap(async (req, res) => {
  await expireContracts(); const days = Math.min(365, Math.max(0, parseInt(req.query.days, 10) || 30)); const expired = req.query.expired === '1';
  const q = await (await rq()).input('d', sql.Int, days).query(`SELECT K.CONTRACT_ID, K.CONTRACT_NO, K.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.HDD, C.CONTACT_NAME, C.MOBILE_NO, C.EMAIL_ID, K.START_DATE, K.END_DATE, K.STATUS, K.TOTAL, DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), K.END_DATE) AS DAYS_LEFT,
    CASE WHEN EXISTS (SELECT 1 FROM AMC_CONTRACT R WHERE R.RENEWED_FROM = K.CONTRACT_ID AND R.STATUS IN ('LIVE', 'DRAFT')) THEN 1 ELSE 0 END AS RENEWED FROM AMC_CONTRACT K JOIN AMC_CUSTOMER C ON C.CUST_ID = K.CUST_ID
    WHERE C.ACTIVE = 1 AND ${expired ? "K.STATUS = 'EXPIRED'" : "K.STATUS = 'LIVE' AND DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), K.END_DATE) BETWEEN 0 AND @d"} ORDER BY K.END_DATE`);
  res.json({ success: true, rows: noMoney(req.ctx, q.recordset.map((x) => ({ ...x, RENEWED: !!x.RENEWED }))) });
}));
r.get('/reports/outstanding', requireAuth, money, wrap(async (_req, res) => {
  const q = await (await rq()).query(`SELECT C.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.CONTACT_NAME, C.MOBILE_NO, COUNT(*) AS INVOICES, SUM(I.TOTAL) AS TOTAL, SUM(I.PAID) AS PAID, SUM(I.TOTAL - I.PAID) AS BALANCE, MIN(I.DUE_DATE) AS OLDEST_DUE,
    SUM(CASE WHEN I.DUE_DATE < CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE) THEN I.TOTAL - I.PAID ELSE 0 END) AS OVERDUE FROM AMC_INVOICE I JOIN AMC_CUSTOMER C ON C.CUST_ID = I.CUST_ID WHERE I.STATUS = 'OPEN' AND I.TOTAL - I.PAID > 0.004 GROUP BY C.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.CONTACT_NAME, C.MOBILE_NO ORDER BY BALANCE DESC`);
  res.json({ success: true, rows: q.recordset });
}));
r.get('/reports/collections', requireAuth, money, wrap(async (req, res) => {
  const { from, to } = range(req.query); if (!from || !to) throw badRequest('Give the period.');
  const q = await (await rq()).input('from', sql.Date, from).input('to', sql.Date, to).query(`
    SELECT P.PAY_ID, P.RCPT_NO, P.PAY_DATE, P.PAY_MODE, P.REF_NO, P.AMOUNT, I.INV_NO, C.SHOP_CODE, C.SHOP_NAME, U.USER_NAME FROM AMC_PAYMENT P JOIN AMC_INVOICE I ON I.INV_ID = P.INV_ID JOIN AMC_CUSTOMER C ON C.CUST_ID = P.CUST_ID LEFT JOIN AMC_USER U ON U.USER_ID = P.USER_ID WHERE P.CANCELLED = 0 AND P.PAY_DATE BETWEEN @from AND @to ORDER BY P.PAY_DATE, P.PAY_ID;
    SELECT P.PAY_MODE, COUNT(*) AS N, SUM(P.AMOUNT) AS AMOUNT FROM AMC_PAYMENT P WHERE P.CANCELLED = 0 AND P.PAY_DATE BETWEEN @from AND @to GROUP BY P.PAY_MODE;
    SELECT FORMAT(P.PAY_DATE, 'yyyy-MM') AS MONTH, COUNT(*) AS N, SUM(P.AMOUNT) AS AMOUNT FROM AMC_PAYMENT P WHERE P.CANCELLED = 0 AND P.PAY_DATE BETWEEN @from AND @to GROUP BY FORMAT(P.PAY_DATE, 'yyyy-MM') ORDER BY MONTH;
    SELECT COUNT(*) AS N, ISNULL(SUM(TOTAL), 0) AS AMOUNT FROM AMC_INVOICE WHERE STATUS <> 'CANCELLED' AND INV_DATE BETWEEN @from AND @to`);
  res.json({ success: true, rows: q.recordsets[0], byMode: q.recordsets[1], byMonth: q.recordsets[2], invoiced: q.recordsets[3][0] });
}));
r.get('/reports/tickets', requireAuth, wrap(async (req, res) => {
  const { from, to } = range(req.query); const by = req.query.by === 'customer' ? 'customer' : 'engineer';
  const q = await (await rq()).input('from', sql.Date, from).input('to', sql.Date, to).query(by === 'engineer'
    ? `SELECT ISNULL(A.USER_NAME, '(unassigned)') AS NAME, COUNT(*) AS N, SUM(CASE WHEN T.STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED, SUM(CASE WHEN T.STATUS <> 'CLOSED' THEN 1 ELSE 0 END) AS OPEN_N, SUM(CASE WHEN T.STATUS = 'CLOSED' AND T.CLOSED_AT > T.DUE_AT THEN 1 ELSE 0 END) AS LATE, SUM(T.MINUTES_SPENT) AS MINUTES, AVG(CASE WHEN T.STATUS = 'CLOSED' THEN DATEDIFF(minute, T.OPENED_AT, T.CLOSED_AT) END) AS AVG_MIN_TO_CLOSE FROM AMC_TICKET T LEFT JOIN AMC_USER A ON A.USER_ID = T.ASSIGNED_TO WHERE (@from IS NULL OR T.OPENED_AT >= @from) AND (@to IS NULL OR T.OPENED_AT < DATEADD(day, 1, @to)) GROUP BY A.USER_NAME ORDER BY N DESC`
    : `SELECT C.SHOP_NAME AS NAME, C.CUST_ID, COUNT(*) AS N, SUM(CASE WHEN T.STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED, SUM(CASE WHEN T.STATUS <> 'CLOSED' THEN 1 ELSE 0 END) AS OPEN_N, SUM(CASE WHEN T.PRIORITY IN ('HIGH', 'URGENT') THEN 1 ELSE 0 END) AS HIGH, SUM(T.MINUTES_SPENT) AS MINUTES FROM AMC_TICKET T JOIN AMC_CUSTOMER C ON C.CUST_ID = T.CUST_ID WHERE (@from IS NULL OR T.OPENED_AT >= @from) AND (@to IS NULL OR T.OPENED_AT < DATEADD(day, 1, @to)) GROUP BY C.SHOP_NAME, C.CUST_ID ORDER BY N DESC`);
  res.json({ success: true, rows: q.recordset });
}));
r.get('/reports/visits', requireAuth, wrap(async (req, res) => {
  const { from, to } = range(req.query);
  const q = await (await rq()).input('from', sql.Date, from).input('to', sql.Date, to).query(`SELECT ISNULL(E.USER_NAME, '(no engineer)') AS NAME, COUNT(*) AS N, SUM(CASE WHEN V.STATUS = 'DONE' THEN 1 ELSE 0 END) AS DONE, SUM(CASE WHEN V.STATUS = 'PLANNED' THEN 1 ELSE 0 END) AS PLANNED, SUM(CASE WHEN V.STATUS = 'CANCELLED' THEN 1 ELSE 0 END) AS CANCELLED, SUM(V.MINUTES) AS MINUTES, SUM(V.TRAVEL_KM) AS KM, COUNT(DISTINCT V.CUST_ID) AS SHOPS FROM AMC_VISIT V LEFT JOIN AMC_USER E ON E.USER_ID = V.ENGINEER WHERE (@from IS NULL OR V.VISIT_DATE >= @from) AND (@to IS NULL OR V.VISIT_DATE <= @to) GROUP BY E.USER_NAME ORDER BY N DESC;
    SELECT V.VISIT_ID, V.VISIT_DATE, V.VISIT_TIME, C.SHOP_NAME, C.SHOP_CODE, E.USER_NAME AS ENGINEER_NAME, V.PURPOSE, V.STATUS, V.MINUTES, V.TRAVEL_KM, T.TICKET_NO FROM AMC_VISIT V JOIN AMC_CUSTOMER C ON C.CUST_ID = V.CUST_ID LEFT JOIN AMC_USER E ON E.USER_ID = V.ENGINEER LEFT JOIN AMC_TICKET T ON T.TICKET_ID = V.TICKET_ID WHERE (@from IS NULL OR V.VISIT_DATE >= @from) AND (@to IS NULL OR V.VISIT_DATE <= @to) ORDER BY V.VISIT_DATE DESC`);
  res.json({ success: true, rows: q.recordsets[0], visits: q.recordsets[1] });
}));
export default r;
