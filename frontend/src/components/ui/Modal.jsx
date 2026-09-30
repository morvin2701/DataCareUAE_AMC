import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
const STACK = [];
/** Centred dialog; Esc closes only the top one. */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const id = useRef(Symbol('modal'));
  useEffect(() => { if (!open) return; const me = id.current; STACK.push(me); const h = (e) => { if (e.key === 'Escape' && STACK[STACK.length - 1] === me) onClose?.(); }; window.addEventListener('keydown', h); return () => { window.removeEventListener('keydown', h); const i = STACK.lastIndexOf(me); if (i >= 0) STACK.splice(i, 1); }; }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl', full: 'max-w-[min(1560px,calc(100vw-1.5rem))]' }[size] || 'max-w-lg';
  return createPortal(<div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
    <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={`card flex max-h-[calc(100vh-1.5rem)] w-full ${w} flex-col animate-rise shadow-pop`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5"><div><h2 className="font-display text-[17px] font-bold">{title}</h2>{subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}</div>{onClose && <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  </div>, document.body);
}
