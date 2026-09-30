import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, ShieldCheck, CalendarClock, AlertTriangle, WifiOff, FileSignature } from 'lucide-react';
import { customerService, serverService } from '../../services/amcService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useRights } from '../../app/AuthContext.jsx';
import { PageHeader, SearchBox, Badge, Kpi, ErrorBox } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { formatDate, displayMobile, rel, formatAED } from '../../lib/fmt.js';

export const PLANS = [['', 'All versions'], ['BASIC', 'Basic'], ['PRO', 'Pro'], ['ADVANCE', 'Advance'], ['ENTERPRISE', 'Enterprise']];
export const PLAN_LETTER = { BASIC: 'B', PRO: 'P', ADVANCE: 'A', ENTERPRISE: 'E' };
/** How much licence is left, said the way a phone call says it. */
export function Expiry({ date, days, label }) {
  if (!date) return <span className="text-[12px] text-faint">{label || '—'}</span>;
  const tone = days == null ? 'text-muted' : days < 0 ? 'text-bad' : days <= 30 ? 'text-warn' : 'text-ok';
  return <span className="whitespace-nowrap"><span className="num text-[12.5px]">{formatDate(date)}</span><span className={`ml-1.5 text-[11px] ${tone}`}>{days == null ? '' : days < 0 ? `${-days} d over` : days === 0 ? 'today' : `${days} d left`}</span></span>;
}
/** Customers — the shops every heartbeat brings. No add form; open one to see its licence, AMC, tickets and visits. */
export function CustomersPage() {
  const nav = useNavigate(); const { money } = useRights(); const [sp] = useSearchParams();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [f, setF] = useState({ plan: '', status: '', server: '', expiry: sp.get('expiry') || '', active: '1' });
  const list = useQuery(() => customerService.list({ q: dq, ...f }), [dq, f]); const rows = list.data?.rows || [];
  const servers = useQuery(() => serverService.list(), []);
  useHotkeys({ '/': () => document.getElementById('cust-q')?.focus() }, []);
  const all = list.data?.rows || [];
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return <div className="w-full">
    <PageHeader title="Customers" subtitle="Every shop the ERP servers report, with its licence (from the heartbeat) and its AMC (from here). Customers are never typed in — they arrive with the first heartbeat." />
    <div className="mb-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Shops" value={all.length} icon={Store} onClick={() => setF({ ...f, expiry: '' })} /><Kpi label="Licence live" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS >= 0 && r.STATUS === 'ACTIVE').length} icon={ShieldCheck} tone="text-ok" />
      <Kpi label="Licence ends in 30 d" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS >= 0 && r.LIC_DAYS <= 30).length} icon={CalendarClock} tone="text-warn" onClick={() => setF({ ...f, expiry: '30' })} /><Kpi label="Licence expired" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS < 0).length} icon={AlertTriangle} tone="text-bad" onClick={() => setF({ ...f, expiry: 'expired' })} />
      <Kpi label="No AMC" value={all.filter((r) => !r.AMC_NO).length} icon={FileSignature} onClick={() => setF({ ...f, expiry: 'noamc' })} /><Kpi label="Server offline" value={all.filter((r) => r.OFFLINE).length} icon={WifiOff} tone="text-bad" onClick={() => setF({ ...f, expiry: 'offline' })} />
    </div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchBox value={q} onChange={setQ} placeholder="Shop, code, HDD, contact, mobile…" className="w-full sm:w-72" inputRef={(el) => el && (el.id = 'cust-q')} />
      <Dropdown size="sm" className="w-36" value={f.plan} onChange={set('plan')} options={PLANS} />
      <Dropdown size="sm" className="w-36" value={f.status} onChange={set('status')} options={[['', 'Any status'], ['ACTIVE', 'Active'], ['SUSPEND', 'Suspended']]} />
      <Dropdown size="sm" className="w-44" value={f.server} onChange={set('server')} options={[['', 'All servers'], ...(servers.data?.rows || []).map((s) => [String(s.SERVER_ID), s.NAME])]} />
      <Dropdown size="sm" className="w-44" value={f.expiry} onChange={set('expiry')} options={[['', 'Any expiry'], ['30', 'Licence ends in 30 d'], ['expired', 'Licence expired'], ['amc30', 'AMC ends in 30 d'], ['noamc', 'No AMC'], ['offline', 'Server offline']]} />
      <Dropdown size="sm" className="w-32" value={f.active} onChange={set('active')} options={[['1', 'Current'], ['0', 'Left us'], ['', 'All']]} />
    </div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="CUST_ID" onRowClick={(c) => nav(`/customers/${c.CUST_ID}`)} columns={[
      { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (c) => <div className="flex items-center gap-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${c.OFFLINE ? 'bg-bad' : 'bg-ok'}`} title={c.OFFLINE ? 'Server offline (> 48 h)' : 'Server online'} /><div><div className="font-medium">{c.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{c.SHOP_CODE} · {c.SERVER_NAME}</div></div></div> },
      { key: 'HDD', label: 'Code', render: (c) => <span className="font-mono text-[12.5px]">{c.HDD || '—'}</span> },
      { key: 'PLAN_CODE', label: 'Version', render: (c) => c.PLAN_CODE ? <Badge tone="accent">{c.PLAN_CODE}</Badge> : '—' },
      { key: 'STATUS', label: 'Status', render: (c) => <Badge tone={c.STATUS === 'ACTIVE' ? 'ok' : 'bad'}>{c.STATUS || '—'}</Badge> },
      { key: 'TILLS', label: 'Tills', align: 'center', hideBelow: 'lg', render: (c) => c.TILLS || '∞' },
      { key: 'LIC_END', label: 'Licence ends', render: (c) => <Expiry date={c.LIC_END} days={c.LIC_DAYS} /> },
      { key: 'AMC_END', label: 'AMC', render: (c) => c.AMC_NO ? <div><Expiry date={c.AMC_END} days={c.AMC_DAYS} /><div className="text-[11px] text-muted">{c.AMC_NO} · {c.AMC_STATUS}</div></div> : <span className="text-[12px] text-warn">No AMC</span> },
      ...(money ? [{ key: 'OUTSTANDING', label: 'Outstanding', align: 'right', render: (c) => Number(c.OUTSTANDING) > 0 ? <span className="text-bad">{formatAED(c.OUTSTANDING)}</span> : <span className="text-faint">—</span> }] : []),
      { key: 'OPEN_TICKETS', label: 'Tickets', align: 'center', render: (c) => c.OPEN_TICKETS ? <Badge tone="warn">{c.OPEN_TICKETS}</Badge> : <span className="text-faint">0</span> },
      { key: 'CONTACT_NAME', label: 'Contact', hideBelow: 'xl', render: (c) => <div><div>{c.CONTACT_NAME || '—'}</div><div className="num text-[11.5px] text-muted">{displayMobile(c.MOBILE_NO)}</div></div> },
      { key: 'LAST_LOGIN', label: 'Last used', hideBelow: 'xl', render: (c) => <span className="text-muted">{rel(c.LAST_LOGIN)}</span> },
    ]} emptyTitle="No customers yet" emptyHint="Add parties in Party master." footer={<span>{rows.length} shops · <kbd className="kbd">/</kbd> search · click a row to open</span>} />
  </div>;
}
