import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService, invoiceService, paymentService } from '../../services/amcService.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { MODES } from './PaymentDialog.jsx';
import { today, fmt, formatDate } from '../../lib/fmt.js';
const KIND = { AMC: 'AMC', INSTALL: 'Installation', UPGRADE: 'Upgrade' };
/**
 * AMC received: pick the party → its open invoices (AMC, installation, upgrade) with what is still due → the amount, mode,
 * reference → Record receipt. Defaults to the oldest open invoice and its full balance.
 */
export function ReceiveDialog({ open, onClose, onSaved, custId: presetCust }) {
  const toast = useToast(); const nav = useNavigate();
  const [parties, setParties] = useState([]); const [cust, setCust] = useState(''); const [invs, setInvs] = useState(null); const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; setInvs(null); setF(null); setCust(presetCust ? String(presetCust) : ''); customerService.list({ active: '' }).then((r) => setParties(r.rows)).catch(() => {}); }, [open, presetCust]);
  useEffect(() => { if (!open || !cust) { setInvs(null); return; } invoiceService.list({ custId: cust, status: 'OPEN' }).then((r) => { const rows = r.rows.filter((i) => Number(i.BALANCE) > 0.004).sort((a, b) => String(a.DUE_DATE).localeCompare(String(b.DUE_DATE))); setInvs(rows); const first = rows[0]; setF(first ? { INV_ID: String(first.INV_ID), PAY_DATE: today(), PAY_MODE: 'BANK', REF_NO: '', AMOUNT: Number(first.BALANCE).toFixed(2), REMARK: '' } : null); }).catch((e) => toast(e.message, 'error')); }, [cust, open]); // eslint-disable-line
  const inv = invs?.find((i) => String(i.INV_ID) === f?.INV_ID);
  const pickInv = (id) => { const i = invs.find((x) => String(x.INV_ID) === id); setF((s) => ({ ...s, INV_ID: id, AMOUNT: i ? Number(i.BALANCE).toFixed(2) : s.AMOUNT })); };
  const save = async () => { if (!f || busy) return; setBusy(true); try { const r = await paymentService.create({ ...f, INV_ID: Number(f.INV_ID) }); toast(`${r.payment.RCPT_NO} recorded — AED ${fmt(r.payment.AMOUNT)} from ${r.payment.SHOP_NAME}`, 'success', 5000); onSaved?.(r.payment); onClose(); } catch (e) { toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: onClose }); const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const party = parties.find((p) => String(p.CUST_ID) === cust); const due = (invs || []).reduce((a, i) => a + Number(i.BALANCE || 0), 0);
  return <Modal open={open} onClose={onClose} title="Receive payment" subtitle={party ? `${party.SHOP_NAME} · AED ${fmt(due)} due on ${invs?.length || 0} invoice${invs?.length === 1 ? '' : 's'}` : 'Choose the party who paid'} size="md"
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!f} onClick={save}>Record receipt</Button></>}>
    <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-3 sm:grid-cols-2" noValidate>
      <Select label="Party" className="sm:col-span-2" value={cust} onChange={(e) => setCust(e.target.value)} autoFocus={!presetCust} options={[['', 'Choose the party…'], ...parties.map((p) => ({ value: String(p.CUST_ID), label: `${p.SHOP_NAME}`, hint: Number(p.OUTSTANDING) > 0 ? `due ${fmt(p.OUTSTANDING)}` : p.HDD || '' }))]} />
      {cust && invs && !invs.length && <div className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[13px] normal-case sm:col-span-2">Nothing is due from this party. Issue its AMC first (AMC issue → New / renew, then Make live) — that raises the invoice the money is received against.<div className="mt-2"><Button type="button" variant="soft" onClick={() => { onClose(); nav(`/customers/${cust}?tab=contracts&new=1`); }}>Issue AMC for this party</Button></div></div>}
      {f && <>
        <Select label="Against invoice" className="sm:col-span-2" value={f.INV_ID} onChange={(e) => pickInv(e.target.value)} options={invs.map((i) => ({ value: String(i.INV_ID), label: `${i.INV_NO} · ${KIND[i.KIND] || i.KIND}${i.CONTRACT_NO ? ` ${i.CONTRACT_NO}` : ''} · due ${formatDate(i.DUE_DATE)}`, hint: `AED ${fmt(i.BALANCE)}` }))} />
        {inv && <div className="vbar justify-between sm:col-span-2"><span className="text-muted">Invoice AED {fmt(inv.TOTAL)} · received {fmt(inv.PAID)}</span><span className="num font-semibold">Balance AED {fmt(inv.BALANCE)}</span></div>}
        <Input label="Date" type="date" value={f.PAY_DATE} onChange={set('PAY_DATE')} autoFocus={!!presetCust} /><Select label="Mode" value={f.PAY_MODE} onChange={set('PAY_MODE')} options={MODES} />
        <Input label="Reference (cheque / transfer / card no)" upper={false} value={f.REF_NO} onChange={set('REF_NO')} /><Input label="Amount (AED)" type="number" step="0.01" min="0.01" value={f.AMOUNT} onChange={set('AMOUNT')} className="[&_input]:num [&_input]:text-right" hint="Part payment is fine; more than the balance is refused" />
        <Input label="Remark" className="sm:col-span-2" upper={false} value={f.REMARK} onChange={set('REMARK')} submit />
      </>}
    </form>
  </Modal>;
}
