import { useEffect } from 'react';
const isTyping = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable;
/** useHotkeys({ 'mod+k': fn, '/': fn, 'alt+n': fn, 'escape': fn }) — mod = ⌘ on Mac, Ctrl elsewhere. */
export function useHotkeys(map, deps = []) {
  useEffect(() => {
    const h = (e) => {
      const key = e.key.toLowerCase(); const mod = e.metaKey || e.ctrlKey;
      for (const [combo, fn] of Object.entries(map)) {
        const parts = combo.toLowerCase().split('+'); const k = parts.pop();
        const needMod = parts.includes('mod'), needAlt = parts.includes('alt'), needShift = parts.includes('shift');
        if (k !== key || needMod !== mod || needAlt !== e.altKey || needShift !== e.shiftKey) continue;
        if (!needMod && !needAlt && k.length === 1 && isTyping(e)) continue;
        if (k === 'escape' && document.querySelector('[role="dialog"]')) continue;
        e.preventDefault(); fn(e); return;
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, deps); // eslint-disable-line
}
