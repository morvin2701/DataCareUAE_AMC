import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
const Ctx = createContext(() => {});
const ICON = { success: CheckCircle2, error: XCircle, warn: AlertTriangle, info: Info }; const TONE = { success: 'text-ok', error: 'text-bad', warn: 'text-warn', info: 'text-info' };
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'info', ms = 3500) => { const id = Math.random().toString(36).slice(2); setItems((s) => [...s, { id, message, type }]); setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), ms); }, []);
  return <Ctx.Provider value={push}>{children}<div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">{items.map((t) => { const I = ICON[t.type] || Info; return <div key={t.id} className="card pointer-events-auto flex max-w-md items-center gap-2.5 px-4 py-2.5 text-[14px] normal-case shadow-pop animate-rise"><I className={`h-[18px] w-[18px] shrink-0 ${TONE[t.type]}`} /><span>{t.message}</span></div>; })}</div></Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
