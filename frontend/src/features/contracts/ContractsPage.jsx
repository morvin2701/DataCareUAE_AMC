import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer, FileSignature, CalendarClock, FileEdit, Ban } from 'lucide-react';
import { contractService } from '../../services/amcService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { PageHeader, SearchBox, Badge, Kpi, ErrorBox } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ContractEditor } from './ContractEditor.jsx';
import { STATUS_TONE, PushBadge } from './contractUi.jsx';
import { Expiry } from '../customers/CustomersPage.jsx';
import { formatDate, formatAED } from '../../lib/fmt.js';
/** All contracts: filter by status / expiring, open the customer, renew from here. */
export function ContractsPage() {
  const nav = useNavigate(); const { money } = useRights();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [status, setStatus] = useState(''); const [expiring, setExpiring] = useState(''); const [edit, setEdit] = useState(null);
  const list = useQuery(() => contractService.list({ q: dq, status, expiring }), [dq, status, expiring]); const rows = list.data?.rows || [];
  useHotkeys({ 'alt+n': () => money && setEdit({ new: true }) }, [money]);
  const live = rows.filter((k) => k.STATUS === 'LIVE');
  return <div className="w-full">
    <PageHeader title="Contracts" subtitle="Annual maintenance contracts: a year is 365 days, a renewal starts the day after the current one ends. Making a contract live raises its tax invoice and pushes the licence to the shop." actions={money && <Button icon={Plus} onClick={() => setEdit({ new: true })} title="Alt+N">New / renew</Button>} />
    <div className="mb-3 grid gap-2 sm:grid-cols-4"><Kpi label="Live" value={live.length} icon={FileSignature} tone="text-ok" onClick={() => setStatus('LIVE')} /><Kpi label="Ending in 30 days" value={live.filter((k) => k.DAYS_LEFT <= 30).length} icon={CalendarClock} tone="text-warn" onClick={() => setExpiring('30')} /><Kpi label="Drafts" value={rows.filter((k) => k.STATUS === 'DRAFT').length} icon={FileEdit} onClick={() => setStatus('DRAFT')} /><Kpi label="Expired" value={rows.filter((k) => k.STATUS === 'EXPIRED').length} icon={Ban} onClick={() => setStatus('EXPIRED')} /></div>
    <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Contract no, shop, code…" className="w-full sm:w-72" /><Dropdown size="sm" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={[['', 'Any status'], ['DRAFT', 'Draft'], ['LIVE', 'Live'], ['EXPIRED', 'Expired'], ['CANCELLED', 'Cancelled']]} /><Dropdown size="sm" className="w-44" value={expiring} onChange={(e) => setExpiring(e.target.value)} options={[['', 'Any date'], ['30', 'Ending in 30 days']]} /></div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="CONTRACT_ID" onRowClick={(k) => nav(`/customers/${k.CUST_ID}?tab=contracts`)} columns={[
      { key: 'CONTRACT_NO', label: 'Contract', render: (k) => <span className="font-mono text-[12.5px]">{k.CONTRACT_NO}</span> },
      { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (k) => <div><div className="font-medium">{k.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{k.SHOP_CODE} · {k.HDD}</div></div> },
      { key: 'START_DATE', label: 'Period', hideBelow: 'lg', render: (k) => <span className="num whitespace-nowrap">{formatDate(k.START_DATE)} – {formatDate(k.END_DATE)}</span> },
      { key: 'END_DATE', label: 'Ends', render: (k) => k.STATUS === 'LIVE' ? <Expiry date={k.END_DATE} days={k.DAYS_LEFT} /> : <span className="num">{formatDate(k.END_DATE)}</span> },
      { key: 'STATUS', label: 'Status', render: (k) => <Badge tone={STATUS_TONE[k.STATUS]}>{k.STATUS}</Badge> },
      ...(money ? [{ key: 'TOTAL', label: 'Total', align: 'right', render: (k) => formatAED(k.TOTAL) }, { key: 'BALANCE', label: 'Balance', align: 'right', render: (k) => Number(k.BALANCE) > 0 ? <span className="text-bad">{formatAED(k.BALANCE)}</span> : <span className="text-faint">—</span> }] : []),
      { key: 'PUSH_STATUS', label: 'Licence', render: (k) => <span title={k.PUSH_MSG || ''}><PushBadge k={k} /></span> },
      { key: 'USER_NAME', label: 'By', hideBelow: 'xl', render: (k) => <span className="text-muted">{k.USER_NAME}</span> },
      { key: 'P', label: '', render: (k) => <button className="btn-ghost !h-7 !px-2" onClick={(e) => { e.stopPropagation(); nav(`/contracts/${k.CONTRACT_ID}/print`); }} title="Print"><Printer className="h-3.5 w-3.5" /></button> },
    ]} emptyTitle="No contracts" footer={<span>{rows.length} contracts · click a row to open the customer</span>} />
    <ContractEditor open={!!edit} onClose={() => setEdit(null)} custId={null} contract={null} onSaved={() => list.refetch()} />
  </div>;
}
