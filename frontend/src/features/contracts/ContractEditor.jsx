import { useEffect, useState } from 'react';
import { contractService, customerService } from '../../services/amcService.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { Toggle, Badge } from '../../components/ui/Controls.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { formatDate, fmt, yearEnd } from '../../lib/fmt.js';

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const PLANS = [['', '— as the licence says —'], ['BASIC', 'Basic'], ['PRO', 'Pro'], ['ADVANCE', 'Advance'], ['ENTERPRISE', 'Enterprise']];
/**
 * New / renew / edit a contract. Defaults come from the server: start = licence start, or the day after the last AMC, end = +365
 * days, amount and cover from the last contract. Save keeps a draft; "Make live" raises the invoice and pushes the licence.
 */
export function ContractEditor({ open, onClose, custId, contract, onSaved }) {
  const toast = useToast(); const [f, setF] = useState(null); const [d, setD] = useState(null); const [busy, setBusy] = useState(''); const [custs, setCusts] = useState([]); const [pick, setPick] = useState(custId || '');
  useEffect(() => { if (!open) return; setF(null); setD(null);
    if (contract) { setF({ ...contract, TILLS: contract.TILLS ?? '', PLAN_CODE: contract.PLAN_CODE || '', REMARK: contract.REMARK || '' }); return; }
    if (!custId) customerService.list({ active: '1' }).then((r) => setCusts(r.rows)).catch(() => {});
    if (custId) load(custId);
  }, [open, custId, contract]); // eslint-disable-line
  const load = async (id) => { try { const r = await contractService.defaults(id); setD(r); setF({ CUST_ID: id, START_DATE: r.START_DATE, END_DATE: r.END_DATE, AMOUNT: r.AMOUNT, VAT_PRC: r.VAT_PRC, COVERS_SUPPORT: r.COVERS_SUPPORT, COVERS_UPDATES: r.COVERS_UPDATES, VISITS_INCLUDED: r.VISITS_INCLUDED, TILLS: r.TILLS ?? '', PLAN_CODE: r.PLAN_CODE || '', RENEWED_FROM: r.RENEWED_FROM, REMARK: '' }); } catch (e) { toast(e.message, 'error'); } };
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setStart = (v) => setF((s) => ({ ...s, START_DATE: v, END_DATE: v ? yearEnd(v) : s.END_DATE }));
  const vatAmt = f ? money(f.AMOUNT * f.VAT_PRC / 100) : 0; const total = f ? money(Number(f.AMOUNT) + vatAmt) : 0;
  const save = async (live) => {
    if (!f) return; setBusy(live ? 'live' : 'save');
    try {
      let r = contract ? await contractService.update(contract.CONTRACT_ID, f) : await contractService.create({ ...f, STATUS: live ? 'LIVE' : 'DRAFT' });
      if (contract && live) r = await contractService.status(contract.CONTRACT_ID, 'LIVE');
      const k = r.contract; toast(live ? `${k.CONTRACT_NO} is live — tax invoice ${k.INV_NO || ''} raised` : `${k.CONTRACT_NO} saved as a draft`, 'success', 6000);
      onSaved?.(k); onClose();
    } catch (e) { toast(e.message, e.code === 'VALIDATION' || e.code === 'OVERLAP' ? 'warn' : 'error', 6000); } finally { setBusy(''); }
  };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: () => save(false), onEscape: onClose });
  const draft = !contract || contract.STATUS === 'DRAFT';
  return <Modal open={open} onClose={onClose} title={contract ? `${contract.CONTRACT_NO} · ${contract.SHOP_NAME}` : d ? `${d.previous ? 'Renew' : 'New'} AMC · ${d.customer.SHOP_NAME}` : 'New AMC'} subtitle={d?.previous ? `Follows ${d.previous.CONTRACT_NO} (ended ${formatDate(d.previous.END_DATE)})` : d ? `Licence ends ${formatDate(d.customer.LIC_END) || '—'}` : ''} size="lg"
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>{draft && <Button variant="soft" loading={busy === 'save'} disabled={!f} onClick={() => save(false)}>{contract ? 'Save draft' : 'Save as draft'}</Button>}{contract && !draft && <Button loading={busy === 'save'} onClick={() => save(false)}>Save</Button>}{draft && <Button loading={busy === 'live'} disabled={!f} onClick={() => save(true)} title="Raises the tax invoice">Make live</Button>}</>}>
    {!custId && !contract && <div className="mb-4"><Select label="Customer" value={pick} onChange={(e) => { setPick(e.target.value); if (e.target.value) load(Number(e.target.value)); }} options={[['', 'Choose the shop…'], ...custs.map((c) => ({ value: String(c.CUST_ID), label: `${c.SHOP_NAME} (${c.SHOP_CODE})`, hint: c.HDD }))]} autoFocus /></div>}
    {f && <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(false); }} className="grid gap-x-4 gap-y-3 sm:grid-cols-2" noValidate>
      <Input label="Start" type="date" value={f.START_DATE} onChange={(e) => setStart(e.target.value)} disabled={!draft} autoFocus={!!custId} />
      <Input label="End (one year)" type="date" value={f.END_DATE} onChange={(e) => set('END_DATE', e.target.value)} disabled={!draft} />
      <Input label="Amount (AED, before VAT)" type="number" step="0.01" min="0" value={f.AMOUNT} onChange={(e) => set('AMOUNT', e.target.value)} className="[&_input]:num [&_input]:text-right" />
      <Input label="VAT %" type="number" step="0.01" min="0" max="100" value={f.VAT_PRC} onChange={(e) => set('VAT_PRC', e.target.value)} className="[&_input]:num [&_input]:text-right" />
      <div className="vbar sm:col-span-2 justify-between"><span className="text-muted">VAT AED {fmt(vatAmt)}</span><span className="num text-[15px] font-semibold">Total AED {fmt(total)}</span></div>
      <Input label="Visits included" type="number" min="0" value={f.VISITS_INCLUDED} onChange={(e) => set('VISITS_INCLUDED', e.target.value)} />
      <Input label="Tills covered" type="number" min="0" value={f.TILLS} onChange={(e) => set('TILLS', e.target.value)} />
      <Select label="Software type" value={f.PLAN_CODE} onChange={(e) => set('PLAN_CODE', e.target.value)} options={PLANS} />
      <div className="rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Covers support" checked={f.COVERS_SUPPORT} onChange={(v) => set('COVERS_SUPPORT', v)} /><Toggle label="Covers updates" checked={f.COVERS_UPDATES} onChange={(v) => set('COVERS_UPDATES', v)} /></div>
      <Textarea label="Remark (on the contract)" rows={2} value={f.REMARK} onChange={(e) => set('REMARK', e.target.value)} className="sm:col-span-2" />
      {contract && <div className="text-[12px] normal-case text-muted sm:col-span-2">Status <Badge tone={contract.STATUS === 'LIVE' ? 'ok' : contract.STATUS === 'DRAFT' ? 'warn' : 'muted'}>{contract.STATUS}</Badge>{contract.INV_NO && <> · tax invoice {contract.INV_NO}</>}</div>}
    </form>}
  </Modal>;
}
