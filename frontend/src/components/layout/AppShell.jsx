import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import { Sidebar } from './Sidebar.jsx';
import { APP_NAME } from '../ui/Logo.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { CommandPalette } from '../ui/CommandPalette.jsx';
import { RouteProgress } from '../ui/Loading.jsx';
import { useAuth, useRights } from '../../app/AuthContext.jsx';
import { useIdleLogout } from '../../hooks/useIdleLogout.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { MENU, findMenu, allowed } from '../../app/menu.js';
import { kb } from '../../lib/platform.js';

export function AppShell() {
  const { session, logout } = useAuth(); const { role } = useRights();
  const nav = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false);
  const onIdle = useCallback(() => logout('idle'), [logout]);
  const { secondsLeft, stayActive } = useIdleLogout({ idleMinutes: session?.idleMinutes ?? 15, enabled: true, onLogout: onIdle });
  const here = findMenu(loc.pathname);
  const [routing, setRouting] = useState(false);
  useEffect(() => { setRouting(true); const t = setTimeout(() => setRouting(false), 450); return () => clearTimeout(t); }, [loc.pathname]);
  useEffect(() => { document.title = `${here?.item?.label || 'Home'} · ${APP_NAME}`; setOpen(false); }, [loc.pathname]); // eslint-disable-line
  /* from any screen: Alt+C customers, Alt+T tickets, Alt+V visits, Alt+D dashboard */
  useHotkeys({ 'alt+c': () => nav('/customers'), 'alt+t': () => nav('/tickets'), 'alt+v': () => nav('/visits'), 'alt+d': () => nav('/') }, [nav]);
  const commands = MENU.flatMap((g) => g.items.filter((i) => allowed(i, role)).map((i) => ({ label: i.label, to: i.to, icon: i.icon, group: g.label, keywords: i.keywords })));
  return (
    <div className="flex min-h-full">
      <Sidebar session={session} role={role} open={open} onClose={() => setOpen(false)} onLogout={() => logout()} />
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative sticky top-0 z-20 border-b border-line bg-surface">
          <RouteProgress active={routing} />
          <div className="flex h-12 items-center gap-2 px-4 sm:px-6">
            <button className="btn-ghost !h-8 !w-8 !px-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-4 w-4" /></button>
            <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted" aria-label="Breadcrumb">{here ? <><span className="hidden sm:inline">{here.group.label}</span><ChevronRight className="hidden h-3.5 w-3.5 sm:inline" /><span className="truncate font-medium text-ink">{here.item.label}</span></> : <span className="font-medium text-ink">Home</span>}</nav>
            <div className="ml-auto hidden items-center gap-1.5 text-[11.5px] text-faint md:flex" title="Keyboard shortcuts"><kbd className="kbd">{kb('K')}</kbd> search <kbd className="kbd ml-2">Alt C</kbd> customers <kbd className="kbd ml-2">Alt T</kbd> tickets <kbd className="kbd ml-2">Alt V</kbd> visits</div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6"><Outlet /></main>
      </div>
      <CommandPalette commands={[...commands, { label: 'Sign out', run: () => logout(), group: 'Session' }]} />
      <Modal open={secondsLeft !== null} title="Still there?" size="sm" footer={<><Button variant="ghost" onClick={() => logout()}>Sign out</Button><Button onClick={stayActive} autoFocus>Stay signed in</Button></>}>
        <div className="flex items-center gap-4"><div className="num flex h-12 w-12 items-center justify-center rounded-full bg-warn/15 text-[20px] font-bold text-warn">{secondsLeft}</div><p className="text-[13.5px] normal-case text-muted">No activity for {session?.idleMinutes} minutes. You will be signed out automatically.</p></div>
      </Modal>
    </div>
  );
}
