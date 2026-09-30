import { useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { findMenu } from '../app/menu.js';
export function Placeholder() { const loc = useLocation(); const m = findMenu(loc.pathname); return <div className="card flex flex-col items-center gap-2 p-12 text-center"><Hammer className="h-6 w-6 text-faint" /><p className="font-display text-[16px] font-bold">{m?.item?.label || 'This screen'}</p><p className="text-[12.5px] normal-case text-muted">Coming in a later step.</p></div>; }
