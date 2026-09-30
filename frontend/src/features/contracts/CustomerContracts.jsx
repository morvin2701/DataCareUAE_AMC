import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer, Ban, Play } from 'lucide-react';
import { contractService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, ConfirmDialog } from '../../components/ui/Controls.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ContractEditor } from './ContractEditor.jsx';
import { STATUS_TONE } from './contractUi.jsx';
import { Expiry } from '../customers/CustomersPage.jsx';
import { formatDate, formatAED } from '../../lib/fmt.js';

/** The customer's contracts, newest first, with renew / edit / make live / push / cancel / print. */
export function CustomerContracts({ customer, onChange, openNew }) {
  const nav = useNavigate(); const toast = useToast(); const { money } = useRights();
  const list = useQuery(() => contractService.list({ custId: customer.CUST_ID }), [customer.CUST_ID]); const rows = list.data?.rows || [];
  const [edit, setEdit] = useState(null); const [ask, setAsk] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (openNew && money) setEdit({ new: true }); }, [openNew]); // eslint-disable-line
  const done = () => { list.refetch(); onChange?.(); };
  const act = async (fn, msg) => { setBusy(true); try { const r = await fn(); toast(typeof msg === 'function' ? msg(r) : msg, 'success', 5000); done(); } catch (e) { toast(e.message, 'error', 6000); } finally { setBusy(false); setAsk(null); } };
  return <div className="space-y-3">
    {money && <div className="flex justify-end"><Button icon={Plus} onClick={() => setEdit({ new: true })}>{rows.some((k) => k.STATUS === 'LIVE') ? 'Renew AMC' : 'New AMC'}</Button></div>}
    <DataTable rows={rows} loading={list.loading} rowKey="CONTRACT_ID" columns={[
      { key: 'CONTRACT_NO', label: 'Contract', primary: true, render: (k) => <span className="font-mono text-[12.5px]">{k.CONTRACT_NO}</span> },
      { key: 'START_DATE', label: 'Period', render: (k) => <span className="num whitespace-nowrap">{formatDate(k.START_DATE)} – {formatDate(k.END_DATE)}</span> },
      { key: 'END_DATE', label: 'Ends', render: (k) => k.STATUS === 'LIVE' ? <Expiry date={k.END_DATE} days={k.DAYS_LEFT} /> : <span className="num">{formatDate(k.END_DATE)}</span> },
      { key: 'STATUS', label: 'Status', render: (k) => <Badge tone={STATUS_TONE[k.STATUS]}>{k.STATUS}</Badge> },
      { key: 'COVER', label: 'Cover', hideBelow: 'lg', render: (k) => [k.COVERS_SUPPORT && 'Support', k.COVERS_UPDATES && 'Updates', k.VISITS_INCLUDED ? `${k.VISITS_USED}/${k.VISITS_INCLUDED} visits` : null].filter(Boolean).join(' · ') || '—' },
      ...(money ? [{ key: 'TOTAL', label: 'Total', align: 'right', render: (k) => formatAED(k.TOTAL) }, { key: 'BALANCE', label: 'Balance', align: 'right', render: (k) => Number(k.BALANCE) > 0 ? <span className="text-bad">{formatAED(k.BALANCE)}</span> : <span className="text-faint">—</span> }] : []),
      { key: 'ACTIONS', label: '', render: (k) => <span className="flex justify-end gap-1"><button className="btn-ghost !h-7 !px-2 !text-[12px]" title="Print the contract" onClick={() => nav(`/contracts/${k.CONTRACT_ID}/print`)}><Printer className="h-3.5 w-3.5" /></button>{money && k.STATUS !== 'CANCELLED' && <button className="btn-ghost !h-7 !px-2 !text-[12px]" onClick={() => setEdit(k)}>Edit</button>}{money && k.STATUS === 'DRAFT' && <button className="btn-soft !h-7 !px-2 !text-[12px]" title="Make live and raise the invoice" onClick={() => act(() => contractService.status(k.CONTRACT_ID, 'LIVE'), (r) => `${k.CONTRACT_NO} live — invoice ${r.contract.INV_NO || ''}`)}><Play className="h-3.5 w-3.5" /></button>}{money && ['DRAFT', 'LIVE'].includes(k.STATUS) && <button className="btn-ghost !h-7 !px-2 !text-[12px] !text-bad" title="Cancel" onClick={() => setAsk(k)}><Ban className="h-3.5 w-3.5" /></button>}</span> },
    ]} emptyTitle="No contract yet" emptyHint={money ? 'Make the first AMC: start defaults to the licence end, one year, and the amount you type.' : 'No AMC on record.'} />
    <ContractEditor open={!!edit} onClose={() => setEdit(null)} custId={customer.CUST_ID} contract={edit?.new ? null : edit} onSaved={done} />
    <ConfirmDialog open={!!ask} onClose={() => setAsk(null)} busy={busy} onConfirm={() => act(() => contractService.status(ask.CONTRACT_ID, 'CANCELLED'), `${ask.CONTRACT_NO} cancelled`)} title={`Cancel ${ask?.CONTRACT_NO}?`} message="The contract and its unpaid invoice are marked cancelled." confirmLabel="Cancel contract" />
  </div>;
}
