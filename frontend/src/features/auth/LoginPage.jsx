import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, User as UserIcon, Lock, Eye, EyeOff, FileSignature, LifeBuoy, BellRing } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { Input } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Logo, APP_NAME, COMPANY } from '../../components/ui/Logo.jsx';
import { ThemeToggle } from '../../components/ui/Theme.jsx';

const F = ({ icon: Icon, className = '', ...rest }) => <Input prefix={<Icon className="h-4 w-4" />} className={`[&_input]:!h-11 [&_input]:!pl-10 ${className}`} {...rest} />;
const FEATURES = [[FileSignature, 'Contracts & renewals', 'A year is 365 days; the licence follows the contract'], [LifeBuoy, 'Tickets & visits', 'SLA by priority, every call and visit on record'], [BellRing, 'Reminders', 'WhatsApp and e-mail before a licence or AMC expires']];
/** Sign in with the DcAMC login (password, then the authenticator code when it is switched on). */
export function LoginPage() {
  const { login, verify2fa, expiredReason } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const [step, setStep] = useState('login'); const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const firstRef = useRef(null); const [ticket, setTicket] = useState(null); const [code, setCode] = useState(''); const [showPw, setShowPw] = useState(false);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const done = () => nav(loc.state?.from || '/', { replace: true });
  const submit = async () => {
    if (busy) return; setErr(null);
    if (!form.username.trim() || !form.password) { setErr('Enter user name and password.'); return; }
    setBusy(true);
    try { const d = await login({ username: form.username.trim(), password: form.password, remember: form.remember }); if (d.twoFactor) { setTicket(d.ticket); setCode(''); setStep('2fa'); setBusy(false); setTimeout(() => document.getElementById('login-code')?.focus(), 30); return; } done(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const submitCode = async () => { if (busy) return; setErr(null); if (!code.trim()) { setErr('Enter the 6-digit code.'); return; } setBusy(true); try { await verify2fa({ ticket, code: code.trim(), remember: form.remember }); done(); } catch (e) { setErr(e.message); setBusy(false); if (e.code === 'TICKET_EXPIRED') { setStep('login'); setForm((f) => ({ ...f, password: '' })); } } };
  const handler = step === 'login' ? submit : submitCode;
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: handler });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div className="grid min-h-full bg-bg lg:grid-cols-[1.1fr_minmax(440px,.9fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[rgb(11_15_23)] p-10 text-white lg:flex xl:p-14">
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full bg-[rgb(201_162_39/.28)] blur-[90px]" aria-hidden /><div className="absolute -bottom-32 right-0 h-[380px] w-[380px] rounded-full bg-[rgb(122_162_255/.18)] blur-[90px]" aria-hidden />
        <Logo size={52} textClass="text-[24px] xl:text-[26px]" className="gap-3.5" />
        <div className="max-w-[460px]">
          <h2 className="font-display text-[34px] font-extrabold leading-[1.15] tracking-tight xl:text-[40px]">Every jeweller,<br /><span className="lgn-gold-text">covered and current.</span></h2>
          <p className="mt-3 text-[14px] normal-case leading-relaxed text-white/60">Annual maintenance contracts, renewals, payments, support tickets and site visits for every shop on the DataCare ERP.</p>
          <ul className="mt-8 space-y-4">{FEATURES.map(([Icon, title, hint]) => <li key={title} className="flex items-start gap-3"><span className="lgn-gold mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(201_162_39/.12)] ring-1 ring-inset ring-[rgb(232_200_104/.22)]"><Icon className="h-4 w-4" /></span><span><span className="block text-[14px] font-semibold">{title}</span><span className="block text-[12.5px] normal-case text-white/50">{hint}</span></span></li>)}</ul>
        </div>
        <p className="text-[11.5px] text-white/35">{COMPANY} · Dubai, UAE</p>
      </section>
      <section className="relative flex min-h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between px-5"><span className="lg:invisible"><Logo size={26} /></span><ThemeToggle className="!h-8 !w-8" /></header>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); handler(); }} className="lgn-box w-full max-w-[404px] border border-line p-7 anim-pop sm:p-8" noValidate>
            {step === 'login' && <>
              <h1 className="font-display text-[26px] font-bold tracking-tight">Sign in</h1>
              <p className="mt-1 text-[13px] text-muted">{APP_NAME} — DataCare's own AMC book. Use your DcAMC login, not the ERP one.</p>
              {expiredReason && <div className="mt-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] normal-case">{expiredReason === 'idle' ? 'You were signed out after inactivity.' : 'Your session ended. Please sign in again.'}</div>}
              <div className="mt-5 space-y-3.5">
                <F ref={firstRef} icon={UserIcon} label="User name" autoComplete="username" value={form.username} onChange={set('username')} upper={false} />
                <F icon={Lock} label="Password" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={set('password')} submit error={err} upper={false} className="[&_input]:!pr-10" suffix={<button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} className="rounded p-1 text-muted hover:text-ink" aria-label="Show password">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
                <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" checked={form.remember} onChange={set('remember')} />Keep me signed in</label>
                <Button type="submit" loading={busy} className="lgn-cta w-full !h-11 !text-[14.5px]">Sign in</Button>
              </div>
            </>}
            {step === '2fa' && <>
              <button type="button" onClick={() => setStep('login')} className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />Back to sign in</button>
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /><h1 className="font-display text-[20px] font-bold">Two-step check</h1></div>
              <p className="mt-0.5 text-[12.5px] text-muted">Open your authenticator app and enter the 6-digit code for DcAMC.</p>
              <div className="mt-5 space-y-3.5"><Input id="login-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="[&_input]:num [&_input]:text-center [&_input]:text-[20px] [&_input]:tracking-[.3em]" submit error={err} /><Button type="submit" loading={busy} className="w-full">Verify</Button></div>
            </>}
          </form>
        </div>
        <footer className="shrink-0 px-5 py-4 text-center text-[11.5px] text-faint">{COMPANY} · AED · Asia/Dubai</footer>
      </section>
    </div>
  );
}
