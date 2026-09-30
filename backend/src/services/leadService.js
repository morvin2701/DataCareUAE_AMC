import { rq, sql } from '../config/db.js';
import { notFound, badRequest } from '../utils/httpError.js';
import { audit } from './audit.js';
import { createParty } from './partyService.js';

/** Leads and follow-ups — a small CRM. A lead moves NEW → CONTACTED → DEMO → PROPOSAL → WON / LOST; each follow-up is a note with the next date. Won makes the party. */
export const STAGES = ['NEW', 'CONTACTED', 'DEMO', 'PROPOSAL', 'WON', 'LOST'];
const COLS = 'L.LEAD_ID, L.NAME, L.CONTACT_NAME, L.MOBILE_NO, L.EMAIL_ID, L.CITY, L.EMIRATE_CODE, L.SOURCE, L.PLAN_CODE, L.STAGE, L.OWNER_ID, O.USER_NAME AS OWNER_NAME, L.NEXT_FOLLOW, L.EST_AMT, L.NOTES, L.CUST_ID, L.USER_ID, U.USER_NAME AS ADDED_BY, L.ENTRY_DATE, L.EDIT_DATE, (SELECT COUNT(*) FROM AMC_LEAD_NOTE N WHERE N.LEAD_ID = L.LEAD_ID) AS FOLLOWUPS, (SELECT MAX(N.ENTRY_DATE) FROM AMC_LEAD_NOTE N WHERE N.LEAD_ID = L.LEAD_ID) AS LAST_FOLLOW, CASE WHEN L.STAGE NOT IN (\'WON\', \'LOST\') AND L.NEXT_FOLLOW < SYSUTCDATETIME() THEN 1 ELSE 0 END AS OVERDUE';
const FROM = 'FROM AMC_LEAD L LEFT JOIN AMC_USER O ON O.USER_ID = L.OWNER_ID LEFT JOIN AMC_USER U ON U.USER_ID = L.USER_ID';
const shape = (l) => ({ ...l, OVERDUE: !!l.OVERDUE });
export async function getLead(id) { const l = (await (await rq()).input('id', sql.Int, id).query(`SELECT ${COLS} ${FROM} WHERE L.LEAD_ID = @id`)).recordset[0]; if (!l) return null; const notes = (await (await rq()).input('id', sql.Int, id).query('SELECT N.NOTE_ID, N.USER_ID, U.USER_NAME, N.NOTE, N.STAGE, N.NEXT_FOLLOW, N.ENTRY_DATE FROM AMC_LEAD_NOTE N LEFT JOIN AMC_USER U ON U.USER_ID = N.USER_ID WHERE N.LEAD_ID = @id ORDER BY N.NOTE_ID DESC')).recordset; return { ...shape(l), notes }; }
export async function listLeads({ q = '', stage = '', owner = '', open = '' } = {}) {
  const where = ['1 = 1']; if (q) where.push('(L.NAME LIKE @q OR L.CONTACT_NAME LIKE @q OR L.MOBILE_NO LIKE @q OR L.CITY LIKE @q OR L.SOURCE LIKE @q)'); if (stage) where.push('L.STAGE = @stage'); else if (open === '1') where.push("L.STAGE NOT IN ('WON', 'LOST')"); if (owner) where.push('L.OWNER_ID = @owner');
  const r = await (await rq()).input('q', sql.NVarChar(120), `%${q}%`).input('stage', sql.VarChar(12), String(stage).toUpperCase()).input('owner', sql.Int, Number(owner) || 0).query(`SELECT ${COLS} ${FROM} WHERE ${where.join(' AND ')} ORDER BY CASE WHEN L.STAGE IN ('WON', 'LOST') THEN 1 ELSE 0 END, CASE WHEN L.NEXT_FOLLOW IS NULL THEN 1 ELSE 0 END, L.NEXT_FOLLOW, L.LEAD_ID DESC`);
  return r.recordset.map(shape);
}
const str = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
const dt = (v) => { if (!v) return null; const d = new Date(v); if (Number.isNaN(d.getTime())) throw badRequest('The follow-up date/time is not readable.', 'VALIDATION'); return d; };
function read(b) {
  const name = str(b.NAME, 150); if (!name) throw badRequest('Give the shop or person a name.', 'VALIDATION');
  const stage = String(b.STAGE || 'NEW').toUpperCase(); if (!STAGES.includes(stage)) throw badRequest('Stage is new, contacted, demo, proposal, won or lost.', 'VALIDATION');
  return { name, contact: str(b.CONTACT_NAME, 100), mobile: String(b.MOBILE_NO || '').replace(/\D/g, '').slice(0, 20) || null, email: str(b.EMAIL_ID, 150), city: str(b.CITY, 60), emirate: str(b.EMIRATE_CODE, 3)?.toUpperCase(), source: str(b.SOURCE, 60), plan: str(b.PLAN_CODE, 20)?.toUpperCase(), stage, owner: b.OWNER_ID ? Number(b.OWNER_ID) : null, next: dt(b.NEXT_FOLLOW), est: Math.round((Number(b.EST_AMT) || 0) * 100) / 100, notes: str(b.NOTES, 2000) };
}
const bind = (r, d) => r.input('n', sql.NVarChar(150), d.name).input('cn', sql.NVarChar(100), d.contact).input('mo', sql.VarChar(20), d.mobile).input('em', sql.NVarChar(150), d.email).input('city', sql.NVarChar(60), d.city).input('ec', sql.VarChar(3), d.emirate).input('src', sql.NVarChar(60), d.source).input('pl', sql.VarChar(20), d.plan).input('st', sql.VarChar(12), d.stage).input('ow', sql.Int, d.owner).input('nf', sql.DateTime2, d.next).input('est', sql.Decimal(18, 2), d.est).input('nt', sql.NVarChar(2000), d.notes);
export async function createLead(ctx, b) {
  const d = read(b);
  const q = await bind((await rq()).input('u', sql.Int, ctx.userId), d).query('INSERT INTO AMC_LEAD (NAME, CONTACT_NAME, MOBILE_NO, EMAIL_ID, CITY, EMIRATE_CODE, SOURCE, PLAN_CODE, STAGE, OWNER_ID, NEXT_FOLLOW, EST_AMT, NOTES, USER_ID) OUTPUT inserted.LEAD_ID VALUES (@n, @cn, @mo, @em, @city, @ec, @src, @pl, @st, @ow, @nf, @est, @nt, @u)');
  await audit(ctx, 'AMC_LEAD', q.recordset[0].LEAD_ID, 'CREATE', { name: d.name, stage: d.stage }); return getLead(q.recordset[0].LEAD_ID);
}
export async function updateLead(ctx, id, b) {
  const cur = await getLead(id); if (!cur) throw notFound('Lead not found'); const d = read({ ...cur, ...b });
  await bind((await rq()).input('id', sql.Int, id), d).query('UPDATE AMC_LEAD SET NAME = @n, CONTACT_NAME = @cn, MOBILE_NO = @mo, EMAIL_ID = @em, CITY = @city, EMIRATE_CODE = @ec, SOURCE = @src, PLAN_CODE = @pl, STAGE = @st, OWNER_ID = @ow, NEXT_FOLLOW = @nf, EST_AMT = @est, NOTES = @nt, EDIT_DATE = SYSUTCDATETIME() WHERE LEAD_ID = @id');
  if (d.stage !== cur.STAGE) await (await rq()).input('l', sql.Int, id).input('u', sql.Int, ctx.userId).input('n', sql.NVarChar(2000), `Stage ${cur.STAGE} → ${d.stage}`).input('s', sql.VarChar(12), d.stage).query('INSERT INTO AMC_LEAD_NOTE (LEAD_ID, USER_ID, NOTE, STAGE) VALUES (@l, @u, @n, @s)');
  await audit(ctx, 'AMC_LEAD', id, 'UPDATE', { stage: d.stage, next: d.next }); return getLead(id);
}
/** A follow-up: what happened, the stage now, and when to call next. */
export async function addFollowUp(ctx, id, { NOTE, STAGE, NEXT_FOLLOW }) {
  const cur = await getLead(id); if (!cur) throw notFound('Lead not found'); const note = str(NOTE, 2000); if (!note) throw badRequest('Type what happened.', 'VALIDATION');
  const stage = STAGE ? String(STAGE).toUpperCase() : cur.STAGE; if (!STAGES.includes(stage)) throw badRequest('Bad stage.', 'VALIDATION'); const next = dt(NEXT_FOLLOW);
  await (await rq()).input('l', sql.Int, id).input('u', sql.Int, ctx.userId).input('n', sql.NVarChar(2000), note).input('s', sql.VarChar(12), stage).input('nf', sql.DateTime2, next).query('INSERT INTO AMC_LEAD_NOTE (LEAD_ID, USER_ID, NOTE, STAGE, NEXT_FOLLOW) VALUES (@l, @u, @n, @s, @nf); UPDATE AMC_LEAD SET STAGE = @s, NEXT_FOLLOW = @nf, EDIT_DATE = SYSUTCDATETIME() WHERE LEAD_ID = @l');
  await audit(ctx, 'AMC_LEAD_NOTE', id, 'CREATE', { stage, next }); return getLead(id);
}
/** Won → a party in Party master with what the lead knew; the lead keeps the CUST_ID. */
export async function convertLead(ctx, id, extra = {}) {
  const l = await getLead(id); if (!l) throw notFound('Lead not found'); if (l.CUST_ID) return { lead: l, customer: null };
  const c = await createParty(ctx, { SHOP_NAME: l.NAME, CONTACT_NAME: l.CONTACT_NAME, MOBILE_NO: l.MOBILE_NO, EMAIL_ID: l.EMAIL_ID, CITY: l.CITY, EMIRATE_CODE: l.EMIRATE_CODE, PLAN_CODE: l.PLAN_CODE, REF_BY: l.SOURCE, CUST_TYPE: 'NEW', NOTES: l.NOTES, INSTALL_DATE: new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), OWNER: undefined, ...extra });
  await (await rq()).input('id', sql.Int, id).input('c', sql.Int, c.CUST_ID).query("UPDATE AMC_LEAD SET STAGE = 'WON', CUST_ID = @c, EDIT_DATE = SYSUTCDATETIME() WHERE LEAD_ID = @id");
  await audit(ctx, 'AMC_LEAD', id, 'WON', { cust: c.CUST_ID }); return { lead: await getLead(id), customer: c };
}
export async function deleteLead(ctx, id) { await (await rq()).input('id', sql.Int, id).query('DELETE FROM AMC_LEAD_NOTE WHERE LEAD_ID = @id; DELETE FROM AMC_LEAD WHERE LEAD_ID = @id'); await audit(ctx, 'AMC_LEAD', id, 'DELETE'); }
