import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { authService } from '../../services/authService.js';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { Input } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
/** Forced on first sign-in (or after a reset): choose your own password before anything else opens. */
export function ChangePasswordPage() {
  const { refresh, logout } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ current: '', password: '', confirm: '' }); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async () => { setErr(null); if (f.password !== f.confirm) { setErr('The two passwords do not match.'); return; } setBusy(true); try { await authService.changePassword(f.current, f.password); await refresh(); nav('/', { replace: true }); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: submit });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return <div className="flex min-h-full items-center justify-center bg-bg p-4"><form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); submit(); }} className="lgn-box w-full max-w-[404px] border border-line p-7" noValidate>
    <Logo size={30} /><div className="mt-4 flex items-center gap-2"><KeyRound className="h-5 w-5 text-accent" /><h1 className="font-display text-[20px] font-bold">Choose your password</h1></div>
    <p className="mt-1 text-[12.5px] text-muted">A temporary password was given to you. Pick your own before continuing — at least 8 characters with letters and numbers.</p>
    <div className="mt-5 space-y-3.5"><Input label="Current password" type="password" autoFocus value={f.current} onChange={set('current')} /><Input label="New password" type="password" value={f.password} onChange={set('password')} /><Input label="Confirm new password" type="password" value={f.confirm} onChange={set('confirm')} submit error={err} /><Button type="submit" loading={busy} className="w-full">Change password</Button><button type="button" onClick={() => logout()} className="w-full text-center text-[12.5px] text-muted hover:text-ink">Sign out</button></div>
  </form></div>;
}
