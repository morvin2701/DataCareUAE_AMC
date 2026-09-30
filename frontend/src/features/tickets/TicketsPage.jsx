import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, LayoutList, Columns3, AlertTriangle, Ticket, UserX, Flame } from 'lucide-react';
import { ticketService } from '../../services/amcService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useRights } from '../../app/AuthContext.jsx';
import { PageHeader, SearchBox, Kpi, ErrorBox, Segmented } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { NewTicketDialog, useTeam } from './TicketDialogs.jsx';
import { TicketDrawer } from './TicketDrawer.jsx';
import { PRIORITIES, STATUSES, Sla, PrioBadge, StatusBadge, statusLabel } from './ticketUi.jsx';
import { rel, initials } from '../../lib/fmt.js';

/** Tickets: list or kanban by status, filters, SLA timers, quick create (Alt+N or ?new=<custId>). */
export function TicketsPage() {
  const { support } = useRights(); const team = useTeam(); const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [f, setF] = useState({ status: '', priority: '', assigned: '', open: '1' }); const [view, setView] = useState(() => localStorage.getItem('dcamc.tickets.view') || 'list');
  const [add, setAdd] = useState(sp.get('new') ? { custId: Number(sp.get('new')) } : null); const [openId, setOpenId] = useState(sp.get('open') ? Number(sp.get('open')) : null);
  const list = useQuery(() => ticketService.list({ q: dq, ...f }), [dq, f]); const rows = list.data?.rows || [];
  useHotkeys({ 'alt+n': () => support && setAdd({}) }, [support]);
  const setView2 = (v) => { setView(v); localStorage.setItem('dcamc.tickets.view', v); };
  const open = rows.filter((t) => t.STATUS !== 'CLOSED');
  const closeAdd = () => { setAdd(null); if (sp.get('new')) setSp({}); };
  return <div className="w-full">
    <PageHeader title="Tickets" subtitle="Every call, WhatsApp, e-mail and visit request. The SLA timer runs from the priority (Settings → SLA hours); close with a resolution." actions={<><Segmented value={view} onChange={setView2} options={[{ value: 'list', label: <LayoutList className="h-4 w-4" /> }, { value: 'kanban', label: <Columns3 className="h-4 w-4" /> }]} />{support && <Button icon={Plus} onClick={() => setAdd({})} title="Alt+N">New ticket</Button>}</>} />
    <div className="mb-3 grid gap-2 sm:grid-cols-4"><Kpi label="Open" value={open.length} icon={Ticket} onClick={() => setF({ ...f, status: '', open: '1' })} /><Kpi label="Urgent / high" value={open.filter((t) => ['URGENT', 'HIGH'].includes(t.PRIORITY)).length} icon={Flame} tone="text-bad" onClick={() => setF({ ...f, priority: 'URGENT' })} /><Kpi label="Past SLA" value={open.filter((t) => t.OVERDUE).length} icon={AlertTriangle} tone="text-warn" /><Kpi label="Unassigned" value={open.filter((t) => !t.ASSIGNED_TO).length} icon={UserX} onClick={() => setF({ ...f, assigned: 'none' })} /></div>
    <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Ticket no, title, shop…" className="w-full sm:w-72" /><Dropdown size="sm" className="w-36" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, open: e.target.value ? '' : '1' })} options={[['', 'Any status'], ...STATUSES]} /><Dropdown size="sm" className="w-36" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={[['', 'Any priority'], ...PRIORITIES]} /><Dropdown size="sm" className="w-40" value={f.assigned} onChange={(e) => setF({ ...f, assigned: e.target.value })} options={[['', 'Anyone'], ['none', 'Unassigned'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} /><label className="flex items-center gap-1.5 text-[12.5px] text-muted"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={f.open === '1' && !f.status} onChange={(e) => setF({ ...f, open: e.target.checked ? '1' : '', status: '' })} />Open only</label></div>
    <ErrorBox error={list.error} />
    {view === 'list' ? <DataTable rows={rows} loading={list.loading} rowKey="TICKET_ID" onRowClick={(t) => setOpenId(t.TICKET_ID)} columns={[
      { key: 'TICKET_NO', label: 'Ticket', render: (t) => <span className="font-mono text-[12.5px]">{t.TICKET_NO}</span> }, { key: 'TITLE', label: 'Title', primary: true, render: (t) => <div><div className="font-medium normal-case">{t.TITLE}</div><div className="text-[11.5px] text-muted">{t.SHOP_NAME} · {t.SHOP_CODE}</div></div> },
      { key: 'PRIORITY', label: 'Priority', render: (t) => <PrioBadge p={t.PRIORITY} /> }, { key: 'STATUS', label: 'Status', render: (t) => <StatusBadge s={t.STATUS} /> }, { key: 'SLA', label: 'SLA', render: (t) => <Sla t={t} /> },
      { key: 'ASSIGNED_NAME', label: 'Assigned', render: (t) => t.ASSIGNED_NAME ? <span className="inline-flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold">{initials(t.ASSIGNED_NAME)}</span>{t.ASSIGNED_NAME}</span> : <span className="text-faint">—</span> },
      { key: 'CHANNEL', label: 'Via', hideBelow: 'lg' }, { key: 'OPENED_AT', label: 'Opened', hideBelow: 'lg', render: (t) => <span className="text-muted">{rel(t.OPENED_AT)}</span> }, { key: 'NOTES', label: 'Notes', align: 'center', hideBelow: 'xl' },
    ]} emptyTitle="No tickets" emptyHint="Every support call goes here — quick create with Alt+N or from a customer." footer={<span>{rows.length} tickets · click a row to open</span>} />
    : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{STATUSES.map(([s, l]) => { const col = rows.filter((t) => t.STATUS === s); return <div key={s} className="card flex flex-col"><div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{l}</span><span className="badge bg-surface-3 text-muted">{col.length}</span></div><div className="flex-1 space-y-2 p-2">{col.map((t) => <button key={t.TICKET_ID} onClick={() => setOpenId(t.TICKET_ID)} className={`w-full rounded-md border border-line bg-surface-2/40 p-2.5 text-left transition hover:border-accent/50 ${t.OVERDUE ? 'border-l-2 border-l-bad' : ''}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[11.5px] text-muted">{t.TICKET_NO}</span><PrioBadge p={t.PRIORITY} /></div><div className="mt-1 text-[13px] font-medium normal-case leading-snug">{t.TITLE}</div><div className="mt-1 text-[11.5px] text-muted">{t.SHOP_NAME}</div><div className="mt-1.5 flex items-center justify-between"><Sla t={t} />{t.ASSIGNED_NAME && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-[9.5px] font-semibold" title={t.ASSIGNED_NAME}>{initials(t.ASSIGNED_NAME)}</span>}</div></button>)}{col.length === 0 && <div className="py-6 text-center text-[12px] text-faint">—</div>}</div></div>; })}</div>}
    <NewTicketDialog open={!!add} onClose={closeAdd} custId={add?.custId} onSaved={(t) => { list.refetch(); setOpenId(t.TICKET_ID); }} />
    <TicketDrawer id={openId} onClose={() => { setOpenId(null); if (sp.get('open')) setSp({}); }} onChange={() => list.refetch()} />
  </div>;
}
