import { useState } from 'react';
import { Plus, KeyRound, RefreshCw, Copy, Check, Wifi, WifiOff, ListRestart, Radio } from 'lucide-react';
import { serverService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Badge, Toggle, ConfirmDialog, ErrorBox } from '../../components/ui/Controls.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { rel, formatDateTime } from '../../lib/fmt.js';

/** Shown once: the link key the customer's ERP puts in its .env as AMC_KEY. */
function KeyBox({ open, onClose, data }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(data?.key || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return <Modal open={open} onClose={onClose} title="Link key — shown once" size="md" footer={<Button onClick={onClose}>Done, I have saved it</Button>}>
    <div className="space-y-3 normal-case">
      <p className="text-[13px] text-muted">Put these two lines in <code>C:\DataCare\app\backend\.env</code> on <b>{data?.server?.NAME}</b> and restart the DataCareApi service. DcAMC keeps only a hash — this key cannot be shown again, only replaced.</p>
      <pre className="overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-[12.5px]">{`AMC_URL=${window.location.origin}\nAMC_KEY=${data?.key || ''}`}</pre>
      <Button variant="ghost" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy the key'}</Button>
    </div>
  </Modal>;
}
/** Settings → Servers & link keys (also the Customers → Servers screen): the customers' ERP servers, one key each, the push queue. */
export function ServersPanel() {
  const toast = useToast(); const { owner } = useRights();
  const list = useQuery(() => serverService.list(), []); const rows = list.data?.rows || [];
  const [add, setAdd] = useState(null); const [edit, setEdit] = useState(null); const [key, setKey] = useState(null); const [rotate, setRotate] = useState(null); const [queue, setQueue] = useState(null); const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); try { const r = await serverService.create(add); setAdd(null); setKey(r); list.refetch(); } catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); } };
  const save = async () => { setBusy(true); try { await serverService.update(edit.SERVER_ID, { name: edit.NAME, baseUrl: edit.BASE_URL || '', active: edit.ACTIVE }); setEdit(null); list.refetch(); toast('Server saved', 'success'); } catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); } };
  const doRotate = async () => { setBusy(true); try { const r = await serverService.rotate(rotate.SERVER_ID); setKey({ ...r, server: rotate }); setRotate(null); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  const test = async (s) => { try { const r = await serverService.test(s.SERVER_ID); toast(r.ok ? `${s.NAME}: ${r.answer}${r.version ? ` (ERP ${r.version})` : ''}` : `${s.NAME}: ${r.answer}`, r.ok ? 'success' : 'warn', 6000); } catch (e) { toast(e.message, 'error'); } };
  const openQueue = async (s) => { try { setQueue(await serverService.queue(s.SERVER_ID)); } catch (e) { toast(e.message, 'error'); } };
  const retry = async () => { setBusy(true); try { const r = await serverService.retry(queue.server.SERVER_ID); toast(`${r.done} push(es) delivered`, r.done ? 'success' : 'info'); setQueue(await serverService.queue(queue.server.SERVER_ID)); list.refetch(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12.5px] normal-case text-muted">One link key per customer server. The ERP posts a heartbeat every 24 h; a server silent for 48 h shows as offline. Licence pushes that could not be delivered wait in the queue and go out on the next heartbeat.</p>{owner && <Button icon={Plus} onClick={() => setAdd({ name: '', baseUrl: '' })}>Add server</Button>}</div>
    <ErrorBox error={list.error} />
    <DataTable rows={rows} loading={list.loading} rowKey="SERVER_ID" onRowClick={owner ? (s) => setEdit({ ...s }) : undefined} columns={[
      { key: 'SERVER_CODE', label: 'Code', render: (s) => <span className="font-mono text-[12.5px]">{s.SERVER_CODE}</span> },
      { key: 'NAME', label: 'Server', primary: true, render: (s) => <div><div className="font-medium">{s.NAME}</div><div className="text-[11.5px] normal-case text-muted">{s.BASE_URL || <span className="text-warn">no address — pushes will queue</span>}</div></div> },
      { key: 'OFFLINE', label: 'Link', render: (s) => s.OFFLINE ? <Badge tone={s.LAST_HEARTBEAT ? 'bad' : 'muted'}><WifiOff className="mr-1 h-3 w-3" />{s.LAST_HEARTBEAT ? 'Offline' : 'Never seen'}</Badge> : <Badge tone="ok"><Wifi className="mr-1 h-3 w-3" />Online</Badge> },
      { key: 'LAST_HEARTBEAT', label: 'Last heartbeat', render: (s) => <span title={formatDateTime(s.LAST_HEARTBEAT)}>{rel(s.LAST_HEARTBEAT)}</span> },
      { key: 'APP_VERSION', label: 'ERP version', hideBelow: 'lg', render: (s) => <span className="font-mono text-[12px] normal-case">{s.APP_VERSION || '—'}</span> },
      { key: 'PENDING_SCRIPTS', label: 'Scripts pending', align: 'center', hideBelow: 'lg', render: (s) => s.PENDING_SCRIPTS ? <Badge tone="warn">{s.PENDING_SCRIPTS}</Badge> : '0' },
      { key: 'SHOPS', label: 'Shops', align: 'center' },
      { key: 'QUEUED', label: 'Queued', align: 'center', render: (s) => s.QUEUED ? <Badge tone="warn">{s.QUEUED}</Badge> : '0' },
      { key: 'ACTIVE', label: 'Status', render: (s) => <Badge tone={s.ACTIVE ? 'ok' : 'bad'}>{s.ACTIVE ? 'Active' : 'Off'}</Badge> },
      { key: 'ACTIONS', label: '', render: (s) => <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>{owner && <button className="btn-ghost !h-7 !px-2 !text-[12px]" title="Ping the ERP with this key" onClick={() => test(s)}><Radio className="h-3.5 w-3.5" /></button>}<button className="btn-ghost !h-7 !px-2 !text-[12px]" title="Push queue" onClick={() => openQueue(s)}><ListRestart className="h-3.5 w-3.5" /></button>{owner && <button className="btn-ghost !h-7 !px-2 !text-[12px]" title="New link key" onClick={() => setRotate(s)}><KeyRound className="h-3.5 w-3.5" /></button>}</span> },
    ]} emptyTitle="No servers yet" emptyHint="Add a customer's server to get its link key; its ERP then posts heartbeats here and the shops appear under Customers." />
    <Modal open={!!add} onClose={() => setAdd(null)} title="Add a customer server" size="sm" footer={<><Button variant="ghost" onClick={() => setAdd(null)}>Cancel</Button><Button loading={busy} onClick={create}>Create and show the key</Button></>}>
      {add && <div className="space-y-3"><Input label="Name" autoFocus value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Customer or machine name" onKeyDown={(e) => e.key === 'Enter' && create()} /><Input label="ERP address (for licence pushes)" type="url" value={add.baseUrl} onChange={(e) => setAdd({ ...add, baseUrl: e.target.value })} placeholder="https://erp.customer.ae" hint="Where that server's /api answers. Can be filled later." onKeyDown={(e) => e.key === 'Enter' && create()} /></div>}
    </Modal>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.SERVER_CODE} · ${edit?.NAME}`} size="sm" footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      {edit && <div className="space-y-3"><Input label="Name" value={edit.NAME} onChange={(e) => setEdit({ ...edit, NAME: e.target.value })} /><Input label="ERP address" type="url" value={edit.BASE_URL || ''} onChange={(e) => setEdit({ ...edit, BASE_URL: e.target.value })} placeholder="https://erp.customer.ae" /><div className="rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Active" hint="Off: its heartbeats are refused and nothing is pushed" checked={edit.ACTIVE} onChange={(v) => setEdit({ ...edit, ACTIVE: v })} /></div><div className="text-[12px] normal-case text-muted">Host {edit.HOSTNAME || '—'} · IP {edit.IP || '—'} · ERP {edit.APP_VERSION || '—'}</div></div>}
    </Modal>
    <ConfirmDialog open={!!rotate} onClose={() => setRotate(null)} onConfirm={doRotate} busy={busy} title={`New link key for ${rotate?.NAME}?`} message="The old key stops working at once. The customer's ERP .env must get the new AMC_KEY before its next heartbeat." confirmLabel="Make a new key" icon={RefreshCw} />
    <KeyBox open={!!key} onClose={() => setKey(null)} data={key} />
    <Modal open={!!queue} onClose={() => setQueue(null)} title={`Push queue · ${queue?.server?.NAME}`} size="lg" footer={<>{owner && <Button variant="ghost" icon={ListRestart} loading={busy} onClick={retry}>Retry now</Button>}<Button onClick={() => setQueue(null)}>Close</Button></>}>
      {queue && <DataTable rows={queue.rows} rowKey="PUSH_ID" columns={[{ key: 'SHOP_CODE', label: 'Shop', render: (q) => <div><div>{q.SHOP_NAME}</div><div className="text-[11.5px] text-muted">{q.SHOP_CODE}</div></div> }, { key: 'PAYLOAD', label: 'Licence', render: (q) => <span className="font-mono text-[11.5px] normal-case">{q.PAYLOAD}</span> }, { key: 'STATUS', label: 'Status', render: (q) => <Badge tone={q.STATUS === 'DONE' ? 'ok' : q.STATUS === 'FAILED' ? 'bad' : 'warn'}>{q.STATUS}</Badge> }, { key: 'TRIES', label: 'Tries', align: 'center' }, { key: 'LAST_ERROR', label: 'Last answer', render: (q) => <span className="block max-w-[260px] truncate normal-case text-muted" title={q.LAST_ERROR || ''}>{q.LAST_ERROR || '—'}</span> }, { key: 'LAST_TRY', label: 'Last try', render: (q) => rel(q.LAST_TRY) }]} emptyTitle="Nothing queued" />}
    </Modal>
  </div>;
}
export function ServersPage() { return <div className="w-full"><div className="mb-4"><h1 className="font-display text-[20px] font-bold tracking-tight">Servers</h1></div><ServersPanel /></div>; }
