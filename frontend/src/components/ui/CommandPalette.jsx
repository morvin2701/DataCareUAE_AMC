import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { toggleTheme } from '../../lib/theme.js';
/** ⌘K / Ctrl+K: jump anywhere, run actions. */
export function CommandPalette({ commands = [] }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [hi, setHi] = useState(0); const nav = useNavigate();
  useHotkeys({ 'mod+k': () => setOpen((o) => !o) }, []);
  useEffect(() => { const h = () => setOpen(true); window.addEventListener('palette:open', h); return () => window.removeEventListener('palette:open', h); }, []);
  const all = useMemo(() => [...commands, { label: 'Toggle dark / light mode', group: 'Appearance', run: toggleTheme }], [commands]);
  const list = all.filter((c) => !q || `${c.label} ${c.group || ''} ${c.keywords || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  useEffect(() => { if (!open) { setQ(''); setHi(0); } }, [open]);
  const run = (c) => { setOpen(false); c.to ? nav(c.to) : c.run?.(); };
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-3 pt-[12vh] backdrop-blur-sm anim-fade" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
    <div className="card w-full max-w-lg overflow-hidden shadow-pop anim-pop">
      <div className="flex items-center gap-3 border-b border-line px-4"><Search className="h-[18px] w-[18px] text-muted" /><input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder="Go to… or type a command" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); } else if (e.key === 'Enter' && list[hi]) run(list[hi]); else if (e.key === 'Escape') setOpen(false); }} /><kbd className="kbd">Esc</kbd></div>
      <ul className="max-h-[50vh] overflow-auto p-2">{list.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-faint">No matches</li>}{list.map((c, i) => <li key={c.label} onMouseEnter={() => setHi(i)} onMouseDown={() => run(c)} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${i === hi ? 'bg-accent/15' : ''}`}>{c.icon && <c.icon className="h-4 w-4 text-muted" />}<span className="flex-1">{c.label}</span>{c.group && <span className="text-[11.5px] text-faint">{c.group}</span>}{i === hi && <CornerDownLeft className="h-3.5 w-3.5 text-muted" />}</li>)}</ul>
    </div>
  </div>;
}
