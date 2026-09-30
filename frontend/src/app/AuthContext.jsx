import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService.js';
import { getToken, setToken } from '../services/api.js';
import { allowed, MENU } from './menu.js';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: getToken() ? 'loading' : 'anonymous', session: null, expiredReason: null });
  const apply = (d) => setState({ status: 'authenticated', session: { user: d.user, idleMinutes: d.idleMinutes, mustChangePassword: !!d.mustChangePassword, company: d.company }, expiredReason: null });
  useEffect(() => { if (state.status !== 'loading') return; authService.me().then(apply).catch(() => { setToken(null); setState({ status: 'anonymous', session: null, expiredReason: null }); }); }, [state.status]);
  useEffect(() => { const h = (e) => { setToken(null); setState({ status: 'anonymous', session: null, expiredReason: e.detail?.code === 'SESSION_IDLE' ? 'idle' : 'expired' }); }; window.addEventListener('auth:expired', h); return () => window.removeEventListener('auth:expired', h); }, []);
  const login = useCallback(async (creds) => { const d = await authService.login(creds); if (d.token) { const me = await authService.me(); apply(me); } return d; }, []);
  const verify2fa = useCallback(async (args) => { await authService.verify2fa(args); apply(await authService.me()); }, []);
  const logout = useCallback(async (reason = null) => { await authService.logout(); setState({ status: 'anonymous', session: null, expiredReason: reason }); }, []);
  const refresh = useCallback(async () => apply(await authService.me()), []);
  const value = useMemo(() => ({ ...state, login, verify2fa, logout, refresh }), [state, login, verify2fa, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
/** Role of the signed-in user and what it opens: owner sees all, SUPPORT never sees money. */
export function useRights() {
  const { session } = useAuth(); const role = session?.user?.ROLE || 'SUPPORT';
  const can = (to) => { const item = MENU.flatMap((g) => g.items).find((i) => i.to === to); return !item || allowed(item, role); };
  return { role, owner: role === 'OWNER', accounts: role === 'OWNER' || role === 'ACCOUNTS', support: role === 'OWNER' || role === 'SUPPORT', money: role !== 'SUPPORT', can };
}
