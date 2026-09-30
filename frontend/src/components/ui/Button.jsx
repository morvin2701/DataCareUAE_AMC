import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
const V = { primary: 'btn-primary', ghost: 'btn-ghost', soft: 'btn-soft', danger: 'btn-danger' };
export const Button = forwardRef(function Button({ variant = 'primary', loading = false, className = '', children, icon: Icon, ...rest }, ref) {
  return <button ref={ref} className={`${V[variant] || V.primary} ${className}`} disabled={loading || rest.disabled} {...rest}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}{children}</button>;
});
