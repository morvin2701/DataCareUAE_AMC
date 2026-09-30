import { Children, forwardRef, useId } from 'react';
import { Dropdown } from './Dropdown.jsx';
/** Text input with label + error; takes part in Enter navigation (data-nav). Typed in capitals unless the type keeps its own case. */
const KEEP_CASE = ['email', 'url', 'password', 'date', 'time', 'datetime-local', 'number', 'color', 'file'];
export const Input = forwardRef(function Input({ label, error, hint, className = '', nav = true, submit = false, prefix, suffix, upper, ...rest }, ref) {
  const keepCase = upper === false || KEEP_CASE.includes(rest.type);
  const onChange = keepCase ? rest.onChange : (e) => { const el = e.target, v = String(el.value ?? ''); if (v !== v.toUpperCase()) { const a = el.selectionStart, b = el.selectionEnd; el.value = v.toUpperCase(); try { el.setSelectionRange(a, b); } catch {} } rest.onChange?.(e); };
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted">{prefix}</span>}
        <input id={id} ref={ref} data-nav={nav ? '' : undefined} data-nav-submit={submit ? 'true' : undefined} className={`input ${prefix ? 'pl-[3.75rem]' : ''} ${suffix ? 'pr-12' : ''} ${error ? 'input-error' : ''} ${keepCase ? 'no-upper' : ''}`} aria-invalid={!!error} {...rest} onChange={onChange} {...(!keepCase && typeof rest.value === 'string' ? { value: rest.value.toUpperCase() } : {})} />
        {suffix && <span className="absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">{suffix}</span>}
      </div>
      {error ? <p className="mt-1 text-[12px] normal-case text-bad">{error}</p> : hint ? <p className="mt-1 text-[12px] normal-case text-faint">{hint}</p> : null}
    </div>
  );
});
export const Textarea = forwardRef(function Textarea({ label, error, hint, className = '', rows = 3, nav = true, ...rest }, ref) {
  const id = useId();
  return <div className={className}>{label && <label htmlFor={id} className="label">{label}</label>}<textarea id={id} ref={ref} rows={rows} data-nav={nav ? '' : undefined} className={`input no-upper h-auto py-2 ${error ? 'input-error' : ''}`} {...rest} />{error ? <p className="mt-1 text-[12px] normal-case text-bad">{error}</p> : hint ? <p className="mt-1 text-[12px] normal-case text-faint">{hint}</p> : null}</div>;
});
/** Select — <option> children or options=[], rendered with the common Dropdown. */
export const Select = forwardRef(function Select({ label, error, className = '', nav = true, children, options, size, hint, ...rest }, ref) {
  const id = useId();
  const opts = options || Children.toArray(children).filter(Boolean).map((c) => ({ value: c.props.value ?? c.props.children, label: c.props.children }));
  return <div className={className}>{label && <label htmlFor={id} className="label">{label}</label>}<Dropdown ref={ref} id={id} nav={nav} size={size} options={opts} className={error ? 'input-error' : ''} {...rest} />{error ? <p className="mt-1 text-[12.5px] normal-case text-bad">{error}</p> : hint ? <p className="mt-1 text-[12px] normal-case text-faint">{hint}</p> : null}</div>;
});
