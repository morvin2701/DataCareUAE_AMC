import { Badge } from '../../components/ui/Controls.jsx';
export const STATUS_TONE = { DRAFT: 'warn', LIVE: 'ok', EXPIRED: 'muted', CANCELLED: 'bad' };
export const PushBadge = ({ k }) => !k.PUSH_STATUS ? <span className="text-faint">—</span> : <Badge tone={k.PUSH_STATUS === 'DONE' ? 'ok' : k.PUSH_STATUS === 'PENDING' ? 'warn' : 'bad'} className="cursor-help" >{({ DONE: 'Pushed', PENDING: 'Queued', FAILED: 'Failed' })[k.PUSH_STATUS]}</Badge>;
