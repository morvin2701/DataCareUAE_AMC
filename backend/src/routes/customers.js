import { Router } from 'express';
import { requireAuth, requireRole, noMoney } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { rq, sql } from '../config/db.js';
import { listParties, getParty, createParty, updateParty, deleteParty, planChanges, nextHdd, PLANS, CUST_TYPES } from '../services/partyService.js';
import { getSetting } from '../services/settingsService.js';
export { CUST_COLS, CUST_FROM } from '../services/partyService.js';

/** Party master. OWNER / SUPPORT add and change parties; ACCOUNTS reads. Amounts are stripped for SUPPORT. */
const r = Router(); const write = requireRole('SUPPORT');
r.get('/customers', requireAuth, wrap(async (req, res) => res.json({ success: true, rows: noMoney(req.ctx, await listParties(req.query)) })));
r.get('/customers/meta', requireAuth, wrap(async (req, res) => res.json({ success: true, plans: PLANS, types: CUST_TYPES, prices: req.ctx.role === 'SUPPORT' ? null : await getSetting('PRICES'), nextHdd: await nextHdd(req.query.plan, req.query.installer) })));
r.get('/customers/:id', requireAuth, wrap(async (req, res) => { const c = await getParty(Number(req.params.id)); if (!c) throw notFound('Party not found'); res.json({ success: true, customer: noMoney(req.ctx, c), changes: req.ctx.role === 'SUPPORT' ? [] : await planChanges(c.CUST_ID) }); }));
r.post('/customers', requireAuth, write, wrap(async (req, res) => res.status(201).json({ success: true, customer: noMoney(req.ctx, await createParty(req.ctx, req.body || {})) })));
r.put('/customers/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, customer: noMoney(req.ctx, await updateParty(req.ctx, Number(req.params.id), req.body || {})) })));
r.delete('/customers/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ...(await deleteParty(req.ctx, Number(req.params.id))) })));
r.get('/customers/:id/history', requireAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const q = await (await rq()).input('id', sql.Int, id).query(`
    SELECT 'CONTRACT' AS KIND, CONTRACT_NO AS REF, START_DATE AS D, CAST(STATUS AS NVARCHAR(200)) AS TEXT, TOTAL AS AMOUNT FROM AMC_CONTRACT WHERE CUST_ID = @id
    UNION ALL SELECT 'INVOICE', INV_NO, INV_DATE, CAST(KIND + ' · ' + STATUS AS NVARCHAR(200)), TOTAL FROM AMC_INVOICE WHERE CUST_ID = @id
    UNION ALL SELECT 'PAYMENT', RCPT_NO, PAY_DATE, CAST(PAY_MODE + ISNULL(' ' + REF_NO, '') AS NVARCHAR(200)), AMOUNT FROM AMC_PAYMENT WHERE CUST_ID = @id AND CANCELLED = 0
    UNION ALL SELECT 'TICKET', TICKET_NO, CAST(OPENED_AT AS DATE), CAST(TITLE AS NVARCHAR(200)), NULL FROM AMC_TICKET WHERE CUST_ID = @id
    UNION ALL SELECT 'VISIT', CAST(VISIT_ID AS VARCHAR), VISIT_DATE, CAST(PURPOSE AS NVARCHAR(200)), NULL FROM AMC_VISIT WHERE CUST_ID = @id
    UNION ALL SELECT 'UPGRADE', ISNULL(FROM_PLAN, '') + ' → ' + TO_PLAN, CHANGE_DATE, N'Software type changed', AMOUNT FROM AMC_PLAN_CHANGE WHERE CUST_ID = @id
    UNION ALL SELECT 'REMINDER', REF_KEY, CAST(SENT_AT AS DATE), CAST(CHANNEL + ' → ' + ISNULL(SENT_TO, '') AS NVARCHAR(200)), NULL FROM AMC_REMINDER_LOG WHERE CUST_ID = @id AND OK = 1
    ORDER BY D DESC, KIND`);
  res.json({ success: true, rows: noMoney(req.ctx, q.recordset) });
}));
export default r;
