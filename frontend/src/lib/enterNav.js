/**
 * Enter-key navigation for entry forms: Enter in any [data-nav] field → the next one; on the last field (or data-nav-submit) → onSubmit();
 * Escape → onEscape(). Textareas keep Enter for new lines; Ctrl/⌘+Enter submits.
 */
export function navigableFields(root) {
  return Array.from(root.querySelectorAll('[data-nav]')).filter((el) => { if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.tabIndex < 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
}
export function focusNext(root, current) {
  const fields = navigableFields(root); const next = fields[fields.indexOf(current) + 1]; if (!next) return false;
  next.focus(); if (typeof next.select === 'function' && next.type !== 'checkbox' && next.type !== 'radio') { try { next.select(); } catch {} }
  return true;
}
export function handleEnterNav(e, root, { onSubmit, onEscape } = {}) {
  const el = e.target;
  if (e.key === 'Escape' && onEscape) { onEscape(e); return; }
  if (e.key !== 'Enter' || e.isComposing) return;
  if (!el?.hasAttribute?.('data-nav')) return;
  if (el.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
  if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'listbox' || el.dataset.navStay === 'true') return;
  e.preventDefault();
  if (el.dataset.navSubmit === 'true' || !focusNext(root, el)) onSubmit?.(e);
}
