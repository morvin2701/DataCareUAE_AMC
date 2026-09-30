import { useState } from 'react';
import { Plus } from 'lucide-react';
import { visitService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Controls.jsx';
import { VisitDialog } from './VisitDialog.jsx';
import { VTONE } from './VisitsPage.jsx';
import { formatDate } from '../../lib/fmt.js';
export function CustomerVisits({ customer, onChange }) {
  const { support } = useRights(); const list = useQuery(() => visitService.list({ custId: customer.CUST_ID }), [customer.CUST_ID]); const rows = list.data?.rows || []; const [dlg, setDlg] = useState(null);
  return <div className="space-y-3">{support && <div className="flex justify-end"><Button icon={Plus} onClick={() => setDlg({})}>Plan a visit</Button></div>}
    <DataTable rows={rows} loading={list.loading} rowKey="VISIT_ID" onRowClick={(v) => setDlg({ visit: v })} columns={[{ key: 'VISIT_DATE', label: 'Date', render: (v) => <span className="num">{formatDate(v.VISIT_DATE)}{v.VISIT_TIME ? ` ${v.VISIT_TIME}` : ''}</span> }, { key: 'PURPOSE', label: 'Purpose', primary: true, render: (v) => <span className="normal-case">{v.PURPOSE}</span> }, { key: 'ENGINEER_NAME', label: 'Engineer', render: (v) => v.ENGINEER_NAME || '—' }, { key: 'TICKET_NO', label: 'Ticket', render: (v) => v.TICKET_NO || '—' }, { key: 'STATUS', label: 'Status', render: (v) => <Badge tone={VTONE[v.STATUS]}>{v.STATUS}</Badge> }, { key: 'MINUTES', label: 'Min', align: 'right' }, { key: 'TRAVEL_KM', label: 'Km', align: 'right' }, { key: 'SIGNED_BY', label: 'Signed by' }]} emptyTitle="No visits" />
    <VisitDialog open={!!dlg} onClose={() => setDlg(null)} custId={customer.CUST_ID} visit={dlg?.visit} onSaved={() => { list.refetch(); onChange?.(); }} />
  </div>;
}
