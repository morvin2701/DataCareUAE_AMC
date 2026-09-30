import { rq, sql } from '../config/db.js';
import { notFound, badRequest } from '../utils/httpError.js';
import { today, addDays, iso } from '../utils/dates.js';
import { getSetting } from './settingsService.js';
import { withNo } from './numbering.js';
import { audit } from './audit.js';

/** Tax invoices (one per contract) and receipts. PAID on the invoice always equals the sum of its live payments. */
export const INV_COLS = `I.INV_ID, I.INV_NO, I.CONTRACT_ID, K.CONTRACT_NO, I.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, I.INV_DATE, I.DUE_DATE, I.DESCRIPTION, I.AMOUNT, I.VAT_PRC, I.VAT_AMT, I.TOTAL, I.PAID, I.TOTAL - I.PAID AS BALANCE, I.STATUS, I.REMARK, I.ENTRY_DATE,
  CASE WHEN I.STATUS = 'OPEN' AND I.DUE_DATE < CAST(SYSUTCDATETIME() AS DATE) THEN DATEDIFF(day, I.DUE_DATE, CAST(SYSUTCDATETIME() AS DATE)) ELSE 0 END AS DAYS_OVERDUE`;
export const INV_FROM = 'FROM AMC_INVOICE I JOIN AMC_CUSTOMER C ON C.CUST_ID = I.CUST_ID LEFT JOIN AMC_CONTRACT K ON K.CONTRACT_ID = I.CONTRACT_ID';
const shape = (i) => ({ ...i, INV_DATE: iso(i.INV_DATE), DUE_DATE: iso(i.DUE_DATE) });
export async function getInvoice(id) { const r = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${INV_COLS} ${INV_FROM} WHERE I.INV_ID = @id`)).recordset[0]; return r ? shape(r) : null; }
export async function listInvoices({ q = '', status = '', custId = 0, from = '', to = '' } = {}) {
  const where = ['1 = 1'];
  if (q) where.push('(I.INV_NO LIKE @q OR K.CONTRACT_NO LIKE @q OR C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q)');
  if (status === 'OVERDUE') where.push("I.STATUS = 'OPEN' AND I.DUE_DATE < CAST(SYSUTCDATETIME() AS DATE)"); else if (status) where.push('I.STATUS = @status');
  if (custId) where.push('I.CUST_ID = @cust'); if (from) where.push('I.INV_DATE >= @from'); if (to) where.push('I.INV_DATE <= @to');
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${q}%`).input('status', sql.VarChar(10), String(status).toUpperCase()).input('cust', sql.Int, Number(custId) || 0).input('from', sql.Date, from || null).input('to', sql.Date, to || null).query(`SELECT ${INV_COLS} ${INV_FROM} WHERE ${where.join(' AND ')} ORDER BY I.INV_DATE DESC, I.INV_ID DESC`);
  return r.recordset.map(shape);
}
/** The contract's tax invoice, made once when it goes live (or by hand for a draft that is invoiced first). */
export async function ensureInvoice(ctx, contractId, { invDate = null, dueDays = 30 } = {}) {
  const k = (await (await rq()).input('id', sql.Int, contractId).query('SELECT K.*, C.SHOP_NAME FROM AMC_CONTRACT K JOIN AMC_CUSTOMER C ON C.CUST_ID = K.CUST_ID WHERE K.CONTRACT_ID = @id')).recordset[0];
  if (!k) throw notFound('Contract not found');
  const have = (await (await rq()).input('id', sql.Int, contractId).query("SELECT INV_ID FROM AMC_INVOICE WHERE CONTRACT_ID = @id AND STATUS <> 'CANCELLED'")).recordset[0];
  if (have) return getInvoice(have.INV_ID);
  const d = invDate || today(); const desc = `Annual maintenance contract ${k.CONTRACT_NO} — ${k.SHOP_NAME}, ${iso(k.START_DATE).split('-').reverse().join('/')} to ${iso(k.END_DATE).split('-').reverse().join('/')}`;
  const id = await withNo('INVOICE', async (no) => (await (await rq()).input('no', sql.VarChar(20), no).input('k', sql.Int, contractId).input('c', sql.Int, k.CUST_ID).input('d', sql.Date, d).input('due', sql.Date, addDays(d, dueDays)).input('ds', sql.NVarChar(500), desc)
    .input('a', sql.Decimal(18, 2), k.AMOUNT).input('vp', sql.Decimal(5, 2), k.VAT_PRC).input('va', sql.Decimal(18, 2), k.VAT_AMT).input('t', sql.Decimal(18, 2), k.TOTAL).input('u', sql.Int, ctx.userId)
    .query('INSERT INTO AMC_INVOICE (INV_NO, CONTRACT_ID, CUST_ID, INV_DATE, DUE_DATE, DESCRIPTION, AMOUNT, VAT_PRC, VAT_AMT, TOTAL, USER_ID) OUTPUT inserted.INV_ID VALUES (@no, @k, @c, @d, @due, @ds, @a, @vp, @va, @t, @u)')).recordset[0].INV_ID);
  const inv = await getInvoice(id); await audit(ctx, 'AMC_INVOICE', inv.INV_NO, 'CREATE', { contract: k.CONTRACT_NO, total: inv.TOTAL }); return inv;
}
export async function cancelInvoice(ctx, id) {
  const i = await getInvoice(id); if (!i) throw notFound('Invoice not found');
  if (Number(i.PAID) > 0) throw badRequest('Money was received against this invoice — cancel its receipts first.');
  await (await rq()).input('id', sql.Int, id).query("UPDATE AMC_INVOICE SET STATUS = 'CANCELLED', EDIT_DATE = SYSUTCDATETIME() WHERE INV_ID = @id");
  await audit(ctx, 'AMC_INVOICE', i.INV_NO, 'CANCEL'); return getInvoice(id);
}
export async function invoicePrint(id) {
  const inv = await getInvoice(id); if (!inv) throw notFound('Invoice not found');
  const c = (await (await rq()).input('id', sql.Int, inv.CUST_ID).query('SELECT SHOP_CODE, SHOP_NAME, HDD, CONTACT_NAME, MOBILE_NO, EMAIL_ID, EMIRATE_CODE FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0];
  const pays = (await (await rq()).input('id', sql.Int, id).query('SELECT RCPT_NO, PAY_DATE, PAY_MODE, REF_NO, AMOUNT FROM AMC_PAYMENT WHERE INV_ID = @id AND CANCELLED = 0 ORDER BY PAY_DATE, PAY_ID')).recordset.map((p) => ({ ...p, PAY_DATE: iso(p.PAY_DATE) }));
  return { invoice: inv, customer: c, payments: pays, company: await getSetting('COMPANY') };
}
/** Every open invoice with its balance, oldest due first. */
export async function outstanding() { const r = await (await rq()).query(`SELECT ${INV_COLS} ${INV_FROM} WHERE I.STATUS = 'OPEN' AND I.TOTAL - I.PAID > 0.004 ORDER BY I.DUE_DATE, I.INV_ID`); return r.recordset.map(shape); }
/** Statement per customer: invoices and receipts in date order with a running balance. */
export async function statement(custId) {
  const c = (await (await rq()).input('id', sql.Int, custId).query('SELECT CUST_ID, SHOP_CODE, SHOP_NAME, HDD, CONTACT_NAME, MOBILE_NO, EMAIL_ID FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0]; if (!c) throw notFound('Customer not found');
  const rows = (await (await rq()).input('id', sql.Int, custId).query(`
    SELECT 'INVOICE' AS KIND, I.INV_DATE AS D, I.INV_NO AS REF, I.DESCRIPTION AS TEXT, I.TOTAL AS DEBIT, CAST(0 AS DECIMAL(18,2)) AS CREDIT, I.INV_ID AS ID FROM AMC_INVOICE I WHERE I.CUST_ID = @id AND I.STATUS <> 'CANCELLED'
    UNION ALL SELECT 'RECEIPT', P.PAY_DATE, P.RCPT_NO, CAST(P.PAY_MODE + ISNULL(' ' + P.REF_NO, '') + ' against ' + I.INV_NO AS NVARCHAR(500)), 0, P.AMOUNT, P.PAY_ID FROM AMC_PAYMENT P JOIN AMC_INVOICE I ON I.INV_ID = P.INV_ID WHERE P.CUST_ID = @id AND P.CANCELLED = 0
    ORDER BY D, KIND DESC, ID`)).recordset;
  let bal = 0; const out = rows.map((r) => { bal += Number(r.DEBIT) - Number(r.CREDIT); return { ...r, D: iso(r.D), BALANCE: Math.round(bal * 100) / 100 }; });
  return { customer: c, rows: out, balance: Math.round(bal * 100) / 100, company: await getSetting('COMPANY') };
}
// ───────────────────────── payments
export const PAY_COLS = 'P.PAY_ID, P.RCPT_NO, P.INV_ID, I.INV_NO, I.CONTRACT_ID, P.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, P.PAY_DATE, P.PAY_MODE, P.REF_NO, P.AMOUNT, P.REMARK, P.CANCELLED, P.USER_ID, U.USER_NAME, P.ENTRY_DATE';
export const PAY_FROM = 'FROM AMC_PAYMENT P JOIN AMC_INVOICE I ON I.INV_ID = P.INV_ID JOIN AMC_CUSTOMER C ON C.CUST_ID = P.CUST_ID LEFT JOIN AMC_USER U ON U.USER_ID = P.USER_ID';
const shapeP = (p) => ({ ...p, PAY_DATE: iso(p.PAY_DATE), CANCELLED: !!p.CANCELLED });
export async function getPayment(id) { const r = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${PAY_COLS} ${PAY_FROM} WHERE P.PAY_ID = @id`)).recordset[0]; return r ? shapeP(r) : null; }
export async function listPayments({ q = '', custId = 0, from = '', to = '', mode = '' } = {}) {
  const where = ['1 = 1'];
  if (q) where.push('(P.RCPT_NO LIKE @q OR I.INV_NO LIKE @q OR C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q OR P.REF_NO LIKE @q)');
  if (custId) where.push('P.CUST_ID = @cust'); if (from) where.push('P.PAY_DATE >= @from'); if (to) where.push('P.PAY_DATE <= @to'); if (mode) where.push('P.PAY_MODE = @mode');
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${q}%`).input('cust', sql.Int, Number(custId) || 0).input('from', sql.Date, from || null).input('to', sql.Date, to || null).input('mode', sql.VarChar(10), String(mode).toUpperCase()).query(`SELECT ${PAY_COLS} ${PAY_FROM} WHERE ${where.join(' AND ')} ORDER BY P.PAY_DATE DESC, P.PAY_ID DESC`);
  return r.recordset.map(shapeP);
}
const syncPaid = async (invId) => (await rq()).input('id', sql.Int, invId).query("UPDATE AMC_INVOICE SET PAID = ISNULL((SELECT SUM(AMOUNT) FROM AMC_PAYMENT WHERE INV_ID = @id AND CANCELLED = 0), 0), EDIT_DATE = SYSUTCDATETIME() WHERE INV_ID = @id; UPDATE AMC_INVOICE SET STATUS = CASE WHEN PAID >= TOTAL - 0.004 THEN 'PAID' ELSE 'OPEN' END WHERE INV_ID = @id AND STATUS <> 'CANCELLED'");
export async function addPayment(ctx, b) {
  const inv = await getInvoice(Number(b.INV_ID)); if (!inv) throw notFound('Invoice not found');
  if (inv.STATUS === 'CANCELLED') throw badRequest('That invoice is cancelled.');
  const amount = Math.round((Number(b.AMOUNT) || 0) * 100) / 100; if (!(amount > 0)) throw badRequest('Enter the amount received.', 'VALIDATION');
  if (amount > Number(inv.BALANCE) + 0.004) throw badRequest(`Only AED ${Number(inv.BALANCE).toFixed(2)} is outstanding on ${inv.INV_NO}.`, 'VALIDATION');
  const mode = String(b.PAY_MODE || 'BANK').toUpperCase(); if (!['CASH', 'BANK', 'CHEQUE', 'CARD'].includes(mode)) throw badRequest('Mode is cash, bank, cheque or card.', 'VALIDATION');
  const d = iso(b.PAY_DATE) || today(); if (d > today()) throw badRequest('The receipt date cannot be in the future.', 'VALIDATION');
  const id = await withNo('RECEIPT', async (no) => (await (await rq()).input('no', sql.VarChar(20), no).input('i', sql.Int, inv.INV_ID).input('c', sql.Int, inv.CUST_ID).input('d', sql.Date, d).input('m', sql.VarChar(10), mode).input('r', sql.NVarChar(60), String(b.REF_NO || '').slice(0, 60) || null).input('a', sql.Decimal(18, 2), amount).input('rm', sql.NVarChar(500), String(b.REMARK || '').slice(0, 500) || null).input('u', sql.Int, ctx.userId)
    .query('INSERT INTO AMC_PAYMENT (RCPT_NO, INV_ID, CUST_ID, PAY_DATE, PAY_MODE, REF_NO, AMOUNT, REMARK, USER_ID) OUTPUT inserted.PAY_ID VALUES (@no, @i, @c, @d, @m, @r, @a, @rm, @u)')).recordset[0].PAY_ID);
  await syncPaid(inv.INV_ID);
  const p = await getPayment(id); await audit(ctx, 'AMC_PAYMENT', p.RCPT_NO, 'CREATE', { invoice: inv.INV_NO, amount, mode }); return p;
}
export async function cancelPayment(ctx, id) {
  const p = await getPayment(id); if (!p) throw notFound('Receipt not found'); if (p.CANCELLED) return p;
  await (await rq()).input('id', sql.Int, id).query('UPDATE AMC_PAYMENT SET CANCELLED = 1 WHERE PAY_ID = @id'); await syncPaid(p.INV_ID);
  await audit(ctx, 'AMC_PAYMENT', p.RCPT_NO, 'CANCEL', { amount: p.AMOUNT }); return getPayment(id);
}
export async function receiptPrint(id) {
  const p = await getPayment(id); if (!p) throw notFound('Receipt not found');
  const inv = await getInvoice(p.INV_ID); const c = (await (await rq()).input('id', sql.Int, p.CUST_ID).query('SELECT SHOP_CODE, SHOP_NAME, HDD, CONTACT_NAME, MOBILE_NO, EMAIL_ID FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0];
  return { payment: p, invoice: inv, customer: c, company: await getSetting('COMPANY') };
}
