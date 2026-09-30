import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { AuthProvider, useAuth, useRights } from './AuthContext.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { PageLoader } from '../components/ui/Loading.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { ProfilePage } from '../features/profile/ProfilePage.jsx';
import { UsersPage } from '../features/users/UsersPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';
import { AuditPage } from '../features/settings/AuditPage.jsx';
import { Placeholder } from '../features/Placeholder.jsx';
import { MENU, allowed } from './menu.js';

function Splash() { return <div className="flex min-h-screen items-center justify-center bg-surface-2/40"><PageLoader title="Signing you in" hint="Restoring your session" /></div>; }
function Private({ children }) {
  const { status, session } = useAuth(); const loc = useLocation();
  if (status === 'loading') return <Splash />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (session?.mustChangePassword && loc.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <RightGuard>{children}</RightGuard>;
}
/** A screen the role may not open is refused even when its address is typed by hand. */
function RightGuard({ children }) {
  const { role } = useRights(); const loc = useLocation();
  const item = MENU.flatMap((g) => g.items).filter((i) => loc.pathname === i.to || loc.pathname.startsWith(`${i.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  if (item && !allowed(item, role)) return <div className="flex min-h-[60vh] items-center justify-center p-6"><div className="card max-w-[420px] p-6 text-center"><Lock className="mx-auto h-8 w-8 text-warn" /><h2 className="mt-3 font-display text-[18px] font-bold">{item.label} is not open for you</h2><p className="mt-1.5 text-[13px] normal-case text-muted">Your role is {role}. Ask the owner if you need this screen.</p><Link to="/" className="btn-primary mt-4 inline-flex">Back to the dashboard</Link></div></div>;
  return children;
}
function Public({ children }) { const { status } = useAuth(); if (status === 'loading') return <Splash />; return status === 'authenticated' ? <Navigate to="/" replace /> : children; }
const PAGES = { '/': DashboardPage, '/profile': ProfilePage, '/users': UsersPage, '/settings': SettingsPage, '/audit': AuditPage };
export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider><ToastProvider>
        <Routes>
          <Route path="/login" element={<Public><LoginPage /></Public>} />
          <Route path="/change-password" element={<Private><ChangePasswordPage /></Private>} />
          <Route element={<Private><AppShell /></Private>}>
            <Route index element={<DashboardPage />} />
            {MENU.flatMap((g) => g.items).filter((i) => i.to !== '/').map((i) => { const P = PAGES[i.to] || Placeholder; return <Route key={i.to} path={i.to.slice(1)} element={<P />} />; })}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider></AuthProvider>
    </BrowserRouter>
  );
}
