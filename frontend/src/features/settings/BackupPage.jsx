import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DatabaseBackup, Cloud, CloudOff, Play } from 'lucide-react';
import { backupService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { PageHeader, Toggle, Badge, ErrorBox } from '../../components/ui/Controls.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime } from '../../lib/fmt.js';
const mb = (b) => (b == null ? '—' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
/** Data backup (owner): SQL backup of DcAmc to the folder on the server, daily at a time, keep N, optional Google Drive copy. */
export function BackupPage() {
  const toast = useToast(); const [sp] = useSearchParams(); const st = useQuery(() => backupService.status(), []); const [s, setS] = useState(null); const [busy, setBusy] = useState('');
  useEffect(() => { if (st.data) setS(st.data.settings); }, [st.data]);
  useEffect(() => { if (sp.get('drive') === 'connected') toast('Google Drive connected', 'success'); }, []); // eslint-disable-line
  const save = async () => { setBusy('save'); try { await backupService.save({ value: s }); toast('Saved', 'success'); st.refetch(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); } };
  const run = async () => { setBusy('run'); try { const r = await backupService.run(); toast(`Backup written: ${r.log.FILE_PATH}`, 'success', 6000); st.refetch(); } catch (e) { toast(e.message, 'error', 8000); st.refetch(); } finally { setBusy(''); } };
  const connect = async () => { try { const r = await backupService.driveConnect(); window.location.href = r.url; } catch (e) { toast(e.message, 'warn', 6000); } };
  const disconnect = async () => { try { await backupService.driveDisconnect(); toast('Google Drive disconnected', 'success'); st.refetch(); } catch (e) { toast(e.message, 'error'); } };
  return <div className="w-full">
    <PageHeader title="Data backup" subtitle={`SQL Server writes a .bak of DcAmc into ${st.data?.path || 'the backup folder'} on the server. Automatic backups keep the newest few; every backup can also go to Google Drive.`} actions={<Button icon={Play} loading={busy === 'run'} onClick={run}>Back up now</Button>} />
    <ErrorBox error={st.error} />
    <div className="grid gap-4 lg:grid-cols-2">
      {s && <form className="card p-5" onSubmit={(e) => { e.preventDefault(); save(); }}><div className="section-title"><DatabaseBackup className="h-3.5 w-3.5" />Automatic backup</div><div className="rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Back up every day" checked={!!s.autoOn} onChange={(v) => setS({ ...s, autoOn: v })} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input label="At (Dubai time)" type="time" value={s.time} onChange={(e) => setS({ ...s, time: e.target.value })} /><Input label="Keep the newest" type="number" min="1" max="60" value={s.keep} onChange={(e) => setS({ ...s, keep: e.target.value })} hint="automatic files on disk and on Drive" /></div><div className="mt-4 flex justify-end"><Button type="submit" loading={busy === 'save'}>Save</Button></div></form>}
      {s && <section className="card p-5"><div className="section-title"><Cloud className="h-3.5 w-3.5" />Google Drive</div>{!s.driveConfigured ? <p className="text-[13px] normal-case text-muted">Not set up on this server: put GDRIVE_OAUTH_CLIENT_ID, GDRIVE_OAUTH_CLIENT_SECRET and APP_BASE_URL in the backend .env (redirect URI = APP_BASE_URL/api/backup/drive/callback).</p> : s.driveConnected ? <><p className="text-[13px] normal-case"><Badge tone="ok">Connected</Badge> {s.driveEmail} · folder “DcAMC Backups”</p><div className="mt-3 rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Copy every backup to Drive" checked={!!s.driveOn} onChange={(v) => setS({ ...s, driveOn: v })} /></div><div className="mt-3 flex gap-2"><Button variant="ghost" onClick={save} loading={busy === 'save'}>Save</Button><Button variant="ghost" icon={CloudOff} onClick={disconnect}>Disconnect</Button></div></> : <><p className="text-[13px] normal-case text-muted">Connect DataCare's Google account once; backups then go to a “DcAMC Backups” folder there.</p><div className="mt-3"><Button icon={Cloud} onClick={connect}>Connect Google Drive</Button></div></>}</section>}
    </div>
    <div className="mt-4"><div className="section-title">Backups</div><DataTable rows={st.data?.rows || []} loading={st.loading} rowKey="BK_ID" columns={[{ key: 'START_TIME', label: 'When', render: (b) => <span className="num whitespace-nowrap">{formatDateTime(b.START_TIME)}</span> }, { key: 'KIND', label: 'Kind' }, { key: 'STATUS', label: 'Status', render: (b) => <Badge tone={b.STATUS === 'OK' ? 'ok' : b.STATUS === 'FAILED' ? 'bad' : 'warn'}>{b.STATUS}</Badge> }, { key: 'FILE_PATH', label: 'File', render: (b) => <span className="font-mono text-[11.5px] normal-case">{b.FILE_PATH || '—'}</span> }, { key: 'BYTES', label: 'Size', align: 'right', render: (b) => mb(b.BYTES) }, { key: 'DRIVE_STATUS', label: 'Drive', render: (b) => b.DRIVE_STATUS ? <Badge tone={b.DRIVE_STATUS === 'OK' ? 'ok' : 'bad'}>{b.DRIVE_STATUS}</Badge> : '—' }, { key: 'ERROR_MSG', label: 'Note', render: (b) => <span className="block max-w-[360px] truncate normal-case text-muted" title={b.ERROR_MSG || ''}>{b.ERROR_MSG || ''}</span> }, { key: 'USER_NAME', label: 'By', render: (b) => b.USER_NAME || 'scheduler' }]} emptyTitle="No backups yet" /></div>
  </div>;
}
