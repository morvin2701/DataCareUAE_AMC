export function BrandSpinner({ size = 44, className = '' }) {
  return <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }} aria-hidden><svg className="absolute inset-0 loader-ring" viewBox="0 0 64 64" width={size} height={size}><circle cx="32" cy="32" r="29" fill="none" stroke="rgb(var(--accent) / .18)" strokeWidth="3" /><circle cx="32" cy="32" r="29" fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" strokeDasharray="46 136" /></svg><img src="/logo.png" width={size * 0.5} height={size * 0.5} alt="" aria-hidden className="object-contain" draggable={false} /></span>;
}
export function PageLoader({ title = 'Loading', hint, className = '' }) {
  return <div className={`anim-fade flex w-full flex-col items-center gap-3 py-10 ${className}`} role="status" aria-live="polite"><BrandSpinner size={52} /><div className="text-center"><div className="text-[13.5px] font-semibold">{title}…</div>{hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}</div></div>;
}
export function RouteProgress({ active }) { return <div className={`route-progress ${active ? 'route-progress-on' : ''}`} aria-hidden><span /></div>; }
