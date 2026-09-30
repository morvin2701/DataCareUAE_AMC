import { useEffect, useState } from 'react';
import { visitService, customerService, ticketService } from '../../services/amcService.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { useTeam } from '../tickets/TicketDialogs.jsx';
import { today } from '../../lib/fmt.js';
export const VSTATUS = [['PLANNED', 'Planned'], ['DONE', 'Done'], ['CANCELLED', 'Cancelled']];
/** New / edit a visit: shop (or preset), from a ticket (optional), date, time, engineer, purpose; after the visit: done, minutes, km, signed by. */
export function VisitDialog({ open, onClose, custId, ticketId, visit, date, onSaved }) {
  const toast = useToast(); const team = useTeam(); const [custs, setCusts] = useState([]); const [tickets, setTickets] = useState([]); const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return;
    if (visit) setF({ ...visit, VISIT_TIME: visit.VISIT_TIME || '', ENGINEER: visit.ENGINEER ? String(visit.ENGINEER) : '', TICKET_ID: visit.TICKET_ID ? String(visit.TICKET_ID) : '', SIGNED_BY: visit.SIGNED_BY || '', REMARK: visit.REMARK || '' });
    else setF({ CUST_ID: custId ? String(custId) : '', TICKET_ID: ticketId ? String(ticketId) : '', VISIT_DATE: date || today(), VISIT_TIME: '', ENGINEER: '', PURPOSE: '', STATUS: 'PLANNED', MINUTES: 0, TRAVEL_KM: 0, SIGNED_BY: '', REMARK: '' });
    if (!custId && !visit) customerService.list({ active: '1' }).then((r) => setCusts(r.rows)).catch(() => {});
  }, [open, custId, ticketId, visit, date]);
  useEffect(() => { const c = f?.CUST_ID; if (!c) { setTickets([]); return; } ticketService.list({ custId: c, open: '1' }).then((r) => setTickets(r.rows)).catch(() => {}); }, [f?.CUST_ID]);
  const save = async () => { if (!f?.CUST_ID) return toast('Choose the shop', 'warn'); setBusy(true); try { const r = visit ? await visitService.update(visit.VISIT_ID, f) : await visitService.create(f); toast(visit ? 'Visit saved' : 'Visit planned', 'success'); onSaved?.(r.visit); onClose(); } catch (e) { toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: onClose }); const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return <Modal open={open} onClose={onClose} title={visit ? `Visit · ${visit.SHOP_NAME}` : 'Plan a visit'} size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{visit ? 'Save' : 'Plan visit'}</Button></>}>
    {f && <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-3 sm:grid-cols-2" noValidate>
      {!custId && !visit && <Select label="Shop" className="sm:col-span-2" value={f.CUST_ID} onChange={set('CUST_ID')} options={[['', 'Choose the shop…'], ...custs.map((c) => ({ value: String(c.CUST_ID), label: `${c.SHOP_NAME} (${c.SHOP_CODE})`, hint: c.HDD }))]} autoFocus />}
      <Select label="For ticket" className="sm:col-span-2" value={f.TICKET_ID} onChange={set('TICKET_ID')} options={[['', 'No ticket — standalone visit'], ...tickets.map((t) => [String(t.TICKET_ID), `${t.TICKET_NO} · ${t.TITLE}`])]} />
      <Input label="Date" type="date" value={f.VISIT_DATE} onChange={set('VISIT_DATE')} autoFocus={!!custId && !visit} /><Input label="Time" type="time" value={f.VISIT_TIME} onChange={set('VISIT_TIME')} />
      <Select label="Engineer" value={f.ENGINEER} onChange={set('ENGINEER')} options={[['', 'Not assigned'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} /><Select label="Status" value={f.STATUS} onChange={set('STATUS')} options={VSTATUS} />
      <Input label="Purpose" className="sm:col-span-2" upper={false} value={f.PURPOSE} onChange={set('PURPOSE')} placeholder="Installation, training, printer, data fix…" />
      {f.STATUS === 'DONE' && <><Input label="Minutes on site" type="number" min="0" value={f.MINUTES} onChange={set('MINUTES')} /><Input label="Travel km" type="number" min="0" step="0.1" value={f.TRAVEL_KM} onChange={set('TRAVEL_KM')} /><Input label="Signed by (at the shop)" className="sm:col-span-2" value={f.SIGNED_BY} onChange={set('SIGNED_BY')} /></>}
      <Textarea label="Remark" className="sm:col-span-2" rows={2} value={f.REMARK} onChange={set('REMARK')} />
    </form>}
  </Modal>;
}
