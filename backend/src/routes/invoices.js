import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listInvoices, getInvoice, ensureInvoice, cancelInvoice, invoicePrint, outstanding, statement, listPayments, addPayment, cancelPayment, receiptPrint } from '../services/invoiceService.js';
/** Invoices and payments — OWNER / ACCOUNTS only. SUPPORT never reaches these routes. */
const r = Router(); const money = requireRole('ACCOUNTS');
r.get('/invoices', requireAuth, money, wrap(async (req, res) => res.json({ success: true, rows: await listInvoices(req.query) })));
r.get('/invoices/outstanding', requireAuth, money, wrap(async (_req, res) => res.json({ success: true, rows: await outstanding() })));
r.get('/invoices/:id', requireAuth, money, wrap(async (req, res) => { const i = await getInvoice(Number(req.params.id)); if (!i) throw notFound('Invoice not found'); res.json({ success: true, invoice: i }); }));
r.get('/invoices/:id/print', requireAuth, money, wrap(async (req, res) => res.json({ success: true, ...(await invoicePrint(Number(req.params.id))) })));
r.post('/invoices', requireAuth, money, wrap(async (req, res) => res.status(201).json({ success: true, invoice: await ensureInvoice(req.ctx, Number(req.body?.CONTRACT_ID), { invDate: req.body?.INV_DATE || null, dueDays: Number(req.body?.dueDays) || 30 }) })));
r.post('/invoices/:id/cancel', requireAuth, money, wrap(async (req, res) => res.json({ success: true, invoice: await cancelInvoice(req.ctx, Number(req.params.id)) })));
r.get('/customers/:id/statement', requireAuth, money, wrap(async (req, res) => res.json({ success: true, ...(await statement(Number(req.params.id))) })));
r.get('/payments', requireAuth, money, wrap(async (req, res) => res.json({ success: true, rows: await listPayments(req.query) })));
r.post('/payments', requireAuth, money, wrap(async (req, res) => res.status(201).json({ success: true, payment: await addPayment(req.ctx, req.body || {}) })));
r.post('/payments/:id/cancel', requireAuth, money, wrap(async (req, res) => res.json({ success: true, payment: await cancelPayment(req.ctx, Number(req.params.id)) })));
r.get('/payments/:id/print', requireAuth, money, wrap(async (req, res) => res.json({ success: true, ...(await receiptPrint(Number(req.params.id))) })));
export default r;
