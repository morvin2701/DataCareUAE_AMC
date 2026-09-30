export const APP_NAME = import.meta.env.VITE_APP_NAME || 'DcAMC';
export const COMPANY = 'DataCare Softech FZCO';
export function Logo({ size = 36, withText = true, textClass = 'text-[19px]', className = '' }) {
  return <div className={`flex items-center gap-2.5 ${className}`}><img src="/logo.png" width={size} height={size} alt="" aria-hidden className="shrink-0 object-contain" draggable={false} />{withText && <span className={`font-display font-extrabold tracking-tight ${textClass}`}>{APP_NAME}</span>}</div>;
}
