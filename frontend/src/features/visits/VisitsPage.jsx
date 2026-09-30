import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Calendar, LayoutList, MapPin, CheckCircle2, Trash2 } from 'lucide-react';
import { visitService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useRights } from '../../app/AuthContext.jsx';
import { PageHeader, Badge, Kpi, ErrorBox, Segmented, ConfirmDialog } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { VisitDialog, VSTATUS } from './VisitDialog.jsx';
import { useTeam } from '../tickets/TicketDialogs.jsx';
import { formatDate, today, initials } from '../../lib/fmt.js';
export const VTONE = { PLANNED: 'info', DONE: 'ok', CANCELLED: 'muted' };
const monthOf = (d) => d.slice(0, 7);
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); const from = `${ym}-01`; const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return { from, to }; };
const shift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
/** Visits: month calendar or list, by engineer; new from a ticket (?new=cust&ticket=) or standalone. */
export function VisitsPage() {
  const { support } = useRights(); const team = useTeam(); const nav = useNavigate(); const toast = useToast(); const [sp, setSp] = useSearchParams();
  const [ym, setYm] = useState(monthOf(today())); const [view, setView] = useState(() => localStorage.getItem('dcamc.visits.view') || 'calendar'); const [eng, setEng] = useState(''); const [status, setStatus] = useState('');
  const [dlg, setDlg] = useState(sp.get('new') ? { custId: Number(sp.get('new')), ticketId: sp.get('ticket') ? Number(sp.get('ticket')) : null } : null); const [ask, setAsk] = useState(null);
  const range = monthRange(ym); const list = useQuery(() => visitService.list({ ...(view === 'calendar' ? range : {}), engineer: eng, status }), [ym, view, eng, status]); const rows = list.data?.rows || [];
  useHotkeys({ 'alt+n': () => support && setDlg({}), 'alt+arrowleft': () => setYm((m) => shift(m, -1)), 'alt+arrowright': () => setYm((m) => shift(m, 1)) }, [support]);
  const setView2 = (v) => { setView(v); localStorage.setItem('dcamc.visits.view', v); };
  const byDay = useMemo(() => { const m = {}; for (const v of rows) (m[v.VISIT_DATE] ||= []).push(v); return m; }, [rows]);
  const cells = useMemo(() => { const [y, m] = ym.split('-').map(Number); const first = new Date(Date.UTC(y, m - 1, 1)); const lead = (first.getUTCDay() + 6) % 7; const days = new Date(Date.UTC(y, m, 0)).getUTCDate(); const out = []; for (let i = 0; i < lead; i++) out.push(null); for (let d = 1; d <= days; d++) out.push(`${ym}-${String(d).padStart(2, '0')}`); while (out.length % 7) out.push(null); return out; }, [ym]);
  const remove = async () => { try { await visitService.remove(ask.VISIT_ID); toast('Visit removed', 'success'); list.refetch(); } catch (e) { toast(e.message, 'error'); } finally { setAsk(null); } };
  const monthLabel = new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const closeDlg = () => { setDlg(null); if (sp.get('new')) setSp({}); };
  return <div className="w-full">
    <PageHeader title="Visits" subtitle="Site visits — planned from a ticket or on their own, then marked done with minutes, kilometres and who signed." actions={<><Segmented value={view} onChange={setView2} options={[{ value: 'calendar', label: <Calendar className="h-4 w-4" /> }, { value: 'list', label: <LayoutList className="h-4 w-4" /> }]} />{support && <Button icon={Plus} onClick={() => setDlg({})} title="Alt+N">Plan a visit</Button>}</>} />
    <div className="mb-3 grid gap-2 sm:grid-cols-3"><Kpi label="Today" value={rows.filter((v) => v.VISIT_DATE === today() && v.STATUS !== 'CANCELLED').length} icon={MapPin} /><Kpi label={view === 'calendar' ? 'Planned this month' : 'Planned'} value={rows.filter((v) => v.STATUS === 'PLANNED').length} icon={Calendar} tone="text-info" /><Kpi label={view === 'calendar' ? 'Done this month' : 'Done'} value={rows.filter((v) => v.STATUS === 'DONE').length} icon={CheckCircle2} tone="text-ok" /></div>
    <div className="mb-3 flex flex-wrap items-center gap-2">{view === 'calendar' && <div className="flex items-center rounded-md border border-line bg-surface"><button className="btn-ghost !h-8 !w-8 !rounded-r-none !border-0 !px-0" onClick={() => setYm(shift(ym, -1))} title="Alt+←"><ChevronLeft className="h-4 w-4" /></button><button className="h-8 min-w-[150px] border-x border-line px-3 text-[12.5px] font-semibold hover:bg-surface-2" onClick={() => setYm(monthOf(today()))}>{monthLabel}</button><button className="btn-ghost !h-8 !w-8 !rounded-l-none !border-0 !px-0" onClick={() => setYm(shift(ym, 1))} title="Alt+→"><ChevronRight className="h-4 w-4" /></button></div>}<Dropdown size="sm" className="w-44" value={eng} onChange={(e) => setEng(e.target.value)} options={[['', 'All engineers'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} /><Dropdown size="sm" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={[['', 'Any status'], ...VSTATUS]} /></div>
    <ErrorBox error={list.error} />
    {view === 'calendar' ? <div className="card overflow-hidden"><div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
      <div className="grid grid-cols-7">{cells.map((d, i) => <div key={i} className={`min-h-[96px] border-b border-r border-line/60 p-1 ${d === today() ? 'bg-accent/[.06]' : ''} ${!d ? 'bg-surface-2/30' : ''}`}>{d && <><div className="flex items-center justify-between"><span className={`num text-[11.5px] ${d === today() ? 'font-bold text-accent' : 'text-muted'}`}>{Number(d.slice(8))}</span>{support && <button className="rounded p-0.5 text-faint hover:bg-surface-2 hover:text-ink" title="Plan a visit this day" onClick={() => setDlg({ date: d })}><Plus className="h-3 w-3" /></button>}</div>
        <div className="mt-0.5 space-y-0.5">{(byDay[d] || []).map((v) => <button key={v.VISIT_ID} onClick={() => setDlg({ visit: v })} className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${v.STATUS === 'DONE' ? 'bg-ok/12 text-ok' : v.STATUS === 'CANCELLED' ? 'bg-surface-3 text-faint line-through' : 'bg-info/12 text-info'}`} title={`${v.SHOP_NAME} · ${v.PURPOSE} · ${v.ENGINEER_NAME || 'no engineer'}`}>{v.VISIT_TIME ? `${v.VISIT_TIME} ` : ''}{v.SHOP_NAME}{v.ENGINEER_NAME ? ` · ${initials(v.ENGINEER_NAME)}` : ''}</button>)}</div></>}</div>)}</div></div>
    : <DataTable rows={rows} loading={list.loading} rowKey="VISIT_ID" onRowClick={(v) => setDlg({ visit: v })} columns={[
      { key: 'VISIT_DATE', label: 'Date', render: (v) => <span className="num whitespace-nowrap">{formatDate(v.VISIT_DATE)}{v.VISIT_TIME ? ` ${v.VISIT_TIME}` : ''}</span> }, { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (v) => <div><div className="font-medium">{v.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{v.SHOP_CODE}{v.EMIRATE_CODE ? ` · ${v.EMIRATE_CODE}` : ''}</div></div> },
      { key: 'PURPOSE', label: 'Purpose', render: (v) => <span className="normal-case">{v.PURPOSE}</span> }, { key: 'ENGINEER_NAME', label: 'Engineer', render: (v) => v.ENGINEER_NAME || <span className="text-faint">—</span> }, { key: 'TICKET_NO', label: 'Ticket', hideBelow: 'lg', render: (v) => v.TICKET_NO ? <button className="font-mono text-[12px] text-accent hover:underline" onClick={(e) => { e.stopPropagation(); nav(`/tickets?open=${v.TICKET_ID}`); }}>{v.TICKET_NO}</button> : '—' },
      { key: 'STATUS', label: 'Status', render: (v) => <Badge tone={VTONE[v.STATUS]}>{v.STATUS}</Badge> }, { key: 'MINUTES', label: 'Min', align: 'right', hideBelow: 'lg' }, { key: 'TRAVEL_KM', label: 'Km', align: 'right', hideBelow: 'lg' }, { key: 'SIGNED_BY', label: 'Signed', hideBelow: 'xl' },
      { key: 'A', label: '', render: (v) => support && <button className="btn-ghost !h-7 !px-2 !text-bad" onClick={(e) => { e.stopPropagation(); setAsk(v); }} title="Remove"><Trash2 className="h-3.5 w-3.5" /></button> },
    ]} emptyTitle="No visits" footer={<span>{rows.length} visits</span>} />}
    <VisitDialog open={!!dlg} onClose={closeDlg} custId={dlg?.custId} ticketId={dlg?.ticketId} visit={dlg?.visit} date={dlg?.date} onSaved={() => list.refetch()} />
    <ConfirmDialog open={!!ask} onClose={() => setAsk(null)} onConfirm={remove} title="Remove this visit?" message={`${ask?.SHOP_NAME} on ${formatDate(ask?.VISIT_DATE)} is deleted. Use Cancelled instead to keep it on record.`} confirmLabel="Remove" />
  </div>;
}
