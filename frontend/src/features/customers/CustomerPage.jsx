import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, Store, Phone, Mail, MapPin, Users, Activity, Clock, Save, FileSignature, Ticket, MapPinned, History } from 'lucide-react';
import { customerService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { PageHeader, Badge, Tabs, Toggle, ErrorBox } from '../../components/ui/Controls.jsx';
import { Input, Textarea } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { formatDate, formatDateTime, displayMobile, rel, formatAED } from '../../lib/fmt.js';
import { Expiry } from './CustomersPage.jsx';
import { CustomerContracts } from '../contracts/CustomerContracts.jsx';
import { CustomerPayments } from '../invoices/CustomerPayments.jsx';
import { CustomerTickets } from '../tickets/CustomerTickets.jsx';
import { CustomerVisits } from '../visits/CustomerVisits.jsx';

const EMIRATE = { AUH: 'Abu Dhabi', DXB: 'Dubai', SHJ: 'Sharjah', AJM: 'Ajman', UAQ: 'Umm Al Quwain', RAK: 'Ras Al Khaimah', FUJ: 'Fujairah' };
const Row = ({ label, children }) => <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 text-[13px] last:border-0"><span className="text-muted">{label}</span><span className="text-right">{children}</span></div>;
/** Customer detail: Overview (what the heartbeat says), Contracts, Payments, Tickets, Visits, Notes, History. */
export function CustomerPage() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast(); const { money, support, owner } = useRights();
  const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') || 'overview';
  const q = useQuery(() => customerService.get(id), [id]); const c = q.data?.customer;
  const [notes, setNotes] = useState({ NOTES: '', INSTALLER: '', ACTIVE: true }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (c) setNotes({ NOTES: c.NOTES || '', INSTALLER: c.INSTALLER || '', ACTIVE: !!c.ACTIVE }); }, [c]);
  const hist = useQuery(() => customerService.history(id), [id, tab], { enabled: tab === 'history' });
  const saveNotes = async () => { setBusy(true); try { await customerService.update(id, notes); toast('Saved', 'success'); q.refetch(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  if (q.error) return <ErrorBox error={q.error} />;
  if (!c) return <PageLoader title="Opening the customer" />;
  const tabs = [{ value: 'overview', label: 'Overview' }, { value: 'contracts', label: 'Contracts' }, ...(money ? [{ value: 'payments', label: 'Payments' }] : []), { value: 'tickets', label: 'Tickets', count: c.OPEN_TICKETS || undefined }, { value: 'visits', label: 'Visits' }, { value: 'notes', label: 'Notes' }, { value: 'history', label: 'History' }];
  return <div className="w-full">
    <button onClick={() => nav('/customers')} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />Party master</button>
    <PageHeader title={<span className="flex flex-wrap items-center gap-2">{c.SHOP_NAME}<Badge tone={c.STATUS === 'ACTIVE' ? 'ok' : 'bad'}>{c.STATUS}</Badge>{c.PLAN_CODE && <Badge tone="accent">{c.PLAN_CODE}</Badge>}{!c.ACTIVE && <Badge tone="bad">Left us</Badge>}</span>} subtitle={`${c.SHOP_CODE} · ${c.HDD || 'no code'} · ${c.SERVER_NAME ? `${c.SERVER_NAME} (${c.SERVER_CODE}) · ${c.OFFLINE ? 'server offline' : 'server online'} · last heartbeat ${rel(c.LAST_HEARTBEAT)}` : 'typed in Party master, no ERP link yet'}`}
      actions={<><Button variant="ghost" icon={Ticket} onClick={() => nav(`/tickets?new=${c.CUST_ID}`)} disabled={!support}>New ticket</Button><Button variant="ghost" icon={MapPinned} onClick={() => nav(`/visits?new=${c.CUST_ID}`)} disabled={!support}>New visit</Button><Button icon={FileSignature} onClick={() => setSp({ tab: 'contracts', new: '1' })} disabled={!money}>{c.AMC_NO ? 'Renew AMC' : 'New AMC'}</Button></>} />
    <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="kpi !p-3"><div className="text-[11.5px] uppercase tracking-wide text-muted">Licence ends</div><div className="mt-0.5 text-[15px] font-semibold"><Expiry date={c.LIC_END} days={c.LIC_DAYS} /></div><div className="text-[11.5px] text-faint">from {formatDate(c.LIC_START)} · {c.TILLS || '∞'} tills</div></div>
      <div className="kpi !p-3"><div className="text-[11.5px] uppercase tracking-wide text-muted">AMC</div><div className="mt-0.5 text-[15px] font-semibold">{c.AMC_NO ? <Expiry date={c.AMC_END} days={c.AMC_DAYS} /> : <span className="text-warn">No contract</span>}</div><div className="text-[11.5px] text-faint">{c.AMC_NO ? `${c.AMC_NO} · ${c.AMC_STATUS}` : 'Make one from the Contracts tab'}</div></div>
      {money && <div className="kpi !p-3"><div className="text-[11.5px] uppercase tracking-wide text-muted">Outstanding</div><div className={`num mt-0.5 text-[15px] font-semibold ${Number(c.OUTSTANDING) > 0 ? 'text-bad' : ''}`}>{formatAED(c.OUTSTANDING)}</div><div className="text-[11.5px] text-faint">across open invoices</div></div>}
      <div className="kpi !p-3"><div className="text-[11.5px] uppercase tracking-wide text-muted">Support</div><div className="mt-0.5 text-[15px] font-semibold">{c.OPEN_TICKETS || 0} open ticket{c.OPEN_TICKETS === 1 ? '' : 's'}</div><div className="text-[11.5px] text-faint">last used {rel(c.LAST_LOGIN)}</div></div>
    </div>
    <div className="mb-4"><Tabs value={tab} onChange={(t) => setSp({ tab: t })} tabs={tabs} /></div>
    {tab === 'overview' && <div className="grid gap-4 lg:grid-cols-3">
      <section className="card p-4"><div className="section-title"><Store className="h-3.5 w-3.5" />Licence (from the heartbeat)</div><Row label="Shop ID">{c.SHOP_CODE}</Row><Row label="Recognition code"><span className="font-mono">{c.HDD || '—'}</span></Row><Row label="Version">{c.PLAN_CODE || '—'}</Row><Row label="Status">{c.STATUS}</Row><Row label="Tills (max sessions)">{c.TILLS || 'unlimited'}</Row><Row label="Start">{formatDate(c.LIC_START) || '—'}</Row><Row label="End"><Expiry date={c.LIC_END} days={c.LIC_DAYS} /></Row><Row label="Installed by">{c.INSTALLER || '—'}</Row></section>
      <section className="card p-4"><div className="section-title"><Phone className="h-3.5 w-3.5" />Contact</div><Row label="Name">{c.CONTACT_NAME || '—'}</Row><Row label="Mobile"><a className="num text-accent hover:underline" href={c.MOBILE_NO ? `https://wa.me/${c.MOBILE_NO}` : undefined}>{displayMobile(c.MOBILE_NO) || '—'}</a></Row><Row label="E-mail"><span className="normal-case">{c.EMAIL_ID || '—'}</span></Row><Row label="Emirate">{EMIRATE[c.EMIRATE_CODE] || c.EMIRATE_CODE || '—'}</Row><Row label="Server">{c.SERVER_NAME ? `${c.SERVER_NAME} · ${c.SERVER_CODE}` : '—'}</Row><Row label="Link">{!c.SERVER_NAME ? <Badge>No ERP link</Badge> : c.OFFLINE ? <Badge tone="bad"><WifiOff className="mr-1 h-3 w-3" />Offline</Badge> : <Badge tone="ok"><Wifi className="mr-1 h-3 w-3" />Online</Badge>}</Row><Row label="Last heartbeat">{formatDateTime(c.LAST_HEARTBEAT) || '—'}</Row></section>
      <section className="card p-4"><div className="section-title"><Activity className="h-3.5 w-3.5" />Use</div><Row label="Users">{c.USERS ?? '—'}</Row><Row label="Last sign-in">{formatDateTime(c.LAST_LOGIN) || '—'}</Row><Row label="Entries today">{c.ENTRIES_TODAY ?? '—'}</Row><Row label="Entries, 30 days">{c.ENTRIES_30D ?? '—'}</Row><Row label="First seen">{formatDate(c.ENTRY_DATE)}</Row><Row label="Last seen in a heartbeat">{rel(c.LAST_SEEN)}</Row></section>
    </div>}
    {tab === 'contracts' && <CustomerContracts customer={c} onChange={q.refetch} openNew={sp.get('new') === '1'} />}
    {tab === 'payments' && money && <CustomerPayments customer={c} onChange={q.refetch} />}
    {tab === 'tickets' && <CustomerTickets customer={c} onChange={q.refetch} />}
    {tab === 'visits' && <CustomerVisits customer={c} onChange={q.refetch} />}
    {tab === 'notes' && <form className="card max-w-2xl p-5" onSubmit={(e) => { e.preventDefault(); saveNotes(); }}><div className="section-title">Our notes — the only things typed here</div><div className="space-y-3"><Textarea label="Notes" rows={6} value={notes.NOTES} onChange={(e) => setNotes({ ...notes, NOTES: e.target.value })} placeholder="How to reach them, what was promised, quirks of the install…" /><Input label="Installed by (initials)" value={notes.INSTALLER} onChange={(e) => setNotes({ ...notes, INSTALLER: e.target.value })} className="max-w-[200px]" hint="Pre-filled from the last two letters of the code" /><div className="rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Current customer" hint="Off when they stop using the ERP — hidden from the default list and from reminders" checked={notes.ACTIVE} onChange={(v) => setNotes({ ...notes, ACTIVE: v })} disabled={!owner && !support} /></div></div><div className="mt-4 flex justify-end"><Button type="submit" icon={Save} loading={busy} disabled={!support}>Save</Button></div></form>}
    {tab === 'history' && <DataTable rows={hist.data?.rows || []} loading={hist.loading} rowKey={(r) => r} columns={[{ key: 'D', label: 'Date', render: (r) => <span className="num">{formatDate(r.D)}</span> }, { key: 'KIND', label: 'What', render: (r) => <Badge tone={{ CONTRACT: 'accent', INVOICE: 'info', PAYMENT: 'ok', TICKET: 'warn', VISIT: 'muted', REMINDER: 'muted', UPGRADE: 'accent' }[r.KIND]}>{r.KIND}</Badge> }, { key: 'REF', label: 'Ref' }, { key: 'TEXT', label: 'Detail', render: (r) => <span className="normal-case">{r.TEXT}</span> }, ...(money ? [{ key: 'AMOUNT', label: 'Amount', align: 'right', render: (r) => (r.AMOUNT != null ? formatAED(r.AMOUNT) : '') }] : [])].map((c) => ({ ...c }))} emptyTitle="Nothing yet" />}
  </div>;
}
