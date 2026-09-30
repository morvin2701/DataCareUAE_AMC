/** AED, dd/mm/yyyy, Dubai — the house style. */
const nf2 = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = (v) => nf2.format(Number(v) || 0);
export const formatAED = (v) => `AED ${nf2.format(Number(v) || 0)}`;
export const formatDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(d).length === 10 ? `${d}T00:00:00Z` : d)) : '');
export const formatDateTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(new Date(d)) : '');
export const isoDate = (d) => (d ? String(d).slice(0, 10) : '');
const DXB = 4 * 3600e3;
export const today = () => new Date(Date.now() + DXB).toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(`${isoDate(d)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysLeft = (d) => (d ? Math.round((new Date(`${isoDate(d)}T00:00:00Z`) - new Date(`${today()}T00:00:00Z`)) / 86400e3) : null);
export const rel = (iso) => { if (!iso) return 'never'; const s = (Date.now() - new Date(iso)) / 1000; if (s < 90) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; if (s < 86400 * 14) return `${Math.floor(s / 86400)} d ago`; return formatDate(iso); };
export const displayMobile = (v) => { const d = String(v || '').replace(/\D/g, ''); const m = /^971(\d{2})(\d{3})(\d{4})$/.exec(d); return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : d ? `+${d}` : ''; };
export const initials = (n) => (n || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
/** Amount in words for the tax invoice. */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const w999 = (n) => (n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : '') + (n % 100 < 20 ? ones[n % 100] : `${tens[Math.floor((n % 100) / 10)]}${n % 10 ? '-' + ones[n % 10] : ''}`);
const wInt = (n) => { if (n === 0) return 'Zero'; const parts = []; for (const [nm, v] of [['Million', 1e6], ['Thousand', 1e3]]) if (n >= v) { parts.push(`${w999(Math.floor(n / v))} ${nm}`); n %= v; } if (n) parts.push(w999(n)); return parts.join(' '); };
export const amountWords = (amt) => { const a = Math.abs(Number(amt) || 0); const d = Math.floor(a), f = Math.round((a - d) * 100); return `${wInt(d)} Dirham${d === 1 ? '' : 's'}${f ? ` and ${wInt(f)} Fils` : ''} only`; };
/** CSV download of a rows × columns table. */
export function downloadCsv(name, columns, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(typeof c.csv === 'function' ? c.csv(r) : r[c.key])).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = `${name}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
