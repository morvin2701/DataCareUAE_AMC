import { useEffect, useState } from 'react';
import { ticketService, customerService } from '../../services/amcService.js';
import { userService } from '../../services/authService.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { PRIORITIES, CHANNELS } from './ticketUi.jsx';
/** The team to assign to: every active DcAMC login. */
export function useTeam() { const [team, setTeam] = useState([]); useEffect(() => { userService.list().then((r) => setTeam(r.rows.filter((u) => u.ACTIVE !== false))).catch(() => {}); }, []); return team; }
/** Quick create: customer (or preset), channel, title, priority, detail, assignee. Enter moves on; Ctrl+Enter in the detail saves. */
export function NewTicketDialog({ open, onClose, custId, onSaved }) {
  const toast = useToast(); const team = useTeam(); const [custs, setCusts] = useState([]); const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; setF({ CUST_ID: custId || '', CHANNEL: 'CALL', TITLE: '', PRIORITY: 'NORMAL', DETAIL: '', ASSIGNED_TO: '' }); if (!custId) customerService.list({ active: '1' }).then((r) => setCusts(r.rows)).catch(() => {}); }, [open, custId]);
  const save = async () => { if (!f?.CUST_ID) return toast('Choose the shop', 'warn'); setBusy(true); try { const r = await ticketService.create(f); toast(`${r.ticket.TICKET_NO} opened`, 'success'); onSaved?.(r.ticket); onClose(); } catch (e) { toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: onClose }); const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return <Modal open={open} onClose={onClose} title="New ticket" size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Open ticket</Button></>}>
    {f && <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-3 sm:grid-cols-2" noValidate>
      {!custId && <Select label="Shop" className="sm:col-span-2" value={f.CUST_ID} onChange={set('CUST_ID')} options={[['', 'Choose the shop…'], ...custs.map((c) => ({ value: String(c.CUST_ID), label: `${c.SHOP_NAME} (${c.SHOP_CODE})`, hint: c.HDD }))]} autoFocus />}
      <Select label="Channel" value={f.CHANNEL} onChange={set('CHANNEL')} options={CHANNELS} autoFocus={!!custId} /><Select label="Priority" value={f.PRIORITY} onChange={set('PRIORITY')} options={PRIORITIES} />
      <Input label="Title" className="sm:col-span-2" upper={false} value={f.TITLE} onChange={set('TITLE')} placeholder="What is wrong, in one line" />
      <Textarea label="Detail" className="sm:col-span-2" rows={4} value={f.DETAIL} onChange={set('DETAIL')} placeholder="What they said, what you saw, screen and voucher numbers… (Ctrl+Enter saves)" />
      <Select label="Assign to" value={f.ASSIGNED_TO} onChange={set('ASSIGNED_TO')} options={[['', 'Unassigned'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} />
    </form>}
  </Modal>;
}
