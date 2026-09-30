import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Wallet, Ban, FileText } from 'lucide-react';
import { invoiceService, paymentService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, ConfirmDialog } from '../../components/ui/Controls.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PaymentDialog } from './PaymentDialog.jsx';
import { formatDate, formatAED } from '../../lib/fmt.js';
export const INV_TONE = { OPEN: 'warn', PAID: 'ok', CANCELLED: 'bad' };
/** Customer → Payments: its invoices with balances, its receipts, and the statement. */
export function CustomerPayments({ customer, onChange }) {
  const nav = useNavigate(); const toast = useToast();
  const inv = useQuery(() => invoiceService.list({ custId: customer.CUST_ID }), [customer.CUST_ID]); const pay = useQuery(() => paymentService.list({ custId: customer.CUST_ID }), [customer.CUST_ID]);
  const [receive, setReceive] = useState(null); const [ask, setAsk] = useState(null); const [busy, setBusy] = useState(false);
  const done = () => { inv.refetch(); pay.refetch(); onChange?.(); };
  const cancel = async () => { setBusy(true); try { if (ask.kind === 'inv') await invoiceService.cancel(ask.row.INV_ID); else await paymentService.cancel(ask.row.PAY_ID); toast('Cancelled', 'success'); done(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setAsk(null); } };
  return <div className="space-y-4">
    <div className="flex justify-end"><Button variant="ghost" icon={FileText} onClick={() => nav(`/customers/${customer.CUST_ID}/statement`)}>Statement</Button></div>
    <section><div className="section-title">Tax invoices</div><DataTable rows={inv.data?.rows || []} loading={inv.loading} rowKey="INV_ID" columns={[
      { key: 'INV_NO', label: 'Invoice', primary: true, render: (i) => <span className="font-mono text-[12.5px]">{i.INV_NO}</span> }, { key: 'INV_DATE', label: 'Date', render: (i) => <span className="num">{formatDate(i.INV_DATE)}</span> }, { key: 'DUE_DATE', label: 'Due', render: (i) => <span className={`num ${i.DAYS_OVERDUE > 0 ? 'text-bad' : ''}`}>{formatDate(i.DUE_DATE)}{i.DAYS_OVERDUE > 0 ? ` (${i.DAYS_OVERDUE} d over)` : ''}</span> }, { key: 'CONTRACT_NO', label: 'Contract', hideBelow: 'lg' },
      { key: 'TOTAL', label: 'Total', align: 'right', render: (i) => formatAED(i.TOTAL) }, { key: 'PAID', label: 'Received', align: 'right', render: (i) => formatAED(i.PAID) }, { key: 'BALANCE', label: 'Balance', align: 'right', render: (i) => <span className={Number(i.BALANCE) > 0 ? 'text-bad' : 'text-faint'}>{formatAED(i.BALANCE)}</span> }, { key: 'STATUS', label: 'Status', render: (i) => <Badge tone={INV_TONE[i.STATUS]}>{i.STATUS}</Badge> },
      { key: 'A', label: '', render: (i) => <span className="flex justify-end gap-1">{i.STATUS === 'OPEN' && <button className="btn-soft !h-7 !px-2 !text-[12px]" onClick={() => setReceive(i)}><Wallet className="mr-1 h-3.5 w-3.5" />Receive</button>}<button className="btn-ghost !h-7 !px-2" title="Print" onClick={() => nav(`/invoices/${i.INV_ID}/print`)}><Printer className="h-3.5 w-3.5" /></button>{i.STATUS === 'OPEN' && Number(i.PAID) === 0 && <button className="btn-ghost !h-7 !px-2 !text-bad" title="Cancel invoice" onClick={() => setAsk({ kind: 'inv', row: i })}><Ban className="h-3.5 w-3.5" /></button>}</span> },
    ]} emptyTitle="No invoices" emptyHint="A tax invoice is raised when a contract is made live." /></section>
    <section><div className="section-title">Receipts</div><DataTable rows={pay.data?.rows || []} loading={pay.loading} rowKey="PAY_ID" columns={[
      { key: 'RCPT_NO', label: 'Receipt', primary: true, render: (p) => <span className={`font-mono text-[12.5px] ${p.CANCELLED ? 'line-through text-faint' : ''}`}>{p.RCPT_NO}</span> }, { key: 'PAY_DATE', label: 'Date', render: (p) => <span className="num">{formatDate(p.PAY_DATE)}</span> }, { key: 'INV_NO', label: 'Invoice' }, { key: 'PAY_MODE', label: 'Mode', render: (p) => `${p.PAY_MODE}${p.REF_NO ? ` · ${p.REF_NO}` : ''}` }, { key: 'AMOUNT', label: 'Amount', align: 'right', render: (p) => formatAED(p.AMOUNT) }, { key: 'USER_NAME', label: 'By', hideBelow: 'lg' },
      { key: 'A', label: '', render: (p) => <span className="flex justify-end gap-1"><button className="btn-ghost !h-7 !px-2" title="Print receipt" onClick={() => nav(`/payments/${p.PAY_ID}/print`)}><Printer className="h-3.5 w-3.5" /></button>{!p.CANCELLED && <button className="btn-ghost !h-7 !px-2 !text-bad" title="Cancel receipt" onClick={() => setAsk({ kind: 'pay', row: p })}><Ban className="h-3.5 w-3.5" /></button>}</span> },
    ]} emptyTitle="No receipts yet" /></section>
    <PaymentDialog invoice={receive} onClose={() => setReceive(null)} onSaved={done} />
    <ConfirmDialog open={!!ask} onClose={() => setAsk(null)} busy={busy} onConfirm={cancel} title={ask?.kind === 'inv' ? `Cancel ${ask?.row.INV_NO}?` : `Cancel ${ask?.row.RCPT_NO}?`} message={ask?.kind === 'inv' ? 'The invoice is marked cancelled; the contract stays as it is.' : 'The receipt is marked cancelled and the invoice balance goes back up.'} confirmLabel="Cancel it" />
  </div>;
}
