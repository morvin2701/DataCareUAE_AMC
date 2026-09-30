/** Dates as the business says them: Dubai days, a licence / AMC year is exactly 365 days. */
export const TZ = 'Asia/Dubai';
export const LICENCE_DAYS = 365;
const DXB = 4 * 3600e3;   // UAE has no daylight saving
/** Today in Dubai as YYYY-MM-DD. */
export const today = (d = new Date()) => new Date(d.getTime() + DXB).toISOString().slice(0, 10);
export const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
export const addDays = (d, n) => { const x = new Date(`${iso(d)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((new Date(`${iso(b)}T00:00:00Z`) - new Date(`${iso(a)}T00:00:00Z`)) / 86400e3);
/** A renewal starts the day after the previous AMC ends. */
export const renewalStart = (previousEnd) => addDays(previousEnd, 1);
/** One year, the last day included: the same date next year, minus a day — 22/09/2026 → 21/09/2027, 22/09/2027 → 21/09/2028. */
export const yearEnd = (start) => { const x = new Date(`${iso(start)}T00:00:00Z`); x.setUTCFullYear(x.getUTCFullYear() + 1); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
/** dd/mm/yyyy for messages and prints. */
export const ddmmyyyy = (d) => (d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso(d) + 'T00:00:00Z')) : '');
export const money = (n) => (Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
