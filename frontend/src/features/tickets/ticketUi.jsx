import { Badge } from '../../components/ui/Controls.jsx';
export const PRIORITIES = [['LOW', 'Low'], ['NORMAL', 'Normal'], ['HIGH', 'High'], ['URGENT', 'Urgent']];
export const STATUSES = [['OPEN', 'Open'], ['IN_PROGRESS', 'In progress'], ['WAITING', 'Waiting'], ['CLOSED', 'Closed']];
export const CHANNELS = [['CALL', 'Call'], ['WHATSAPP', 'WhatsApp'], ['EMAIL', 'E-mail'], ['VISIT', 'Visit']];
export const PRIO_TONE = { LOW: 'muted', NORMAL: 'info', HIGH: 'warn', URGENT: 'bad' }; export const STATUS_TONE = { OPEN: 'warn', IN_PROGRESS: 'info', WAITING: 'muted', CLOSED: 'ok' };
export const statusLabel = (s) => STATUSES.find((x) => x[0] === s)?.[1] || s;
/** SLA timer: time left to the deadline, or how far past it. */
export function Sla({ t }) {
  if (t.STATUS === 'CLOSED') return <span className="text-[11.5px] text-faint">closed</span>;
  const m = Number(t.MINUTES_TO_DUE); const a = Math.abs(m); const txt = a >= 1440 ? `${Math.floor(a / 1440)} d ${Math.floor((a % 1440) / 60)} h` : a >= 60 ? `${Math.floor(a / 60)} h ${a % 60} m` : `${a} m`;
  return <Badge tone={m < 0 ? 'bad' : m < 120 ? 'warn' : 'ok'} className="num">{m < 0 ? `${txt} over` : `${txt} left`}</Badge>;
}
export const PrioBadge = ({ p }) => <Badge tone={PRIO_TONE[p]}>{p}</Badge>;
export const StatusBadge = ({ s }) => <Badge tone={STATUS_TONE[s]}>{statusLabel(s)}</Badge>;
