import { rq, sql } from '../config/db.js';
import { getSetting } from './settingsService.js';
/** Running numbers: prefix from Settings → Numbering, 5 digits, never reused (MAX + 1 over the table; a clash on insert is retried by the caller). */
const TABLES = { CONTRACT: ['AMC_CONTRACT', 'CONTRACT_NO'], INVOICE: ['AMC_INVOICE', 'INV_NO'], RECEIPT: ['AMC_PAYMENT', 'RCPT_NO'], TICKET: ['AMC_TICKET', 'TICKET_NO'] };
export async function nextNo(kind) {
  const n = await getSetting('NUMBERING'); const prefix = String(n[kind] ?? '').slice(0, 10); const width = Math.max(3, Math.min(8, Number(n.WIDTH) || 5));
  const [table, col] = TABLES[kind];
  const r = await (await rq()).input('p', sql.VarChar(10), prefix).input('len', sql.Int, prefix.length).query(`SELECT MAX(TRY_CAST(SUBSTRING(${col}, @len + 1, 20) AS INT)) AS N FROM ${table} WHERE LEFT(${col}, @len) = @p`);
  return `${prefix}${String((Number(r.recordset[0]?.N) || 0) + 1).padStart(width, '0')}`;
}
/** Run an insert that needs a fresh number; on a duplicate-key clash take the next number and try again. */
export async function withNo(kind, fn) {
  for (let i = 0; i < 5; i++) { const no = await nextNo(kind); try { return await fn(no); } catch (e) { const n = Number(e?.number || e?.originalError?.info?.number); if (n !== 2627 && n !== 2601) throw e; } }
  throw new Error(`Could not take a free ${kind.toLowerCase()} number.`);
}
