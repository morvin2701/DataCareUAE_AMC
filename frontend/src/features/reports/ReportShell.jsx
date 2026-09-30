import { useState } from 'react';
import { Printer, Download, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { RouteProgress } from '../../components/ui/Loading.jsx';
import { kb } from '../../lib/platform.js';
import { downloadCsv, formatDate, today, addDays } from '../../lib/fmt.js';
/** Common frame for every report: title row (CSV · print), filter bar, KPI strip, the table. Only .print-page prints. */
export function ReportShell({ title, subtitle, filters, kpis, columns, rows, loading, error, csvName, periodText, children, footer, rowKey = 'id', onRow }) {
  return <div className="print-page flex w-full flex-col gap-3">
    <div className="no-print flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h1 className="font-display text-[20px] font-bold leading-tight">{title}</h1>{subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}</div><div className="flex items-center gap-1.5">{columns && <Button variant="ghost" className="!h-8 !px-2.5 !text-[12.5px]" icon={Download} onClick={() => downloadCsv(csvName || title, columns.filter((c) => c.label), rows || [])} disabled={!rows?.length}>CSV</Button>}<Button className="!h-8 !px-3 !text-[12.5px]" icon={Printer} onClick={() => window.print()} title={`Print (${kb('P')})`}>Print</Button></div></div>
    {filters && <div className="no-print card rpt-filters flex flex-wrap items-end gap-x-4 gap-y-3 px-3 py-2.5">{filters}</div>}
    {error && <div className="no-print flex items-start gap-2 rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-[13px] normal-case"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />{error.message || String(error)}</div>}
    <div className="print-only mb-1 border-b border-neutral-800 pb-2"><div className="text-[15px] font-bold">DataCare Softech FZCO · DcAMC</div><div className="flex justify-between text-[12px]"><span>{title}</span><span>{periodText || formatDate(today())}</span></div></div>
    <div className="relative -mt-1 mb-1 h-[2px]"><RouteProgress active={!!loading} /></div>
    {kpis && <div className={`grid grid-cols-2 gap-2 ${kpis.length >= 4 ? 'lg:grid-cols-4' : kpis.length === 3 ? 'md:grid-cols-3' : ''}`}>{kpis.map(([l, v, tone], i) => <div key={i} className="kpi !p-3"><div className="text-[11.5px] uppercase tracking-wide text-muted">{l}</div><div className={`num mt-0.5 text-[15px] font-semibold sm:text-[17px] ${tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : tone === 'ok' ? 'text-ok' : ''}`}>{v}</div></div>)}</div>}
    {columns && <div className="rpt"><div className="rpt-scroll"><table><thead><tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : ''}>{c.label}</th>)}</tr></thead>
      <tbody>{(rows || []).map((r, i) => <tr key={typeof rowKey === 'function' ? rowKey(r, i) : r[rowKey] ?? i} className={onRow ? 'click' : ''} onClick={() => onRow?.(r)}>{columns.map((c) => <td key={c.key} className={`${c.align === 'right' ? 'r num' : c.align === 'center' ? 'c' : ''} ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}{!loading && !(rows || []).length && <tr><td colSpan={columns.length} className="py-8 text-center text-faint">Nothing to show</td></tr>}</tbody>
      {footer && <tfoot><tr>{footer}</tr></tfoot>}</table></div></div>}
    {children}
  </div>;
}
export function Filter({ label, children, className = '' }) { return <div className={`flex flex-col gap-1 ${className}`}><span className="vlabel leading-none">{label}</span>{children}</div>; }
export function DateFilter({ label, value, onChange }) { return <Filter label={label}><input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input !h-8 w-[150px] !px-2.5 !text-[13px]" /></Filter>; }
export const periodLabel = (from, to) => `${formatDate(from)} – ${formatDate(to)}`;
export const startOfMonth = () => `${today().slice(0, 7)}-01`;
export const startOfYear = () => `${today().slice(0, 4)}-01-01`;
export { today, addDays };
