import { useCallback, useEffect, useRef, useState } from 'react';
/** const { data, loading, error, refetch, setData } = useQuery(() => svc.list(params), [params]) */
export function useQuery(fn, deps = [], { enabled = true } = {}) {
  const [state, set] = useState({ data: null, loading: enabled, error: null }); const seq = useRef(0);
  const run = useCallback(async () => { const id = ++seq.current; set((s) => ({ ...s, loading: true, error: null })); try { const d = await fn(); if (id === seq.current) set({ data: d, loading: false, error: null }); } catch (e) { if (id === seq.current) set((s) => ({ ...s, loading: false, error: e })); } }, deps); // eslint-disable-line
  useEffect(() => { if (enabled) run(); }, [run, enabled]);
  return { ...state, refetch: run, setData: (d) => set((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
export function useDebounce(value, ms = 300) { const [v, set] = useState(value); useEffect(() => { const t = setTimeout(() => set(value), ms); return () => clearTimeout(t); }, [value, ms]); return v; }
