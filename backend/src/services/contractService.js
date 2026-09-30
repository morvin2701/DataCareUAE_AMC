import { rq, sql } from '../config/db.js';
import { HttpError, notFound, badRequest } from '../utils/httpError.js';
import { today, addDays, renewalStart, yearEnd, iso, LICENCE_DAYS } from '../utils/dates.js';
import { getSetting } from './settingsService.js';
import { withNo } from './numbering.js';
import { audit } from './audit.js';
import { pushLicence } from './linkService.js';

/**
 * Contracts (AMC_CONTRACT). A year is exactly 365 days from its start. A renewal starts on the current expiry while it is
 * still live (so its end is +365 days from that expiry, as the ERP renews a licence), else today. Making a contract LIVE raises its tax invoice (one per contract) and pushes the licence to the shop's server:
 * { shopCode, endDate, tills?, plan?, status: 'ACTIVE' }.
 * Assumption: the "current expiry" a renewal counts from is the previous AMC's end; a shop with no AMC yet counts from its
 * ERP licence end (still live) or today.
 */
export const CONTRACT_COLS = `K.CONTRACT_ID, K.CUST_ID, C.SHOP_CODE, C.SHOP_NAME, C.HDD, C.SERVER_ID, S.NAME AS SERVER_NAME, K.CONTRACT_NO, K.START_DATE, K.END_DATE, K.AMOUNT, K.VAT_PRC, K.VAT_AMT, K.TOTAL, K.COVERS_SUPPORT, K.COVERS_UPDATES, K.VISITS_INCLUDED, K.TILLS, K.PLAN_CODE, K.STATUS, K.RENEWED_FROM,
  K.PUSH_STATUS, K.PUSH_MSG, K.PUSH_AT, K.REMARK, K.USER_ID, U.USER_NAME, K.ENTRY_DATE, K.EDIT_DATE, DATEDIFF(day, CAST(SYSUTCDATETIME() AS DATE), K.END_DATE) AS DAYS_LEFT,
  (SELECT TOP 1 I.INV_NO FROM AMC_INVOICE I WHERE I.CONTRACT_ID = K.CONTRACT_ID AND I.STATUS <> 'CANCELLED') AS INV_NO, (SELECT TOP 1 I.INV_ID FROM AMC_INVOICE I WHERE I.CONTRACT_ID = K.CONTRACT_ID AND I.STATUS <> 'CANCELLED') AS INV_ID,
  (SELECT ISNULL(SUM(I.TOTAL - I.PAID), 0) FROM AMC_INVOICE I WHERE I.CONTRACT_ID = K.CONTRACT_ID AND I.STATUS <> 'CANCELLED') AS BALANCE,
  (SELECT COUNT(*) FROM AMC_VISIT V WHERE V.CUST_ID = K.CUST_ID AND V.STATUS = 'DONE' AND V.VISIT_DATE BETWEEN K.START_DATE AND K.END_DATE) AS VISITS_USED`;
export const CONTRACT_FROM = 'FROM AMC_CONTRACT K JOIN AMC_CUSTOMER C ON C.CUST_ID = K.CUST_ID JOIN AMC_SERVER S ON S.SERVER_ID = C.SERVER_ID LEFT JOIN AMC_USER U ON U.USER_ID = K.USER_ID';
const shape = (k) => ({ ...k, COVERS_SUPPORT: !!k.COVERS_SUPPORT, COVERS_UPDATES: !!k.COVERS_UPDATES, START_DATE: iso(k.START_DATE), END_DATE: iso(k.END_DATE) });
/** LIVE contracts past their end read EXPIRED — kept true on every read. */
export const expireContracts = async () => (await rq()).query("UPDATE AMC_CONTRACT SET STATUS = 'EXPIRED', EDIT_DATE = SYSUTCDATETIME() WHERE STATUS = 'LIVE' AND END_DATE < CAST(SYSUTCDATETIME() AS DATE)");
export async function getContract(id) { await expireContracts(); const r = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${CONTRACT_COLS} ${CONTRACT_FROM} WHERE K.CONTRACT_ID = @id`)).recordset[0]; return r ? shape(r) : null; }
export async function listContracts({ q = '', status = '', custId = 0, expiring = '' } = {}) {
  await expireContracts();
  const where = ['1 = 1'];
  if (q) where.push('(K.CONTRACT_NO LIKE @q OR C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q OR C.HDD LIKE @q)');
  if (status) where.push('K.STATUS = @status'); if (custId) where.push('K.CUST_ID = @cust');
  if (expiring === '30') where.push("K.STATUS = 'LIVE' AND K.END_DATE <= DATEADD(day, 30, CAST(SYSUTCDATETIME() AS DATE))");
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${q}%`).input('status', sql.VarChar(10), String(status).toUpperCase()).input('cust', sql.Int, Number(custId) || 0).query(`SELECT ${CONTRACT_COLS} ${CONTRACT_FROM} WHERE ${where.join(' AND ')} ORDER BY K.END_DATE DESC, K.CONTRACT_ID DESC`);
  return r.recordset.map(shape);
}
/** What a new contract for this shop starts from: the previous contract (dates, amount, cover), the licence, the VAT rate. */
export async function contractDefaults(custId) {
  const c = (await (await rq()).input('id', sql.Int, custId).query('SELECT CUST_ID, SHOP_CODE, SHOP_NAME, LIC_END, TILLS, PLAN_CODE FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0];
  if (!c) throw notFound('Customer not found');
  const prev = (await (await rq()).input('id', sql.Int, custId).query("SELECT TOP 1 CONTRACT_ID, CONTRACT_NO, END_DATE, AMOUNT, VAT_PRC, COVERS_SUPPORT, COVERS_UPDATES, VISITS_INCLUDED, STATUS FROM AMC_CONTRACT WHERE CUST_ID = @id AND STATUS IN ('LIVE', 'EXPIRED') ORDER BY END_DATE DESC")).recordset[0];
  const base = prev ? prev.END_DATE : c.LIC_END;
  const start = renewalStart(base); const vat = Number(await getSetting('VAT_PRC'));
  return { customer: c, previous: prev ? { ...prev, END_DATE: iso(prev.END_DATE) } : null, START_DATE: start, END_DATE: yearEnd(start), AMOUNT: prev ? Number(prev.AMOUNT) : 0, VAT_PRC: vat, COVERS_SUPPORT: prev ? !!prev.COVERS_SUPPORT : true, COVERS_UPDATES: prev ? !!prev.COVERS_UPDATES : true, VISITS_INCLUDED: prev ? prev.VISITS_INCLUDED : 0, TILLS: c.TILLS || null, PLAN_CODE: c.PLAN_CODE || null, RENEWED_FROM: prev?.CONTRACT_ID || null, licenceDays: LICENCE_DAYS };
}
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
function readBody(b, { forNew }) {
  const start = iso(b.START_DATE); if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw badRequest('The start date reads 2026-09-30.', 'VALIDATION');
  const end = b.END_DATE ? iso(b.END_DATE) : yearEnd(start); if (end < start) throw badRequest('The end date is before the start.', 'VALIDATION');
  const amount = money(b.AMOUNT); if (amount < 0) throw badRequest('The amount cannot be negative.', 'VALIDATION');
  const vatPrc = b.VAT_PRC == null || b.VAT_PRC === '' ? null : Number(b.VAT_PRC); if (vatPrc != null && (!(vatPrc >= 0) || vatPrc > 100)) throw badRequest('VAT % must be 0–100.', 'VALIDATION');
  const plan = b.PLAN_CODE ? String(b.PLAN_CODE).toUpperCase() : null; if (plan && !['BASIC', 'PRO', 'ADVANCE', 'ENTERPRISE'].includes(plan)) throw badRequest('Version is Basic, Pro, Advance or Enterprise.', 'VALIDATION');
  const tills = b.TILLS === '' || b.TILLS == null ? null : Math.max(0, parseInt(b.TILLS, 10) || 0);
  return { start, end, amount, vatPrc, plan, tills, coversSupport: b.COVERS_SUPPORT !== false, coversUpdates: b.COVERS_UPDATES !== false, visits: Math.max(0, parseInt(b.VISITS_INCLUDED, 10) || 0), remark: String(b.REMARK || '').slice(0, 1000) || null, status: forNew && String(b.STATUS || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DRAFT' };
}
export async function createContract(ctx, b) {
  const custId = Number(b.CUST_ID); const c = (await (await rq()).input('id', sql.Int, custId).query('SELECT CUST_ID, SERVER_ID, SHOP_CODE FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0];
  if (!c) throw notFound('Customer not found');
  const d = readBody(b, { forNew: true }); const vatPrc = d.vatPrc ?? Number(await getSetting('VAT_PRC')); const vatAmt = money(d.amount * vatPrc / 100);
  const live = (await (await rq()).input('id', sql.Int, custId).input('s', sql.Date, d.start).input('e', sql.Date, d.end).query("SELECT CONTRACT_NO FROM AMC_CONTRACT WHERE CUST_ID = @id AND STATUS = 'LIVE' AND START_DATE < @e AND END_DATE > @s")).recordset[0];
  if (live && d.status === 'LIVE') throw new HttpError(409, `${live.CONTRACT_NO} is already live for these dates — start the renewal on the day it ends.`, 'OVERLAP');
  const id = await withNo('CONTRACT', async (no) => (await (await rq()).input('c', sql.Int, custId).input('no', sql.VarChar(20), no).input('s', sql.Date, d.start).input('e', sql.Date, d.end).input('a', sql.Decimal(18, 2), d.amount).input('vp', sql.Decimal(5, 2), vatPrc).input('va', sql.Decimal(18, 2), vatAmt).input('t', sql.Decimal(18, 2), money(d.amount + vatAmt))
    .input('cs', sql.Bit, d.coversSupport).input('cu', sql.Bit, d.coversUpdates).input('v', sql.Int, d.visits).input('ti', sql.Int, d.tills).input('pl', sql.VarChar(20), d.plan).input('st', sql.VarChar(10), 'DRAFT').input('rf', sql.Int, Number(b.RENEWED_FROM) || null).input('rm', sql.NVarChar(1000), d.remark).input('u', sql.Int, ctx.userId)
    .query('INSERT INTO AMC_CONTRACT (CUST_ID, CONTRACT_NO, START_DATE, END_DATE, AMOUNT, VAT_PRC, VAT_AMT, TOTAL, COVERS_SUPPORT, COVERS_UPDATES, VISITS_INCLUDED, TILLS, PLAN_CODE, STATUS, RENEWED_FROM, REMARK, USER_ID) OUTPUT inserted.CONTRACT_ID VALUES (@c, @no, @s, @e, @a, @vp, @va, @t, @cs, @cu, @v, @ti, @pl, @st, @rf, @rm, @u)')).recordset[0].CONTRACT_ID);
  const k = await getContract(id);
  await audit(ctx, 'AMC_CONTRACT', k.CONTRACT_NO, 'CREATE', { shop: c.SHOP_CODE, start: d.start, end: d.end, total: k.TOTAL });
  if (d.status === 'LIVE') return setStatus(ctx, id, 'LIVE');
  return { contract: k };
}
export async function updateContract(ctx, id, b) {
  const k = await getContract(id); if (!k) throw notFound('Contract not found');
  if (k.STATUS === 'CANCELLED') throw badRequest('A cancelled contract cannot be changed.');
  const d = readBody({ ...k, ...b }, { forNew: false }); const vatPrc = d.vatPrc ?? k.VAT_PRC; const vatAmt = money(d.amount * vatPrc / 100);
  if (k.STATUS !== 'DRAFT' && (d.start !== k.START_DATE || d.end !== k.END_DATE)) throw badRequest('Dates of a live contract cannot move — cancel it and make a new one.');
  if (k.STATUS !== 'DRAFT' && d.amount !== Number(k.AMOUNT) && k.INV_NO) throw badRequest(`The amount is on tax invoice ${k.INV_NO} — cancel the invoice first.`);
  await (await rq()).input('id', sql.Int, id).input('s', sql.Date, d.start).input('e', sql.Date, d.end).input('a', sql.Decimal(18, 2), d.amount).input('vp', sql.Decimal(5, 2), vatPrc).input('va', sql.Decimal(18, 2), vatAmt).input('t', sql.Decimal(18, 2), money(d.amount + vatAmt))
    .input('cs', sql.Bit, d.coversSupport).input('cu', sql.Bit, d.coversUpdates).input('v', sql.Int, d.visits).input('ti', sql.Int, d.tills).input('pl', sql.VarChar(20), d.plan).input('rm', sql.NVarChar(1000), d.remark)
    .query('UPDATE AMC_CONTRACT SET START_DATE = @s, END_DATE = @e, AMOUNT = @a, VAT_PRC = @vp, VAT_AMT = @va, TOTAL = @t, COVERS_SUPPORT = @cs, COVERS_UPDATES = @cu, VISITS_INCLUDED = @v, TILLS = @ti, PLAN_CODE = @pl, REMARK = @rm, EDIT_DATE = SYSUTCDATETIME() WHERE CONTRACT_ID = @id');
  await audit(ctx, 'AMC_CONTRACT', k.CONTRACT_NO, 'UPDATE', { start: d.start, end: d.end, amount: d.amount });
  return { contract: await getContract(id) };
}
/** DRAFT → LIVE raises the invoice and pushes the licence; LIVE/DRAFT → CANCELLED. */
export async function setStatus(ctx, id, status) {
  const k = await getContract(id); if (!k) throw notFound('Contract not found');
  const want = String(status || '').toUpperCase();
  if (want === 'LIVE') {
    if (k.STATUS === 'LIVE') return { contract: k };
    if (k.STATUS !== 'DRAFT') throw badRequest(`A ${k.STATUS.toLowerCase()} contract cannot be made live.`);
    if (k.END_DATE < today()) throw badRequest('This contract has already ended — fix the dates first.');
    const clash = (await (await rq()).input('id', sql.Int, k.CUST_ID).input('me', sql.Int, id).input('s', sql.Date, k.START_DATE).input('e', sql.Date, k.END_DATE).query("SELECT CONTRACT_NO FROM AMC_CONTRACT WHERE CUST_ID = @id AND CONTRACT_ID <> @me AND STATUS = 'LIVE' AND START_DATE < @e AND END_DATE > @s")).recordset[0];
    if (clash) throw new HttpError(409, `${clash.CONTRACT_NO} is already live for these dates.`, 'OVERLAP');
    await (await rq()).input('id', sql.Int, id).query("UPDATE AMC_CONTRACT SET STATUS = 'LIVE', EDIT_DATE = SYSUTCDATETIME() WHERE CONTRACT_ID = @id");
    await audit(ctx, 'AMC_CONTRACT', k.CONTRACT_NO, 'LIVE');
    const { ensureInvoice } = await import('./invoiceService.js'); await ensureInvoice(ctx, id);
    await pushContract(ctx, id);
    return { contract: await getContract(id) };
  }
  if (want === 'CANCELLED') {
    if (k.STATUS === 'CANCELLED') return { contract: k };
    if (Number(k.BALANCE) !== Number(k.TOTAL) && k.INV_NO && Number(k.BALANCE) < Number(k.TOTAL)) throw badRequest(`Money was received against ${k.INV_NO} — cancel its payments first.`);
    await (await rq()).input('id', sql.Int, id).query("UPDATE AMC_CONTRACT SET STATUS = 'CANCELLED', EDIT_DATE = SYSUTCDATETIME() WHERE CONTRACT_ID = @id; UPDATE AMC_INVOICE SET STATUS = 'CANCELLED', EDIT_DATE = SYSUTCDATETIME() WHERE CONTRACT_ID = @id AND PAID = 0");
    await audit(ctx, 'AMC_CONTRACT', k.CONTRACT_NO, 'CANCEL');
    return { contract: await getContract(id) };
  }
  throw badRequest('Status is LIVE or CANCELLED.');
}
/** Push (or re-push) the licence this contract stands for. */
export async function pushContract(ctx, id) {
  const k = await getContract(id); if (!k) throw notFound('Contract not found');
  if (k.STATUS !== 'LIVE') throw badRequest('Only a live contract is pushed to the shop.');
  const payload = { shopCode: k.SHOP_CODE, endDate: k.END_DATE, ...(k.TILLS != null ? { tills: k.TILLS } : {}), ...(k.PLAN_CODE ? { plan: k.PLAN_CODE } : {}), status: 'ACTIVE' };
  return pushLicence(ctx, { serverId: k.SERVER_ID, custId: k.CUST_ID, contractId: id, payload });
}
/** Contract print: the contract, the shop and DataCare's own details. */
export async function contractPrint(id) {
  const k = await getContract(id); if (!k) throw notFound('Contract not found');
  const c = (await (await rq()).input('id', sql.Int, k.CUST_ID).query('SELECT SHOP_CODE, SHOP_NAME, HDD, PLAN_CODE, TILLS, CONTACT_NAME, MOBILE_NO, EMAIL_ID, EMIRATE_CODE, LIC_END FROM AMC_CUSTOMER WHERE CUST_ID = @id')).recordset[0];
  return { contract: k, customer: c, company: await getSetting('COMPANY') };
}
