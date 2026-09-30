import { useCallback, useState } from 'react';
/** Form state + server field errors. const f = useForm(initial); <Input {...f.bind('name')} /> */
export function useForm(initial) {
  const [values, setValues] = useState(initial); const [errors, setErrors] = useState({}); const [dirty, setDirty] = useState(false);
  const set = useCallback((k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e)); setDirty(true); }, []);
  const bind = (k) => ({ value: values[k] ?? '', error: errors[k], onChange: (e) => { const t = e?.target; set(k, t ? (t.type === 'checkbox' ? t.checked : t.value) : e); } });
  const bindBool = (k) => ({ checked: !!values[k], onChange: (v) => set(k, typeof v === 'boolean' ? v : v?.target?.checked) });
  const reset = (v = initial) => { setValues(v); setErrors({}); setDirty(false); };
  const applyError = (e) => { if (e?.fields) setErrors(e.fields); };
  return { values, errors, dirty, set, bind, bindBool, reset, applyError, setValues };
}
