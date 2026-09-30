import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, CheckCircle2, RotateCcw, MapPinned, Phone, MessageCircle, Clock } from 'lucide-react';
import { ticketService } from '../../services/amcService.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useRights } from '../../app/AuthContext.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PRIORITIES, STATUSES, CHANNELS, Sla, PrioBadge, StatusBadge } from './ticketUi.jsx';
import { useTeam } from './TicketDialogs.jsx';
import { formatDateTime, formatDate, displayMobile, rel, initials } from '../../lib/fmt.js';
const KIND_TONE = { NOTE: '', STATUS: 'text-info', ASSIGN: 'text-accent', CLOSE: 'text-ok' };
/** One ticket: head (editable), the thread, add a note (+ minutes, optional status), close with resolution, reopen, plan a visit. */
export function TicketDrawer({ id, onClose, onChange }) {
  const nav = useNavigate(); const toast = useToast(); const { support } = useRights(); const team = useTeam();
  const [t, setT] = useState(null); const [head, setHead] = useState(null); const [note, setNote] = useState({ NOTE: '', MINUTES: '', STATUS: '' }); const [close, setClose] = useState(null); const [busy, setBusy] = useState('');
  const load = async () => { try { const r = await ticketService.get(id); setT(r.ticket); setHead({ TITLE: r.ticket.TITLE, DETAIL: r.ticket.DETAIL || '', PRIORITY: r.ticket.PRIORITY, CHANNEL: r.ticket.CHANNEL, ASSIGNED_TO: r.ticket.ASSIGNED_TO ? String(r.ticket.ASSIGNED_TO) : '', STATUS: r.ticket.STATUS }); } catch (e) { toast(e.message, 'error'); onClose(); } };
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line
  useEffect(() => { document.body.style.overflow = id ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [id]);
  useEffect(() => { const h = (e) => { if (e.key === 'Escape' && !close && !document.querySelector('[role="dialog"] [role="dialog"]')) onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, close]);
  const changed = t && head && (head.TITLE !== t.TITLE || head.DETAIL !== (t.DETAIL || '') || head.PRIORITY !== t.PRIORITY || head.CHANNEL !== t.CHANNEL || head.ASSIGNED_TO !== (t.ASSIGNED_TO ? String(t.ASSIGNED_TO) : '') || head.STATUS !== t.STATUS);
  const act = async (key, fn, msg) => { setBusy(key); try { const r = await fn(); setT(r.ticket); if (r.ticket) setHead({ TITLE: r.ticket.TITLE, DETAIL: r.ticket.DETAIL || '', PRIORITY: r.ticket.PRIORITY, CHANNEL: r.ticket.CHANNEL, ASSIGNED_TO: r.ticket.ASSIGNED_TO ? String(r.ticket.ASSIGNED_TO) : '', STATUS: r.ticket.STATUS }); if (msg) toast(msg, 'success'); onChange?.(); } catch (e) { toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(''); } };
  const saveHead = () => { if (head.STATUS === 'CLOSED' && t.STATUS !== 'CLOSED') { setClose({ RESOLUTION: '', MINUTES: '' }); setHead({ ...head, STATUS: t.STATUS }); return; } act('head', () => ticketService.update(id, head), 'Ticket saved'); };
  const addNote = () => { if (!note.NOTE.trim()) return; act('note', async () => { const r = await ticketService.note(id, note); setNote({ NOTE: '', MINUTES: '', STATUS: '' }); return r; }, 'Note added'); };
  const doClose = () => act('close', async () => { const r = await ticketService.close(id, close); setClose(null); return r; }, 'Ticket closed');
  if (!id) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px] anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside role="dialog" aria-modal="true" className="flex h-full w-full max-w-3xl flex-col bg-surface shadow-pop anim-slide-in">
      {!t ? <div className="p-8 text-center text-muted">Opening…</div> : <>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-semibold">{t.TICKET_NO}</span><StatusBadge s={t.STATUS} /><PrioBadge p={t.PRIORITY} /><Sla t={t} /></div><h2 className="mt-1 truncate font-display text-[16px] font-bold normal-case">{t.TITLE}</h2><div className="text-[12px] text-muted"><button className="text-accent hover:underline" onClick={() => nav(`/customers/${t.CUST_ID}?tab=tickets`)}>{t.SHOP_NAME}</button> · {t.SHOP_CODE} · {t.CONTACT_NAME || '—'} {t.MOBILE_NO && <a className="num text-accent hover:underline" href={`https://wa.me/${t.MOBILE_NO}`} target="_blank" rel="noreferrer">{displayMobile(t.MOBILE_NO)}</a>} · opened {formatDateTime(t.OPENED_AT)} by {t.OPENED_BY} · {t.MINUTES_SPENT} min spent</div></div>
          <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Input label="Title" className="sm:col-span-4" upper={false} value={head.TITLE} onChange={(e) => setHead({ ...head, TITLE: e.target.value })} disabled={!support} />
            <Select label="Status" value={head.STATUS} onChange={(e) => setHead({ ...head, STATUS: e.target.value })} options={STATUSES} disabled={!support} /><Select label="Priority" value={head.PRIORITY} onChange={(e) => setHead({ ...head, PRIORITY: e.target.value })} options={PRIORITIES} disabled={!support} /><Select label="Channel" value={head.CHANNEL} onChange={(e) => setHead({ ...head, CHANNEL: e.target.value })} options={CHANNELS} disabled={!support} /><Select label="Assigned to" value={head.ASSIGNED_TO} onChange={(e) => setHead({ ...head, ASSIGNED_TO: e.target.value })} options={[['', 'Unassigned'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} disabled={!support} />
            <Textarea label="Detail" className="sm:col-span-4" rows={3} value={head.DETAIL} onChange={(e) => setHead({ ...head, DETAIL: e.target.value })} disabled={!support} />
            {changed && support && <div className="flex justify-end gap-2 sm:col-span-4"><Button variant="ghost" onClick={() => setHead({ TITLE: t.TITLE, DETAIL: t.DETAIL || '', PRIORITY: t.PRIORITY, CHANNEL: t.CHANNEL, ASSIGNED_TO: t.ASSIGNED_TO ? String(t.ASSIGNED_TO) : '', STATUS: t.STATUS })}>Discard</Button><Button loading={busy === 'head'} onClick={saveHead}>Save changes</Button></div>}
          </div>
          {t.RESOLUTION && <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-[13px] normal-case"><span className="font-semibold">Resolution:</span> {t.RESOLUTION} <span className="text-muted">· closed {formatDateTime(t.CLOSED_AT)}</span></div>}
          {t.visits.length > 0 && <div className="mt-4"><div className="section-title">Visits</div><ul className="space-y-1 text-[13px]">{t.visits.map((v) => <li key={v.VISIT_ID} className="flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-muted" />{formatDate(v.VISIT_DATE)}{v.VISIT_TIME ? ` ${v.VISIT_TIME}` : ''} · {v.ENGINEER_NAME || 'no engineer'} · {v.STATUS} · <span className="normal-case text-muted">{v.PURPOSE}</span></li>)}</ul></div>}
          <div className="mt-4"><div className="section-title">Thread</div>
            <ol className="space-y-2">{t.notes.map((n) => <li key={n.NOTE_ID} className="flex gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10.5px] font-semibold">{initials(n.USER_NAME)}</span><div className="min-w-0 flex-1 rounded-md border border-line bg-surface-2/40 px-3 py-2"><div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted"><span className="font-medium text-ink">{n.USER_NAME || 'System'}</span><span title={formatDateTime(n.ENTRY_DATE)}>{rel(n.ENTRY_DATE)}</span>{n.MINUTES > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{n.MINUTES} min</span>}</div><div className={`mt-0.5 whitespace-pre-wrap text-[13px] normal-case ${KIND_TONE[n.KIND] || ''}`}>{n.NOTE}</div></div></li>)}{t.notes.length === 0 && <li className="text-[12.5px] text-faint">No notes yet.</li>}</ol>
          </div>
        </div>
        {support && <footer className="border-t border-line bg-surface-2/60 px-5 py-3">
          {t.STATUS === 'CLOSED' ? <div className="flex items-center justify-between"><span className="text-[12.5px] text-muted">Closed {rel(t.CLOSED_AT)}.</span><Button variant="ghost" icon={RotateCcw} loading={busy === 'reopen'} onClick={() => act('reopen', () => ticketService.reopen(id), 'Ticket reopened')}>Reopen</Button></div>
          : <div className="space-y-2"><Textarea rows={2} value={note.NOTE} onChange={(e) => setNote({ ...note, NOTE: e.target.value })} placeholder="Add a note… (Ctrl+Enter sends)" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } }} nav={false} />
            <div className="flex flex-wrap items-center gap-2"><Input type="number" min="0" placeholder="min" value={note.MINUTES} onChange={(e) => setNote({ ...note, MINUTES: e.target.value })} className="w-24" nav={false} /><Select value={note.STATUS} onChange={(e) => setNote({ ...note, STATUS: e.target.value })} options={[['', 'Keep status'], ...STATUSES.filter((s) => s[0] !== 'CLOSED')]} className="w-40" size="md" nav={false} /><Button variant="soft" icon={Send} loading={busy === 'note'} onClick={addNote} disabled={!note.NOTE.trim()}>Add note</Button><span className="flex-1" /><Button variant="ghost" icon={MapPinned} onClick={() => nav(`/visits?new=${t.CUST_ID}&ticket=${t.TICKET_ID}`)}>Plan a visit</Button><Button icon={CheckCircle2} onClick={() => setClose({ RESOLUTION: '', MINUTES: '' })}>Close ticket</Button></div></div>}
        </footer>}
      </>}
    </aside>
    <Modal open={!!close} onClose={() => setClose(null)} title={`Close ${t?.TICKET_NO}`} size="sm" footer={<><Button variant="ghost" onClick={() => setClose(null)}>Cancel</Button><Button loading={busy === 'close'} onClick={doClose}>Close ticket</Button></>}>
      {close && <div className="space-y-3"><Textarea label="Resolution" rows={4} autoFocus value={close.RESOLUTION} onChange={(e) => setClose({ ...close, RESOLUTION: e.target.value })} placeholder="What fixed it" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doClose(); }} /><Input label="Minutes spent on this" type="number" min="0" value={close.MINUTES} onChange={(e) => setClose({ ...close, MINUTES: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && doClose()} /></div>}
    </Modal>
  </div>;
}
