import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Plus, RefreshCw } from 'lucide-react';
import { notifyService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { useTeam } from '../tickets/TicketDialogs.jsx';
import { PageHeader, Badge, Segmented } from '../../components/ui/Controls.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime, rel } from '../../lib/fmt.js';
const TONE = { FOLLOWUP: 'info', DEMO: 'accent', TICKET: 'bad', LICENCE: 'warn', AMC: 'warn', CUSTOM: 'muted' };
const fromLocal = (s) => (s ? new Date(new Date(`${s}:00Z`).getTime() - 4 * 3600e3).toISOString() : null);
/** Notifications: what the team must not miss — follow-ups and demos due, tickets past SLA, licences and AMCs ending within a week, and notes the owner sends. */
export function NotificationsPage() {
  const nav = useNavigate(); const toast = useToast(); const { owner } = useRights(); const team = useTeam(); const [all, setAll] = useState(false);
  const q = useQuery(() => notifyService.list(all), [all]); const rows = q.data?.rows || []; const [add, setAdd] = useState(null); const [busy, setBusy] = useState(false);
  const openOne = async (n) => { if (!n.READ_AT) { await notifyService.read(n.NOTIFY_ID).catch(() => {}); window.dispatchEvent(new Event('notify:changed')); } if (n.LINK) nav(n.LINK); else q.refetch(); };
  const readAll = async () => { await notifyService.readAll(); window.dispatchEvent(new Event('notify:changed')); q.refetch(); };
  const send = async () => { setBusy(true); try { await notifyService.create({ ...add, DUE_AT: fromLocal(add.DUE_AT) }); toast('Notification set', 'success'); setAdd(null); q.refetch(); } catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); } };
  return <div className="w-full">
    <PageHeader title="Notifications" subtitle="Follow-ups and demos when they are due, tickets past their response time, licences and AMCs ending within a week, and anything the owner sends the team — each once." actions={<><Segmented value={all ? 'all' : 'unread'} onChange={(v) => setAll(v === 'all')} options={[{ value: 'unread', label: 'Unread' }, { value: 'all', label: 'All' }]} /><Button variant="ghost" icon={CheckCheck} onClick={readAll} disabled={!rows.some((n) => !n.READ_AT)}>Mark all read</Button>{owner && <><Button variant="ghost" icon={RefreshCw} onClick={async () => { await notifyService.generate(); q.refetch(); }} title="Check what is due right now">Check now</Button><Button icon={Plus} onClick={() => setAdd({ USER_ID: '', TITLE: '', BODY: '', DUE_AT: '', LINK: '' })}>Send a note</Button></>}</>} />
    <div className="card divide-y divide-line">{rows.map((n) => <button key={n.NOTIFY_ID} onClick={() => openOne(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/[.06] ${n.READ_AT ? 'opacity-70' : ''}`}><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.READ_AT ? 'bg-transparent' : 'bg-accent'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[n.KIND] || 'muted'}>{n.KIND}</Badge><span className="font-medium normal-case">{n.TITLE}</span></div>{n.BODY && <div className="mt-0.5 text-[12.5px] normal-case text-muted">{n.BODY}</div>}<div className="mt-0.5 text-[11.5px] text-faint" title={formatDateTime(n.DUE_AT)}>{rel(n.DUE_AT)}{n.BY_NAME ? ` · from ${n.BY_NAME}` : ''}</div></div></button>)}{!q.loading && !rows.length && <div className="flex flex-col items-center gap-2 py-14 text-center"><Bell className="h-6 w-6 text-faint" /><p className="text-[13px] normal-case text-muted">{all ? 'Nothing yet.' : 'Nothing unread.'}</p></div>}</div>
    <Modal open={!!add} onClose={() => setAdd(null)} title="Send a note to the team" size="sm" footer={<><Button variant="ghost" onClick={() => setAdd(null)}>Cancel</Button><Button loading={busy} onClick={send}>Send</Button></>}>{add && <div className="space-y-3"><Select label="To" value={add.USER_ID} onChange={(e) => setAdd({ ...add, USER_ID: e.target.value })} options={[['', 'Everyone'], ...team.map((u) => [String(u.USER_ID), u.USER_NAME])]} /><Input label="Title" upper={false} autoFocus value={add.TITLE} onChange={(e) => setAdd({ ...add, TITLE: e.target.value })} /><Textarea label="Message" rows={3} value={add.BODY} onChange={(e) => setAdd({ ...add, BODY: e.target.value })} /><Input label="Show at (blank = now)" type="datetime-local" value={add.DUE_AT} onChange={(e) => setAdd({ ...add, DUE_AT: e.target.value })} /></div>}</Modal>
  </div>;
}
/** The bell in the header: unread count, polled every minute, a short list on click. */
export function NotifyBell() {
  const nav = useNavigate(); const [d, setD] = useState({ unread: 0, rows: [] }); const [open, setOpen] = useState(false);
  const load = () => notifyService.list().then((r) => setD({ unread: r.unread, rows: r.rows.slice(0, 8) })).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); window.addEventListener('notify:changed', load); return () => { clearInterval(t); window.removeEventListener('notify:changed', load); }; }, []);
  useEffect(() => { if (!open) return; const h = (e) => { if (!e.target.closest('[data-bell]')) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return <div className="relative" data-bell><button onClick={() => setOpen((o) => !o)} className="btn-ghost relative !h-8 !w-8 !px-0" title="Notifications" aria-label="Notifications"><Bell className="h-4 w-4" />{d.unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{d.unread > 99 ? '99+' : d.unread}</span>}</button>
    {open && <div className="card absolute right-0 top-10 z-50 w-80 overflow-hidden shadow-pop anim-pop"><div className="flex items-center justify-between border-b border-line px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Notifications<span className="badge bg-surface-3">{d.unread}</span></div><div className="max-h-80 divide-y divide-line overflow-y-auto">{d.rows.map((n) => <button key={n.NOTIFY_ID} onClick={async () => { await notifyService.read(n.NOTIFY_ID).catch(() => {}); setOpen(false); load(); if (n.LINK) nav(n.LINK); }} className="block w-full px-3 py-2 text-left hover:bg-accent/[.06]"><div className="truncate text-[13px] font-medium normal-case">{n.TITLE}</div><div className="truncate text-[11.5px] normal-case text-muted">{n.BODY || n.KIND} · {rel(n.DUE_AT)}</div></button>)}{!d.rows.length && <div className="px-3 py-6 text-center text-[12.5px] text-faint">Nothing unread</div>}</div><button onClick={() => { setOpen(false); nav('/notifications'); }} className="block w-full border-t border-line px-3 py-2 text-center text-[12.5px] text-accent hover:bg-surface-2">All notifications</button></div>}</div>;
}
