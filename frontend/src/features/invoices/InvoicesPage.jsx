import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Wallet, Receipt, AlertTriangle, CheckCircle2, Coins } from 'lucide-react';
import { invoiceService, paymentService } from '../../services/amcService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { PageHeader, SearchBox, Badge, Kpi, ErrorBox } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { PaymentDialog, MODES } from './PaymentDialog.jsx';
import { ReceiveDialog } from './ReceiveDialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { Plus } from 'lucide-react';
import { INV_TONE } from './CustomerPayments.jsx';
import { formatDate, formatAED, fmt } from '../../lib/fmt.js';
const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
/** Invoices & payments: every tax invoice with its balance; receive money from here. */
export function InvoicesPage() {
  const nav = useNavigate(); const [q, setQ] = useState(''); const dq = useDebounce(q); const [status, setStatus] = useState(''); const [receive, setReceive] = useState(null);
  const list = useQuery(() => invoiceService.list({ q: dq, status }), [dq, status]); const rows = list.data?.rows || [];
  const open = rows.filter((i) => i.STATUS === 'OPEN');
  return <div className="w-full">
    <PageHeader title="Invoices" subtitle="Tax invoices, one per contract, raised when the contract goes live. Receive money against an invoice; the receipt prints on A4." />
    <div className="mb-3 grid gap-2 sm:grid-cols-4"><Kpi label="Open invoices" value={open.length} icon={Receipt} onClick={() => setStatus('OPEN')} /><Kpi label="Outstanding" value={formatAED(sum(open, 'BALANCE'))} icon={Coins} tone="text-bad" /><Kpi label="Overdue" value={open.filter((i) => i.DAYS_OVERDUE > 0).length} icon={AlertTriangle} tone="text-warn" onClick={() => setStatus('OVERDUE')} /><Kpi label="Paid" value={rows.filter((i) => i.STATUS === 'PAID').length} icon={CheckCircle2} tone="text-ok" onClick={() => setStatus('PAID')} /></div>
    <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Invoice, contract, shop…" className="w-full sm:w-72" /><Dropdown size="sm" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={[['', 'Any status'], ['OPEN', 'Open'], ['OVERDUE', 'Overdue'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled']]} /></div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="INV_ID" onRowClick={(i) => nav(`/customers/${i.CUST_ID}?tab=payments`)} columns={[
      { key: 'INV_NO', label: 'Invoice', render: (i) => <span className="font-mono text-[12.5px]">{i.INV_NO}</span> }, { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (i) => <div><div className="font-medium">{i.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{i.SHOP_CODE} · {i.KIND === 'AMC' ? i.CONTRACT_NO : i.KIND}</div></div> },
      { key: 'INV_DATE', label: 'Date', render: (i) => <span className="num">{formatDate(i.INV_DATE)}</span> }, { key: 'DUE_DATE', label: 'Due', render: (i) => <span className={`num ${i.DAYS_OVERDUE > 0 ? 'text-bad' : ''}`}>{formatDate(i.DUE_DATE)}{i.DAYS_OVERDUE > 0 ? ` · ${i.DAYS_OVERDUE} d` : ''}</span> },
      { key: 'TOTAL', label: 'Total', align: 'right', render: (i) => formatAED(i.TOTAL) }, { key: 'PAID', label: 'Received', align: 'right', hideBelow: 'lg', render: (i) => formatAED(i.PAID) }, { key: 'BALANCE', label: 'Balance', align: 'right', render: (i) => <span className={Number(i.BALANCE) > 0 ? 'text-bad' : 'text-faint'}>{formatAED(i.BALANCE)}</span> },
      { key: 'STATUS', label: 'Status', render: (i) => <Badge tone={INV_TONE[i.STATUS]}>{i.STATUS}</Badge> },
      { key: 'A', label: '', render: (i) => <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>{i.STATUS === 'OPEN' && <button className="btn-soft !h-7 !px-2 !text-[12px]" onClick={() => setReceive(i)}><Wallet className="mr-1 h-3.5 w-3.5" />Receive</button>}<button className="btn-ghost !h-7 !px-2" title="Print" onClick={() => nav(`/invoices/${i.INV_ID}/print`)}><Printer className="h-3.5 w-3.5" /></button></span> },
    ]} emptyTitle="No invoices" footer={<span>{rows.length} invoices · total AED {fmt(sum(rows.filter((i) => i.STATUS !== 'CANCELLED'), 'TOTAL'))}</span>} />
    <PaymentDialog invoice={receive} onClose={() => setReceive(null)} onSaved={() => list.refetch()} />
  </div>;
}
/** Every receipt, by period and mode. */
export function PaymentsPage() {
  const nav = useNavigate(); const [q, setQ] = useState(''); const dq = useDebounce(q); const [f, setF] = useState({ from: '', to: '', mode: '' });
  const list = useQuery(() => paymentService.list({ q: dq, ...f }), [dq, f]); const rows = list.data?.rows || []; const live = rows.filter((p) => !p.CANCELLED);
  const [recv, setRecv] = useState(false); useHotkeys({ 'alt+n': () => setRecv(true) }, []);
  return <div className="w-full">
    <PageHeader title="AMC received" subtitle="Money received from a party — cash, bank, cheque or card — against its AMC, installation or upgrade invoice. Cancel a receipt and the invoice balance goes back up." actions={<Button icon={Plus} onClick={() => setRecv(true)} title="Alt+N">Receive payment</Button>} />
    <div className="mb-3 flex flex-wrap items-end gap-2"><SearchBox value={q} onChange={setQ} placeholder="Receipt, invoice, shop, reference…" className="w-full sm:w-72" /><Input label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-40" nav={false} /><Input label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-40" nav={false} /><Dropdown size="md" className="w-40" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[['', 'Any mode'], ...MODES]} /></div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="PAY_ID" onRowClick={(p) => nav(`/customers/${p.CUST_ID}?tab=payments`)} columns={[
      { key: 'RCPT_NO', label: 'Receipt', render: (p) => <span className={`font-mono text-[12.5px] ${p.CANCELLED ? 'line-through text-faint' : ''}`}>{p.RCPT_NO}</span> }, { key: 'PAY_DATE', label: 'Date', render: (p) => <span className="num">{formatDate(p.PAY_DATE)}</span> }, { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (p) => <div><div className="font-medium">{p.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{p.INV_NO} · {p.CONTRACT_NO}</div></div> },
      { key: 'PAY_MODE', label: 'Mode', render: (p) => `${p.PAY_MODE}${p.REF_NO ? ` · ${p.REF_NO}` : ''}` }, { key: 'AMOUNT', label: 'Amount', align: 'right', render: (p) => formatAED(p.AMOUNT) }, { key: 'USER_NAME', label: 'By', hideBelow: 'lg' }, { key: 'C', label: 'Status', render: (p) => <Badge tone={p.CANCELLED ? 'bad' : 'ok'}>{p.CANCELLED ? 'Cancelled' : 'Received'}</Badge> },
      { key: 'A', label: '', render: (p) => <button className="btn-ghost !h-7 !px-2" onClick={(e) => { e.stopPropagation(); nav(`/payments/${p.PAY_ID}/print`); }} title="Print receipt"><Printer className="h-3.5 w-3.5" /></button> },
    ]} emptyTitle="No receipts" emptyHint="Press Receive payment, choose the party and the invoice it is paying." emptyAction={<Button icon={Plus} onClick={() => setRecv(true)}>Receive payment</Button>} footer={<span>{live.length} receipts · AED {fmt(sum(live, 'AMOUNT'))} · <kbd className="kbd">Alt N</kbd> receive</span>} />
    <ReceiveDialog open={recv} onClose={() => setRecv(false)} onSaved={(p) => { list.refetch(); nav(`/payments/${p.PAY_ID}/print`); }} />
  </div>;
}
/** Outstanding: every open invoice, oldest due first, with the customer's contact for the call. */
export function OutstandingPage() {
  const nav = useNavigate(); const list = useQuery(() => invoiceService.outstanding(), []); const rows = list.data?.rows || []; const [receive, setReceive] = useState(null);
  return <div className="w-full">
    <PageHeader title="Outstanding" subtitle="Open invoices with money still due, oldest due date first." />
    <div className="mb-3 grid gap-2 sm:grid-cols-3"><Kpi label="Invoices" value={rows.length} icon={Receipt} /><Kpi label="Total due" value={formatAED(sum(rows, 'BALANCE'))} icon={Coins} tone="text-bad" /><Kpi label="Overdue" value={formatAED(sum(rows.filter((i) => i.DAYS_OVERDUE > 0), 'BALANCE'))} icon={AlertTriangle} tone="text-warn" /></div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="INV_ID" onRowClick={(i) => nav(`/customers/${i.CUST_ID}?tab=payments`)} columns={[
      { key: 'SHOP_NAME', label: 'Shop', primary: true, render: (i) => <div><div className="font-medium">{i.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{i.SHOP_CODE}</div></div> }, { key: 'INV_NO', label: 'Invoice', render: (i) => <span className="font-mono text-[12.5px]">{i.INV_NO}</span> }, { key: 'INV_DATE', label: 'Date', render: (i) => <span className="num">{formatDate(i.INV_DATE)}</span> }, { key: 'DUE_DATE', label: 'Due', render: (i) => <span className={`num ${i.DAYS_OVERDUE > 0 ? 'text-bad' : ''}`}>{formatDate(i.DUE_DATE)}</span> }, { key: 'DAYS_OVERDUE', label: 'Days over', align: 'center', render: (i) => i.DAYS_OVERDUE > 0 ? <Badge tone="bad">{i.DAYS_OVERDUE}</Badge> : <span className="text-faint">—</span> },
      { key: 'TOTAL', label: 'Total', align: 'right', hideBelow: 'lg', render: (i) => formatAED(i.TOTAL) }, { key: 'BALANCE', label: 'Balance', align: 'right', render: (i) => <span className="font-semibold text-bad">{formatAED(i.BALANCE)}</span> },
      { key: 'A', label: '', render: (i) => <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}><button className="btn-soft !h-7 !px-2 !text-[12px]" onClick={() => setReceive(i)}><Wallet className="mr-1 h-3.5 w-3.5" />Receive</button><button className="btn-ghost !h-7 !px-2 !text-[12px]" onClick={() => nav(`/customers/${i.CUST_ID}/statement`)}>Statement</button></span> },
    ]} emptyTitle="Nothing outstanding" emptyHint="Every invoice is paid." footer={<span>{rows.length} invoices · AED {fmt(sum(rows, 'BALANCE'))} due</span>} />
    <PaymentDialog invoice={receive} onClose={() => setReceive(null)} onSaved={() => list.refetch()} />
  </div>;
}
