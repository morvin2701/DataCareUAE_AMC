import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ticketService } from '../../services/amcService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useRights } from '../../app/AuthContext.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { NewTicketDialog } from './TicketDialogs.jsx';
import { TicketDrawer } from './TicketDrawer.jsx';
import { Sla, PrioBadge, StatusBadge } from './ticketUi.jsx';
import { formatDateTime } from '../../lib/fmt.js';
export function CustomerTickets({ customer, onChange }) {
  const { support } = useRights(); const list = useQuery(() => ticketService.list({ custId: customer.CUST_ID }), [customer.CUST_ID]); const rows = list.data?.rows || [];
  const [add, setAdd] = useState(false); const [openId, setOpenId] = useState(null); const done = () => { list.refetch(); onChange?.(); };
  return <div className="space-y-3">{support && <div className="flex justify-end"><Button icon={Plus} onClick={() => setAdd(true)}>New ticket</Button></div>}
    <DataTable rows={rows} loading={list.loading} rowKey="TICKET_ID" onRowClick={(t) => setOpenId(t.TICKET_ID)} columns={[{ key: 'TICKET_NO', label: 'Ticket', render: (t) => <span className="font-mono text-[12.5px]">{t.TICKET_NO}</span> }, { key: 'TITLE', label: 'Title', primary: true, render: (t) => <span className="normal-case">{t.TITLE}</span> }, { key: 'PRIORITY', label: 'Priority', render: (t) => <PrioBadge p={t.PRIORITY} /> }, { key: 'STATUS', label: 'Status', render: (t) => <StatusBadge s={t.STATUS} /> }, { key: 'SLA', label: 'SLA', render: (t) => <Sla t={t} /> }, { key: 'ASSIGNED_NAME', label: 'Assigned', render: (t) => t.ASSIGNED_NAME || <span className="text-faint">—</span> }, { key: 'OPENED_AT', label: 'Opened', render: (t) => <span className="num">{formatDateTime(t.OPENED_AT)}</span> }, { key: 'MINUTES_SPENT', label: 'Min', align: 'right' }]} emptyTitle="No tickets" />
    <NewTicketDialog open={add} onClose={() => setAdd(false)} custId={customer.CUST_ID} onSaved={(t) => { done(); setOpenId(t.TICKET_ID); }} />
    <TicketDrawer id={openId} onClose={() => setOpenId(null)} onChange={done} />
  </div>;
}
