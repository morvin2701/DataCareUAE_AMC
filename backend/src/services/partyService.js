import { rq, sql } from '../config/db.js';
import { HttpError, notFound, badRequest } from '../utils/httpError.js';
import { iso, today, yearEnd } from '../utils/dates.js';
import { getSetting } from './settingsService.js';
import { audit } from './audit.js';
import { raiseInvoice } from './invoiceService.js';

/**
 * Party master — the customers, typed in here like the India AMC software: shop, who installed it, software type, contact,
 * address, dates, installation amount. A party may later be matched to a shop the ERP reports (same HDD or Shop ID); the
 * heartbeat then refreshes its licence facts. Nothing ever goes back to the ERP.
 *   Installation date → AMC start; AMC end = start + 365 days.
 *   Installation amount → one INSTALL invoice, raised when the party is saved with an amount and none exists yet.
 *   Moving up a software type → the "convert amount" = price of the new type − price of the old (Settings → Prices),
 *   kept in AMC_PLAN_CHANGE and billed as an UPGRADE invoice.
 */
export const PLANS = ['BASIC', 'PRO', 'ADVANCE', 'ENTERPRISE']; export const CUST_TYPES = ['NEW', 'EXISTING', 'CONVERTED'];
export const PLAN_LETTER = { BASIC: 'B', PRO: 'P', ADVANCE: 'A', ENTERPRISE: 'E' };
export const CUST_COLS = `C.CUST_ID, C.SOURCE, C.SERVER_ID, S.SERVER_CODE, S.NAME AS SERVER_NAME, S.LAST_HEARTBEAT, CASE WHEN S.SERVER_ID IS NOT NULL AND (S.LAST_HEARTBEAT IS NULL OR S.LAST_HEARTBEAT < DATEADD(hour, -48, SYSUTCDATETIME())) THEN 1 ELSE 0 END AS OFFLINE,
  C.SHOP_CODE, C.SHOP_NAME, C.HDD, C.PLAN_CODE, C.STATUS, C.TILLS, C.LIC_START, C.LIC_END, C.CONTACT_NAME, C.MOBILE_NO, C.PHONE_NO, C.EMAIL_ID, C.EMIRATE_CODE, C.LAST_LOGIN, C.USERS, C.ENTRIES_TODAY, C.ENTRIES_30D, C.INSTALLER, C.NOTES, C.ACTIVE, C.LAST_SEEN, C.ENTRY_DATE,
  C.ADDRESS1, C.ADDRESS2, C.ADDRESS3, C.STATE_NAME, C.CITY, C.AREA, C.PIN_CODE, C.TRN_NO, C.INSTALL_DATE, C.BIRTH_DATE, C.INSTALL_AMT, C.CUST_TYPE, C.REF_BY, C.OLD_HDD, C.OLD_INSTALL_DATE, C.MAIN_PC_SERIAL, C.LAN_PC_SERIAL1, C.LAN_PC_SERIAL2, C.REMARK, C.VAT_ON,
  CASE WHEN C.LIC_END IS NULL THEN NULL ELSE DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), C.LIC_END) END AS LIC_DAYS,
  A.CONTRACT_ID AS AMC_ID, A.CONTRACT_NO AS AMC_NO, A.START_DATE AS AMC_START, A.END_DATE AS AMC_END, A.STATUS AS AMC_STATUS, A.AMOUNT AS AMC_AMT, CASE WHEN A.END_DATE IS NULL THEN NULL ELSE DATEDIFF(day, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE), A.END_DATE) END AS AMC_DAYS,
  (SELECT ISNULL(SUM(I.TOTAL), 0) FROM AMC_INVOICE I WHERE I.CUST_ID = C.CUST_ID AND I.STATUS <> 'CANCELLED') AS BILLED,
  (SELECT ISNULL(SUM(I.PAID), 0) FROM AMC_INVOICE I WHERE I.CUST_ID = C.CUST_ID AND I.STATUS <> 'CANCELLED') AS RECEIVED,
  (SELECT ISNULL(SUM(I.TOTAL - I.PAID), 0) FROM AMC_INVOICE I WHERE I.CUST_ID = C.CUST_ID AND I.STATUS <> 'CANCELLED') AS OUTSTANDING,
  (SELECT COUNT(*) FROM AMC_TICKET T WHERE T.CUST_ID = C.CUST_ID AND T.STATUS <> 'CLOSED') AS OPEN_TICKETS`;
export const CUST_FROM = `FROM AMC_CUSTOMER C LEFT JOIN AMC_SERVER S ON S.SERVER_ID = C.SERVER_ID
  OUTER APPLY (SELECT TOP 1 CONTRACT_ID, CONTRACT_NO, START_DATE, END_DATE, STATUS, AMOUNT FROM AMC_CONTRACT X WHERE X.CUST_ID = C.CUST_ID AND X.STATUS IN ('LIVE', 'EXPIRED', 'DRAFT') ORDER BY CASE X.STATUS WHEN 'LIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END, X.END_DATE DESC) A`;
const D = ['LIC_START', 'LIC_END', 'INSTALL_DATE', 'BIRTH_DATE', 'OLD_INSTALL_DATE', 'AMC_START', 'AMC_END'];
export const shape = (c) => { const o = { ...c, ACTIVE: !!c.ACTIVE, OFFLINE: !!c.OFFLINE, VAT_ON: !!c.VAT_ON }; for (const k of D) if (o[k]) o[k] = iso(o[k]); return o; };
export async function getParty(id) { const r = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${CUST_COLS} ${CUST_FROM} WHERE C.CUST_ID = @id`)).recordset[0]; return r ? shape(r) : null; }
export async function listParties({ q = '', plan = '', status = '', server = '', expiry = '', active = '1', installer = '' } = {}) {
  const where = [];
  if (q) where.push('(C.SHOP_CODE LIKE @q OR C.SHOP_NAME LIKE @q OR C.HDD LIKE @q OR C.CONTACT_NAME LIKE @q OR C.MOBILE_NO LIKE @q OR C.EMAIL_ID LIKE @q OR C.CITY LIKE @q)');
  if (plan) where.push('C.PLAN_CODE = @plan'); if (status) where.push('C.STATUS = @status'); if (server === 'none') where.push('C.SERVER_ID IS NULL'); else if (server) where.push('C.SERVER_ID = @server'); if (installer) where.push('C.INSTALLER = @inst');
  if (active === '1') where.push('C.ACTIVE = 1'); else if (active === '0') where.push('C.ACTIVE = 0');
  if (expiry === '30') where.push('C.LIC_END BETWEEN CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE) AND DATEADD(day, 30, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE))');
  else if (expiry === 'expired') where.push('C.LIC_END < CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE)'); else if (expiry === 'noamc') where.push('A.CONTRACT_NO IS NULL');
  else if (expiry === 'amc30') where.push("A.STATUS = 'LIVE' AND A.END_DATE BETWEEN CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE) AND DATEADD(day, 30, CAST(DATEADD(hour, 4, SYSUTCDATETIME()) AS DATE))");
  else if (expiry === 'offline') where.push('S.SERVER_ID IS NOT NULL AND (S.LAST_HEARTBEAT IS NULL OR S.LAST_HEARTBEAT < DATEADD(hour, -48, SYSUTCDATETIME()))');
  else if (expiry === 'due') where.push('(SELECT ISNULL(SUM(I.TOTAL - I.PAID), 0) FROM AMC_INVOICE I WHERE I.CUST_ID = C.CUST_ID AND I.STATUS <> \'CANCELLED\') > 0.004');
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${String(q).trim().slice(0, 100)}%`).input('plan', sql.VarChar(20), String(plan).toUpperCase()).input('status', sql.VarChar(10), String(status).toUpperCase()).input('server', sql.Int, Number(server) || 0).input('inst', sql.VarChar(10), String(installer).toUpperCase())
    .query(`SELECT ${CUST_COLS} ${CUST_FROM} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY C.ENTRY_DATE DESC`);
  return r.recordset.map(shape);
}
/** The next recognition code for a party typed here: DC + serial + W + version letter + installer initials (the ERP's own rule). */
export async function nextHdd(plan, installer) {
  const n = (await (await rq()).query("SELECT MAX(TRY_CAST(SUBSTRING(HDD, 3, 4) AS INT)) AS N FROM AMC_CUSTOMER WHERE HDD LIKE 'DC[0-9][0-9][0-9][0-9]%'")).recordset[0].N || 0;
  const ins = String(installer || 'DC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, 'C');
  return `DC${String(n + 1).padStart(4, '0')}W${PLAN_LETTER[String(plan || 'BASIC').toUpperCase()] || 'B'}${ins}`;
}
const str = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
const digits = (v, n) => { const d = String(v || '').replace(/\D/g, ''); return d ? d.slice(0, n) : null; };
const date = (v) => { if (!v) return null; const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw badRequest('Dates read 2026-10-01.', 'VALIDATION'); return s; };
const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
function read(b) {
  const name = str(b.SHOP_NAME, 150); if (!name) throw badRequest('Give the shop (AC) name.', 'VALIDATION');
  const plan = b.PLAN_CODE ? String(b.PLAN_CODE).toUpperCase() : null; if (plan && !PLANS.includes(plan)) throw badRequest('Software type is Basic, Pro, Advance or Enterprise.', 'VALIDATION');
  const type = String(b.CUST_TYPE || 'NEW').toUpperCase(); if (!CUST_TYPES.includes(type)) throw badRequest('Customer type is New, Existing or Converted.', 'VALIDATION');
  const status = String(b.STATUS || 'ACTIVE').toUpperCase(); if (!['ACTIVE', 'SUSPEND'].includes(status)) throw badRequest('Status is Active or Suspended.', 'VALIDATION');
  const install = date(b.INSTALL_DATE); const licStart = date(b.LIC_START) || install; const licEnd = date(b.LIC_END) || (licStart ? yearEnd(licStart) : null);
  return { name, plan, type, status, installer: str(b.INSTALLER, 10)?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null, contact: str(b.CONTACT_NAME, 100), mobile: digits(b.MOBILE_NO, 20), phone: digits(b.PHONE_NO, 20), email: str(b.EMAIL_ID, 150),
    address1: str(b.ADDRESS1, 150), address2: str(b.ADDRESS2, 150), address3: str(b.ADDRESS3, 150), state: str(b.STATE_NAME, 60), city: str(b.CITY, 60), area: str(b.AREA, 60), emirate: str(b.EMIRATE_CODE, 3)?.toUpperCase(), pin: str(b.PIN_CODE, 10), trn: digits(b.TRN_NO, 20),
    install, licStart, licEnd, birth: date(b.BIRTH_DATE), installAmt: money(b.INSTALL_AMT), amcAmt: b.AMC_AMT === '' || b.AMC_AMT == null ? null : money(b.AMC_AMT), vatOn: b.VAT_ON === true || b.VAT_ON === 'true' || b.VAT_ON === 1 || b.VAT_ON === '1', tills: b.TILLS === '' || b.TILLS == null ? 0 : Math.max(0, parseInt(b.TILLS, 10) || 0), refBy: str(b.REF_BY, 100), oldHdd: str(b.OLD_HDD, 20)?.toUpperCase(), oldInstall: date(b.OLD_INSTALL_DATE),
    pc1: str(b.MAIN_PC_SERIAL, 60), pc2: str(b.LAN_PC_SERIAL1, 60), pc3: str(b.LAN_PC_SERIAL2, 60), remark: str(b.REMARK, 500), notes: str(b.NOTES, 2000), hdd: str(b.HDD, 20)?.toUpperCase() || null, shopCode: str(b.SHOP_CODE, 20)?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null };
}
const bind = (r, d) => r.input('name', sql.NVarChar(150), d.name).input('plan', sql.VarChar(20), d.plan).input('type', sql.VarChar(12), d.type).input('st', sql.VarChar(10), d.status).input('ins', sql.VarChar(10), d.installer).input('cn', sql.NVarChar(100), d.contact).input('mo', sql.VarChar(20), d.mobile).input('ph', sql.VarChar(20), d.phone).input('em', sql.NVarChar(150), d.email)
  .input('a1', sql.NVarChar(150), d.address1).input('a2', sql.NVarChar(150), d.address2).input('a3', sql.NVarChar(150), d.address3).input('stn', sql.NVarChar(60), d.state).input('city', sql.NVarChar(60), d.city).input('area', sql.NVarChar(60), d.area).input('ec', sql.VarChar(3), d.emirate).input('pin', sql.VarChar(10), d.pin).input('trn', sql.VarChar(20), d.trn)
  .input('idt', sql.Date, d.install).input('ls', sql.Date, d.licStart).input('le', sql.Date, d.licEnd).input('bd', sql.Date, d.birth).input('ia', sql.Decimal(18, 2), d.installAmt).input('tills', sql.Int, d.tills).input('ref', sql.NVarChar(100), d.refBy).input('oh', sql.VarChar(20), d.oldHdd).input('oid', sql.Date, d.oldInstall)
  .input('pc1', sql.NVarChar(60), d.pc1).input('pc2', sql.NVarChar(60), d.pc2).input('pc3', sql.NVarChar(60), d.pc3).input('rm', sql.NVarChar(500), d.remark).input('nt', sql.NVarChar(2000), d.notes).input('hdd', sql.VarChar(20), d.hdd).input('code', sql.VarChar(20), d.shopCode).input('vat', sql.Bit, d.vatOn);
const SET = 'SHOP_NAME = @name, PLAN_CODE = @plan, CUST_TYPE = @type, STATUS = @st, INSTALLER = @ins, CONTACT_NAME = @cn, MOBILE_NO = @mo, PHONE_NO = @ph, EMAIL_ID = @em, ADDRESS1 = @a1, ADDRESS2 = @a2, ADDRESS3 = @a3, STATE_NAME = @stn, CITY = @city, AREA = @area, EMIRATE_CODE = @ec, PIN_CODE = @pin, TRN_NO = @trn, INSTALL_DATE = @idt, LIC_START = @ls, LIC_END = @le, BIRTH_DATE = @bd, INSTALL_AMT = @ia, TILLS = @tills, REF_BY = @ref, OLD_HDD = @oh, OLD_INSTALL_DATE = @oid, MAIN_PC_SERIAL = @pc1, LAN_PC_SERIAL1 = @pc2, LAN_PC_SERIAL2 = @pc3, REMARK = @rm, NOTES = @nt, HDD = @hdd, SHOP_CODE = @code, VAT_ON = @vat, EDIT_DATE = SYSUTCDATETIME()';
/** A shop code for a party typed here: letters and digits of the name, made unique. */
async function freeShopCode(want, name, exceptId = 0) {
  const base = (want || String(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14) || 'SHOP');
  for (let i = 0; i < 50; i++) { const code = i ? `${base}${i + 1}` : base; const hit = (await (await rq()).input('c', sql.VarChar(20), code).input('id', sql.Int, exceptId).query('SELECT 1 FROM AMC_CUSTOMER WHERE SHOP_CODE = @c AND CUST_ID <> @id')).recordset[0]; if (!hit) return code; if (want) throw new HttpError(409, `Shop ID ${want} is already used.`, 'DUPLICATE'); }
  throw badRequest('Could not make a free shop code — type one.');
}
async function hddFree(hdd, exceptId) { if (!hdd) return; const hit = (await (await rq()).input('h', sql.VarChar(20), hdd).input('id', sql.Int, exceptId).query('SELECT SHOP_NAME FROM AMC_CUSTOMER WHERE HDD = @h AND CUST_ID <> @id')).recordset[0]; if (hit) throw new HttpError(409, `Code ${hdd} already belongs to ${hit.SHOP_NAME}.`, 'DUPLICATE'); }
/** Set an invoice to a new amount (no money received yet), or cancel it when the amount is 0. */
async function reprice(ctx, inv, amount, vatPrc = 0) {
  const vatWant = Math.round(amount * vatPrc) / 100;
  if (Math.abs(Number(inv.TOTAL) - (amount + vatWant)) < 0.005 && Math.abs(Number(inv.VAT_AMT) - vatWant) < 0.005) return;
  if (Number(inv.PAID) > 0) throw new HttpError(409, `Money was already received against ${inv.INV_NO} — cancel that receipt before changing the amount.`, 'PAID');
  if (amount <= 0) { await (await rq()).input('id', sql.Int, inv.INV_ID).query("UPDATE AMC_INVOICE SET STATUS = 'CANCELLED', EDIT_DATE = SYSUTCDATETIME() WHERE INV_ID = @id"); await audit(ctx, 'AMC_INVOICE', inv.INV_NO, 'CANCEL', { reason: 'amount cleared on the party' }); return; }
  const vat = vatWant;
  await (await rq()).input('id', sql.Int, inv.INV_ID).input('a', sql.Decimal(18, 2), amount).input('vp', sql.Decimal(5, 2), vatPrc).input('va', sql.Decimal(18, 2), vat).input('t', sql.Decimal(18, 2), Math.round((amount + vat) * 100) / 100)
    .query('UPDATE AMC_INVOICE SET AMOUNT = @a, VAT_PRC = @vp, VAT_AMT = @va, TOTAL = @t, EDIT_DATE = SYSUTCDATETIME() WHERE INV_ID = @id');
  await audit(ctx, 'AMC_INVOICE', inv.INV_NO, 'REPRICE', { from: inv.TOTAL, to: amount + vat });
}
/**
 * After a save: the installation bill and the AMC of the current year follow the amounts typed on the party.
 *   Installation amount → one INSTALL invoice (made, re-priced while unpaid, cancelled when cleared).
 *   AMC amount → the AMC for the year that starts on the AMC start date: made live with its invoice, or re-priced while unpaid.
 *   Software type moved up → the convert amount as an UPGRADE invoice.
 */
async function afterSave(ctx, id, d, prevPlan, prevAmc = null, prevVat = null) {
  const p = await getParty(id); const rate = d.vatOn ? Number(await getSetting('VAT_RATE')) || 0 : 0; const vatChanged = prevVat != null && !!prevVat !== d.vatOn;
  const inst = (await (await rq()).input('id', sql.Int, id).query("SELECT TOP 1 INV_ID, INV_NO, TOTAL, VAT_AMT, PAID FROM AMC_INVOICE WHERE CUST_ID = @id AND KIND = 'INSTALL' AND STATUS <> 'CANCELLED' ORDER BY INV_ID")).recordset[0];
  if (inst) await reprice(ctx, inst, d.installAmt, rate);
  else if (d.installAmt > 0) await raiseInvoice(ctx, { custId: id, kind: 'INSTALL', amount: d.installAmt, invDate: d.install || today(), description: `Software installation — ${p.PLAN_CODE || 'DataCare ERP'}`, vat: d.vatOn });
  if (d.amcAmt != null && (prevAmc == null || vatChanged || Math.abs(Number(prevAmc) - d.amcAmt) >= 0.005)) {   /* only when the AMC amount was actually typed or changed */
    const start = p.LIC_START || p.INSTALL_DATE;
    if (!start && d.amcAmt > 0) throw badRequest('Give the installation / AMC start date before the AMC amount.', 'VALIDATION');
    const k = start ? (await (await rq()).input('id', sql.Int, id).input('s', sql.Date, start).query("SELECT TOP 1 K.CONTRACT_ID, K.CONTRACT_NO, K.AMOUNT, K.STATUS, I.INV_ID, I.INV_NO, I.TOTAL, I.VAT_AMT, I.PAID FROM AMC_CONTRACT K LEFT JOIN AMC_INVOICE I ON I.CONTRACT_ID = K.CONTRACT_ID AND I.STATUS <> 'CANCELLED' WHERE K.CUST_ID = @id AND K.STATUS IN ('LIVE', 'DRAFT', 'EXPIRED') AND K.START_DATE <= @s AND K.END_DATE >= @s ORDER BY K.CONTRACT_ID DESC")).recordset[0] : null;
    const { createContract, setStatus } = await import('./contractService.js');
    if (!k && d.amcAmt > 0) await createContract(ctx, { CUST_ID: id, START_DATE: start, END_DATE: yearEnd(start), AMOUNT: d.amcAmt, VAT_PRC: rate, PLAN_CODE: p.PLAN_CODE, TILLS: p.TILLS || null, STATUS: 'LIVE' });
    else if (k && (vatChanged || Math.abs(Number(k.AMOUNT) - d.amcAmt) >= 0.005)) {
      if (k.INV_ID && Number(k.PAID) > 0) throw new HttpError(409, `Money was already received against ${k.INV_NO} for ${k.CONTRACT_NO} — cancel that receipt before changing the AMC amount.`, 'PAID');
      if (d.amcAmt <= 0) { await setStatus(ctx, k.CONTRACT_ID, 'CANCELLED'); }
      else {
        const vatPrc = rate; const vat = Math.round(d.amcAmt * vatPrc) / 100;
        await (await rq()).input('id', sql.Int, k.CONTRACT_ID).input('a', sql.Decimal(18, 2), d.amcAmt).input('vp', sql.Decimal(5, 2), vatPrc).input('va', sql.Decimal(18, 2), vat).input('t', sql.Decimal(18, 2), Math.round((d.amcAmt + vat) * 100) / 100).query('UPDATE AMC_CONTRACT SET AMOUNT = @a, VAT_PRC = @vp, VAT_AMT = @va, TOTAL = @t, EDIT_DATE = SYSUTCDATETIME() WHERE CONTRACT_ID = @id');
        await audit(ctx, 'AMC_CONTRACT', k.CONTRACT_NO, 'REPRICE', { from: k.AMOUNT, to: d.amcAmt });
        if (k.INV_ID) await reprice(ctx, { INV_ID: k.INV_ID, INV_NO: k.INV_NO, TOTAL: k.TOTAL, VAT_AMT: k.VAT_AMT, PAID: k.PAID }, d.amcAmt, rate);
        if (k.STATUS === 'DRAFT') await setStatus(ctx, k.CONTRACT_ID, 'LIVE');
      }
    }
  }
  if (d.plan && prevPlan && d.plan !== prevPlan) {
    const prices = await getSetting('PRICES'); const diff = money((Number(prices[d.plan]) || 0) - (Number(prices[prevPlan]) || 0));
    let invId = null; if (diff > 0) invId = (await raiseInvoice(ctx, { custId: id, kind: 'UPGRADE', amount: diff, invDate: today(), description: `Software upgrade ${prevPlan} → ${d.plan} (convert amount)`, vat: d.vatOn })).INV_ID;
    await (await rq()).input('c', sql.Int, id).input('f', sql.VarChar(20), prevPlan).input('t', sql.VarChar(20), d.plan).input('d', sql.Date, today()).input('a', sql.Decimal(18, 2), Math.max(0, diff)).input('i', sql.Int, invId).input('u', sql.Int, ctx.userId)
      .query('INSERT INTO AMC_PLAN_CHANGE (CUST_ID, FROM_PLAN, TO_PLAN, CHANGE_DATE, AMOUNT, INV_ID, USER_ID) VALUES (@c, @f, @t, @d, @a, @i, @u)');
    if (p.HDD && /^[A-Z]{2}\d{4}[A-Z]{2}[A-Z]{2}$/.test(p.HDD)) await (await rq()).input('id', sql.Int, id).input('h', sql.VarChar(20), `${p.HDD.slice(0, 7)}${PLAN_LETTER[d.plan]}${p.HDD.slice(8)}`).query('UPDATE AMC_CUSTOMER SET HDD = @h WHERE CUST_ID = @id AND NOT EXISTS (SELECT 1 FROM AMC_CUSTOMER X WHERE X.HDD = @h AND X.CUST_ID <> @id)');
  }
}
export async function createParty(ctx, b) {
  const d = read(b); d.shopCode = await freeShopCode(d.shopCode, d.name); if (!d.hdd) d.hdd = await nextHdd(d.plan, d.installer); await hddFree(d.hdd, 0);
  const q = await bind((await rq()), d).input('src', sql.VarChar(10), 'MANUAL').query(`INSERT INTO AMC_CUSTOMER (SOURCE, SHOP_NAME, PLAN_CODE, CUST_TYPE, STATUS, INSTALLER, CONTACT_NAME, MOBILE_NO, PHONE_NO, EMAIL_ID, ADDRESS1, ADDRESS2, ADDRESS3, STATE_NAME, CITY, AREA, EMIRATE_CODE, PIN_CODE, TRN_NO, INSTALL_DATE, LIC_START, LIC_END, BIRTH_DATE, INSTALL_AMT, TILLS, REF_BY, OLD_HDD, OLD_INSTALL_DATE, MAIN_PC_SERIAL, LAN_PC_SERIAL1, LAN_PC_SERIAL2, REMARK, NOTES, HDD, SHOP_CODE, VAT_ON)
    OUTPUT inserted.CUST_ID VALUES (@src, @name, @plan, @type, @st, @ins, @cn, @mo, @ph, @em, @a1, @a2, @a3, @stn, @city, @area, @ec, @pin, @trn, @idt, @ls, @le, @bd, @ia, @tills, @ref, @oh, @oid, @pc1, @pc2, @pc3, @rm, @nt, @hdd, @code, @vat)`);
  const id = q.recordset[0].CUST_ID; await audit(ctx, 'AMC_CUSTOMER', id, 'CREATE', { name: d.name, hdd: d.hdd, plan: d.plan, installAmt: d.installAmt });
  await afterSave(ctx, id, d, null); return getParty(id);
}
export async function updateParty(ctx, id, b) {
  const cur = await getParty(id); if (!cur) throw notFound('Party not found');
  const d = read({ ...cur, ...b }); d.shopCode = d.shopCode === cur.SHOP_CODE ? cur.SHOP_CODE : await freeShopCode(d.shopCode, d.name, id); if (d.hdd !== cur.HDD) await hddFree(d.hdd, id);
  if (b.ACTIVE !== undefined) await (await rq()).input('id', sql.Int, id).input('a', sql.Bit, !!b.ACTIVE).query('UPDATE AMC_CUSTOMER SET ACTIVE = @a WHERE CUST_ID = @id');
  await bind((await rq()).input('id', sql.Int, id), d).query(`UPDATE AMC_CUSTOMER SET ${SET} WHERE CUST_ID = @id`);
  await audit(ctx, 'AMC_CUSTOMER', id, 'UPDATE', { name: d.name, plan: d.plan, from: cur.PLAN_CODE, installAmt: d.installAmt, active: b.ACTIVE });
  await afterSave(ctx, id, d, cur.PLAN_CODE, cur.AMC_AMT, cur.VAT_ON); return getParty(id);
}
/** Delete only a party with nothing on record; otherwise switch it off (ACTIVE = 0) so the history stays. */
export async function deleteParty(ctx, id) {
  const cur = await getParty(id); if (!cur) throw notFound('Party not found');
  const used = (await (await rq()).input('id', sql.Int, id).query('SELECT (SELECT COUNT(*) FROM AMC_CONTRACT WHERE CUST_ID = @id) + (SELECT COUNT(*) FROM AMC_INVOICE WHERE CUST_ID = @id) + (SELECT COUNT(*) FROM AMC_TICKET WHERE CUST_ID = @id) + (SELECT COUNT(*) FROM AMC_VISIT WHERE CUST_ID = @id) AS N')).recordset[0].N;
  if (used || cur.SOURCE === 'ERP') { await (await rq()).input('id', sql.Int, id).query('UPDATE AMC_CUSTOMER SET ACTIVE = 0, EDIT_DATE = SYSUTCDATETIME() WHERE CUST_ID = @id'); await audit(ctx, 'AMC_CUSTOMER', id, 'DEACTIVATE', { name: cur.SHOP_NAME }); return { deleted: false }; }
  await (await rq()).input('id', sql.Int, id).query('DELETE FROM AMC_PLAN_CHANGE WHERE CUST_ID = @id; DELETE FROM AMC_CUSTOMER WHERE CUST_ID = @id'); await audit(ctx, 'AMC_CUSTOMER', id, 'DELETE', { name: cur.SHOP_NAME }); return { deleted: true };
}
export async function planChanges(id) { return (await (await rq()).input('id', sql.Int, id).query('SELECT P.CHANGE_ID, P.FROM_PLAN, P.TO_PLAN, P.CHANGE_DATE, P.AMOUNT, I.INV_NO, I.STATUS AS INV_STATUS, U.USER_NAME FROM AMC_PLAN_CHANGE P LEFT JOIN AMC_INVOICE I ON I.INV_ID = P.INV_ID LEFT JOIN AMC_USER U ON U.USER_ID = P.USER_ID WHERE P.CUST_ID = @id ORDER BY P.CHANGE_ID')).recordset.map((x) => ({ ...x, CHANGE_DATE: iso(x.CHANGE_DATE) })); }
