import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Sun, Search, X, PanelLeftClose, PanelLeftOpen, UserCircle2 } from 'lucide-react';
import { APP_NAME, COMPANY } from '../ui/Logo.jsx';
import { MENU, allowed } from '../../app/menu.js';
import { useTheme } from '../../hooks/useTheme.js';
import { toggleTheme } from '../../lib/theme.js';
import { ConfirmDialog } from '../ui/Controls.jsx';
import { kb, keys } from '../../lib/platform.js';
import { initials } from '../../lib/fmt.js';

const KEY_OPEN = 'dcamc.nav.open', KEY_MINI = 'dcamc.nav.mini';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const openPalette = () => window.dispatchEvent(new Event('palette:open'));
const ROLE_LABEL = { OWNER: 'Owner', ACCOUNTS: 'Accounts', SUPPORT: 'Support' };
const Mark = ({ size = 30 }) => <img src="/logo.png" width={size} height={size} alt="" aria-hidden className="shrink-0 object-contain" draggable={false} />;
function Items({ items, guide = true }) {
  return <div className={`space-y-1 ${guide ? 'sb-items' : ''}`}>{items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `sb-item ${isActive ? 'sb-item-active' : ''}`}><span className="sb-ico"><Icon className="h-3.5 w-3.5" /></span><span className="flex-1 truncate">{label}</span></NavLink>)}</div>;
}
function Flyout({ title, children, onClose }) {
  const ref = useRef(null);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.top = '0px'; const r = el.getBoundingClientRect(); const over = r.bottom - (window.innerHeight - 8); if (over > 0) el.style.top = `${-Math.min(over, Math.max(0, r.top - 8))}px`; }, []);
  return <div ref={ref} className="sb absolute left-full top-0 z-50 ml-1 min-w-[224px] overflow-y-auto rounded-lg border p-2 shadow-pop anim-pop" style={{ maxHeight: 'calc(100vh - 16px)' }} onClick={onClose}>{title && <div className="sb-group !h-7 !px-2.5">{title}</div>}{children}</div>;
}
export function Sidebar({ session, role, open, onClose, onLogout }) {
  const [askLogout, setAskLogout] = useState(false);
  const loc = useLocation(); const nav = useNavigate(); const { theme } = useTheme();
  const [openGroup, setOpenGroup] = useState(() => load(KEY_OPEN, '')); const [mini, setMini] = useState(() => load(KEY_MINI, false));
  const [fly, setFly] = useState(null); const leaveTimer = useRef(null);
  const toggleGroup = (k) => setOpenGroup((cur) => { const n = cur === k ? '' : k; save(KEY_OPEN, n); return n; });
  const toggleMini = () => setMini((m) => { save(KEY_MINI, !m); return !m; });
  const enter = (k) => { clearTimeout(leaveTimer.current); setFly(k); }; const leave = () => { leaveTimer.current = setTimeout(() => setFly(null), 140); };
  const groups = MENU.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i, role)) })).filter((g) => g.items.length);
  const inGroup = (g) => g.items.some((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));
  useEffect(() => { const g = groups.find(inGroup); if (g && g.key !== openGroup) { setOpenGroup(g.key); save(KEY_OPEN, g.key); } }, [loc.pathname]); // eslint-disable-line
  const isMini = mini && !open; const ini = initials(session?.user?.USER_NAME);
  return (
    <aside className={`sb fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isMini ? 'w-[64px]' : 'w-[240px]'} ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex h-[58px] items-center border-b ${isMini ? 'justify-center' : 'justify-between px-3'}`} style={{ borderColor: 'rgb(var(--sb-line) / .7)' }}>
        {isMini ? <button onClick={toggleMini} title="Expand sidebar" className="sb-rail h-11 w-11 !border-transparent !bg-transparent"><Mark size={30} /></button> : (<>
          <div className="flex items-center gap-2.5 px-1"><Mark /><div className="min-w-0 leading-tight" title={COMPANY}><div className="truncate text-[15px] font-semibold tracking-tight" style={{ color: 'rgb(var(--sb-fg))' }}>{APP_NAME}</div><div className="truncate text-[11px] font-medium uppercase tracking-[.08em]" style={{ color: 'rgb(var(--sb-muted))' }}>DataCare AMC</div></div></div>
          <button className="sb-iconbtn hidden lg:flex" onClick={toggleMini} title="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></button>
          <button className="sb-iconbtn lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-4 w-4" /></button></>)}
      </div>
      <div className={isMini ? 'flex justify-center py-2' : 'px-3 py-2.5'}>
        {isMini ? <button onClick={openPalette} className="sb-rail h-11 w-11" title={`Search (${kb('K')})`}><Search className="h-4 w-4" /></button>
          : <button type="button" className="sb-search" onClick={openPalette} title={`Search screens and actions (${kb('K')})`}><Search className="h-3.5 w-3.5 shrink-0 opacity-70" /><span className="min-w-0 flex-1 truncate text-left">Search…</span><span className="sb-kbds" aria-hidden="true">{keys('K').map((k) => <kbd key={k} className="sb-kbd">{k}</kbd>)}</span></button>}
      </div>
      <nav className={`flex-1 pb-2 ${isMini ? 'overflow-visible px-2.5' : 'overflow-y-auto px-3 [scrollbar-width:thin]'}`}>
        {groups.map((g) => { const GIcon = g.icon;
          if (isMini) return <div key={g.key} className="relative mt-1.5 flex justify-center" onMouseEnter={() => enter(g.key)} onMouseLeave={leave}><button onClick={() => setFly(fly === g.key ? null : g.key)} className={`sb-rail h-11 w-11 ${inGroup(g) || fly === g.key ? 'sb-rail-active' : ''}`} title={g.label}><GIcon className="h-[18px] w-[18px]" /></button>{fly === g.key && <Flyout title={g.label} onClose={() => setFly(null)}><Items items={g.items} guide={false} /></Flyout>}</div>;
          const isOpen = openGroup === g.key;
          return <div key={g.key} className="mt-1.5"><button className={`sb-group ${isOpen ? 'sb-group-open' : ''}`} onClick={() => toggleGroup(g.key)} aria-expanded={isOpen}><span className="sb-gico"><GIcon className="h-[17px] w-[17px]" /></span><span className="flex-1 truncate text-left">{g.label}</span><ChevronDown className={`h-[18px] w-[18px] shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} /></button>{isOpen && <Items items={g.items} />}</div>;
        })}
      </nav>
      {isMini && <div className="flex justify-center pb-2"><button onClick={toggleMini} className="sb-rail h-11 w-11" title="Expand sidebar"><PanelLeftOpen className="h-4 w-4" /></button></div>}
      <div className={`border-t ${isMini ? 'relative flex justify-center py-3' : 'p-3'}`} style={{ borderColor: 'rgb(var(--sb-line))' }} onMouseEnter={() => isMini && enter('user')} onMouseLeave={leave}>
        {isMini ? (<><button onClick={() => setFly(fly === 'user' ? null : 'user')} className="sb-rail h-11 w-11 text-[12px] font-semibold" style={{ background: 'rgb(var(--sb-accent) / .16)', color: 'rgb(var(--sb-accent))' }} title={session?.user?.USER_NAME}>{ini}</button>
          {fly === 'user' && <div className="absolute bottom-2 left-full z-50 ml-1"><div className="sb min-w-[220px] rounded-lg border p-2 shadow-pop anim-pop"><div className="px-2.5 py-1.5"><div className="text-[13px] font-medium">{session?.user?.USER_NAME}</div><div className="text-[11.5px]" style={{ color: 'rgb(var(--sb-faint))' }}>{ROLE_LABEL[role]}</div></div><button className="sb-item w-full" onClick={() => { setFly(null); nav('/profile'); }}><UserCircle2 className="h-4 w-4" />My profile</button><button className="sb-item w-full" onClick={toggleTheme}>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button><button className="sb-item w-full" onClick={() => { setFly(null); setAskLogout(true); }}><LogOut className="h-4 w-4" />Sign out</button></div></div>}</>) : (
          <div className="sb-user !flex-col !items-stretch !gap-1.5">
            <button onClick={() => nav('/profile')} className="flex min-w-0 items-center gap-2.5 text-left" title="My profile"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold" style={{ background: 'rgb(var(--sb-accent) / .18)', color: 'rgb(var(--sb-accent))', boxShadow: 'inset 0 0 0 1px rgb(var(--sb-accent) / .3)' }}>{ini}</span><span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-semibold" style={{ color: 'rgb(var(--sb-fg))' }}>{session?.user?.USER_NAME}</span><span className="block truncate text-[11px]" style={{ color: role === 'OWNER' ? 'rgb(var(--sb-accent))' : 'rgb(var(--sb-faint))' }}>{ROLE_LABEL[role]}</span></span></button>
            <div className="flex items-center gap-1 border-t pt-1.5" style={{ borderColor: 'rgb(var(--sb-line) / .7)' }}><span className="min-w-0 flex-1 truncate px-1 text-[11px]" style={{ color: 'rgb(var(--sb-faint))' }}>{COMPANY}</span><button onClick={toggleTheme} className="sb-iconbtn shrink-0" title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button onClick={() => setAskLogout(true)} className="sb-iconbtn shrink-0" title="Sign out"><LogOut className="h-4 w-4" /></button></div>
          </div>)}
      </div>
      <ConfirmDialog open={askLogout} onClose={() => setAskLogout(false)} onConfirm={() => { setAskLogout(false); onLogout(); }} title="Sign out" confirmLabel="Sign out" cancelLabel="Stay signed in" danger={false} icon={LogOut} message={`Sign ${session?.user?.USER_NAME || 'out'} out of DcAMC?`} hint="Anything you have typed but not saved will be lost." />
    </aside>
  );
}
