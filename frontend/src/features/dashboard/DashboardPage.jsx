import { useAuth } from '../../app/AuthContext.jsx';
import { formatDate, today } from '../../lib/fmt.js';
export function DashboardPage() {
  const { session } = useAuth(); const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <div className="w-full"><div className="mb-5"><h1 className="text-[22px] font-semibold tracking-tight">{greet}, {session?.user?.USER_NAME?.split(' ')[0]}</h1><p className="mt-0.5 text-[12px] text-muted">DataCare AMC · {formatDate(today())}</p></div><div className="card p-8 text-center text-[13px] normal-case text-muted">The dashboard fills in once customers arrive from heartbeats.</div></div>;
}
