import { useState } from 'react';
import { settingsService } from '../../services/authService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { PageHeader, SearchBox, Segmented, ErrorBox } from '../../components/ui/Controls.jsx';
import { DataTable, Pager } from '../../components/ui/DataTable.jsx';
import { formatDateTime } from '../../lib/fmt.js';
/** Audit log viewer (owner): every write, newest first; and the sign-in log. */
export function AuditPage() {
  const [kind, setKind] = useState('audit'); const [q, setQ] = useState(''); const dq = useDebounce(q); const [page, setPage] = useState(1);
  const r = useQuery(() => (kind === 'audit' ? settingsService.audit({ q: dq, page, pageSize: 50 }) : settingsService.loginLog({ page, pageSize: 50 })), [kind, dq, page]);
  const rows = r.data?.rows || [];
  return <div className="w-full">
    <PageHeader title="Audit log" subtitle="Who changed what, and when. Nothing in DcAMC can switch this off." actions={<><Segmented value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: 'audit', label: 'Changes' }, { value: 'login', label: 'Sign-ins' }]} />{kind === 'audit' && <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Table, action, user, key…" className="w-64" />}</>} />
    <ErrorBox error={r.error} />
    {kind === 'audit' ? <DataTable rows={rows} loading={r.loading} rowKey="LOG_ID" columns={[{ key: 'LOG_TIME', label: 'When', render: (x) => <span className="num whitespace-nowrap">{formatDateTime(x.LOG_TIME)}</span> }, { key: 'LOGIN_NAME', label: 'User', render: (x) => x.USER_NAME || <span className="text-faint">system</span> }, { key: 'TABLE_NAME', label: 'Table' }, { key: 'REC_KEY', label: 'Key' }, { key: 'ACTION', label: 'Action' }, { key: 'DETAIL', label: 'Detail', hideBelow: 'md', render: (x) => <span className="block max-w-[520px] truncate font-mono text-[11.5px] normal-case text-muted" title={x.DETAIL || ''}>{x.DETAIL}</span> }]} footer={<Pager page={page} pageSize={50} total={r.data?.total || 0} onPage={setPage} />} />
      : <DataTable rows={rows} loading={r.loading} rowKey="LOG_ID" columns={[{ key: 'LOG_TIME', label: 'When', render: (x) => <span className="num whitespace-nowrap">{formatDateTime(x.LOG_TIME)}</span> }, { key: 'LOGIN_NAME', label: 'Login', render: (x) => <span className="normal-case">{x.LOGIN_NAME}</span> }, { key: 'RESULT', label: 'Result' }, { key: 'IP_ADDR', label: 'IP' }, { key: 'USER_AGENT', label: 'Device', hideBelow: 'md', render: (x) => <span className="block max-w-[420px] truncate normal-case text-muted">{x.USER_AGENT}</span> }]} footer={<Pager page={page} pageSize={50} total={r.data?.total || 0} onPage={setPage} />} />}
  </div>;
}
