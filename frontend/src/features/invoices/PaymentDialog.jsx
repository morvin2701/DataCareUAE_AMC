import { useEffect, useState } from 'react';
import { paymentService } from '../../services/amcService.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { today, fmt } from '../../lib/fmt.js';
export const MODES = [['CASH', 'Cash'], ['BANK', 'Bank transfer'], ['CHEQUE', 'Cheque'], ['CARD', 'Card']];
/** Record a payment against one invoice; defaults to the full balance, today, bank transfer. */
export function PaymentDialog({ invoice, onClose, onSaved }) {
  const toast = useToast(); const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (invoice) setF({ INV_ID: invoice.INV_ID, PAY_DATE: today(), PAY_MODE: 'BANK', REF_NO: '', AMOUNT: Number(invoice.BALANCE).toFixed(2), REMARK: '' }); }, [invoice]);
  const save = async () => { if (busy) return; setBusy(true); try { const r = await paymentService.create(f); toast(`${r.payment.RCPT_NO} recorded — AED ${fmt(r.payment.AMOUNT)}`, 'success'); onSaved?.(r.payment); onClose(); } catch (e) { toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: onClose });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return <Modal open={!!invoice} onClose={onClose} title={`Receive payment · ${invoice?.INV_NO}`} subtitle={invoice ? `${invoice.SHOP_NAME} · balance AED ${fmt(invoice.BALANCE)}` : ''} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Record receipt</Button></>}>
    {f && <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3" noValidate><Input label="Date" type="date" value={f.PAY_DATE} onChange={set('PAY_DATE')} autoFocus /><Select label="Mode" value={f.PAY_MODE} onChange={set('PAY_MODE')} options={MODES} /><Input label="Reference (cheque / transfer / card no)" upper={false} value={f.REF_NO} onChange={set('REF_NO')} /><Input label="Amount (AED)" type="number" step="0.01" min="0.01" value={f.AMOUNT} onChange={set('AMOUNT')} className="[&_input]:num [&_input]:text-right" /><Input label="Remark" upper={false} value={f.REMARK} onChange={set('REMARK')} submit /></form>}
  </Modal>;
}
