import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { focusNext } from '../../lib/enterNav.js';
/**
 * The one dropdown (replaces every native select). options: [{ value, label, hint? }] or [value, label] pairs · onChange({ target: { value } })
 * Keyboard: Space / F1 / Alt+↓ open · type a letter to jump · ↑↓ Home End, Enter picks · Esc closes · Enter when closed = next field.
 */
export const Dropdown = forwardRef(function Dropdown({ value, onChange, options = [], disabled, placeholder = '—', size = 'md', className = '', nav = true, autoFocus, id, title, style, onKeyDown: userKeyDown, onBlur: userBlur, ...rest }, ref) {
  const opts = useMemo(() => options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : typeof o === 'object' ? o : { value: o, label: String(o) })), [options]);
  const sel = opts.find((o) => String(o.value ?? '') === String(value ?? '')) || null;
  const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const [pos, setPos] = useState(null); const btn = useRef(null); const list = useRef(null); const buf = useRef({ s: '', t: 0 });
  const setRef = (el) => { btn.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; };
  const fire = (v) => { if (String(v ?? '') !== String(value ?? '')) onChange?.({ target: { value: v }, value: v }); };
  const place = () => { const r = btn.current?.getBoundingClientRect(); if (!r) return; const h = Math.min(288, opts.length * 34 + 8); const below = window.innerHeight - r.bottom; const up = below < h + 8 && r.top > h + 8; const minWidth = Math.max(r.width, 120); setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - minWidth - 8)), top: up ? r.top - h - 4 : r.bottom + 4, minWidth, maxHeight: 288 }); };
  const openList = () => { if (disabled) return; place(); setHi(Math.max(0, opts.findIndex((o) => o === sel))); setOpen(true); };
  const close = (refocus = true) => { setOpen(false); if (refocus) btn.current?.focus(); };
  const pick = (o) => { fire(o.value); close(); };
  const typeahead = (ch, from) => { const now = Date.now(); buf.current = { s: (now - buf.current.t < 700 ? buf.current.s : '') + ch.toLowerCase(), t: now }; const n = opts.length; const find = (s) => { for (let k = 1; k <= n; k++) { const i = (from + k) % n; const o = opts[i]; if ([o.label, o.hint].some((t) => t && String(t).toLowerCase().startsWith(s))) return i; } return -1; }; const hit = find(buf.current.s); if (hit >= 0 || buf.current.s.length === 1) return hit; buf.current.s = ch.toLowerCase(); return find(buf.current.s); };
  useLayoutEffect(() => { if (!open) return; list.current?.querySelector('[data-hi="1"]')?.scrollIntoView({ block: 'nearest' }); }, [hi, open]);
  useEffect(() => { if (!open) return; const onDoc = (e) => { if (btn.current?.contains(e.target) || list.current?.contains(e.target)) return; setOpen(false); }; const onScroll = (e) => { if (list.current?.contains(e.target)) return; place(); }; document.addEventListener('mousedown', onDoc); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', place); return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place); }; }, [open]); // eslint-disable-line
  const onKeyDown = (e) => {
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.min(opts.length - 1, h + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(0, h - 1)); }
      else if (e.key === 'Home') { e.preventDefault(); setHi(0); } else if (e.key === 'End') { e.preventDefault(); setHi(opts.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (opts[hi]) pick(opts[hi]); else close(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); const i = typeahead(e.key, hi); if (i >= 0) setHi(i); }
      return;
    }
    if (e.key === ' ' || e.key === 'F1' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); openList(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const root = btn.current.closest('form, [data-nav-root], main') || document; if (!focusNext(root, btn.current)) btn.current.closest('form')?.requestSubmit?.(); return; }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); const i = typeahead(e.key, Math.max(0, opts.findIndex((o) => o === sel))); if (i >= 0) fire(opts[i].value); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && opts.some((o) => String(o.value ?? '') === '')) { e.preventDefault(); fire(''); return; }
    userKeyDown?.(e);
  };
  const sz = size === 'sm' ? 'input dd-btn !h-8 !text-[13px]' : size === 'xs' ? 'input dd-btn !h-7 !px-2 !text-[12px] !rounded-md' : 'input dd-btn';
  return (<>
    <button type="button" ref={setRef} id={id} role="combobox" aria-expanded={open} aria-haspopup="listbox" disabled={disabled} autoFocus={autoFocus} title={title || (sel?.hint ?? undefined)} style={style} data-nav={nav ? '' : undefined} data-nav-stay="true" className={`${sz} ${className}`} onKeyDown={onKeyDown} onBlur={userBlur} onMouseDown={(e) => { e.preventDefault(); if (disabled) return; btn.current?.focus(); open ? close() : openList(); }} {...rest}>
      <span className={`dd-label ${sel ? '' : 'text-faint'}`}>{sel ? sel.label : placeholder}</span><ChevronDown className="dd-chev" />
    </button>
    {open && pos && createPortal(<div ref={list} role="listbox" className="dd-list" style={{ left: pos.left, top: pos.top, minWidth: pos.minWidth, maxHeight: pos.maxHeight }}>
      {opts.length === 0 && <div className="px-3 py-2 text-[12.5px] text-faint">No options</div>}
      {opts.map((o, i) => <div key={String(o.value)} role="option" aria-selected={o === sel} data-hi={i === hi ? '1' : undefined} className={`dd-item ${i === hi ? 'dd-item-hi' : ''} ${o === sel ? 'dd-item-sel' : ''}`} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}><span className="dd-check">{o === sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate">{o.label}</span>{o.hint && <span className="ml-3 shrink-0 text-[11px] text-muted">{o.hint}</span>}</div>)}
    </div>, document.body)}
  </>);
});
