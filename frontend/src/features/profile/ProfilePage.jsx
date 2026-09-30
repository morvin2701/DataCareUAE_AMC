import { useEffect, useState } from 'react';
import { Smartphone, KeyRound, MonitorSmartphone, Palette } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { authService } from '../../services/authService.js';
import { useForm } from '../../lib/form.js';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { Input } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PageHeader, Badge } from '../../components/ui/Controls.jsx';
import { AccentPicker, ThemeToggle } from '../../components/ui/Theme.jsx';
import { formatDateTime } from '../../lib/fmt.js';

/** My profile: name and contact, password, authenticator app, theme and accent, live sessions. */
export function ProfilePage() {
  const { session, refresh } = useAuth(); const toast = useToast(); const u = session?.user;
  const f = useForm({ USER_NAME: u?.USER_NAME || '', MOBILE_NO: u?.MOBILE_NO || '', EMAIL_ID: u?.EMAIL_ID || '' });
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' }); const [busy, setBusy] = useState('');
  const [setup, setSetup] = useState(null); const [code, setCode] = useState(''); const [ask, setAsk] = useState(null); const [sessions, setSessions] = useState([]);
  useEffect(() => { authService.sessions().then((r) => setSessions(r.rows)).catch(() => {}); }, []);
  const save = async () => { setBusy('me'); try { await authService.updateMe(f.values); await refresh(); toast('Profile saved', 'success'); } catch (e) { f.applyError(e); toast(e.message, 'error'); } finally { setBusy(''); } };
  const changePw = async () => { if (pw.password !== pw.confirm) return toast('The two passwords do not match', 'warn'); setBusy('pw'); try { await authService.changePassword(pw.current, pw.password); setPw({ current: '', password: '', confirm: '' }); toast('Password changed — other devices were signed out', 'success'); } catch (e) { toast(e.message, e.code === 'PASSWORD_POLICY' ? 'warn' : 'error'); } finally { setBusy(''); } };
  const start2fa = async () => { setBusy('2fa'); try { const r = await authService.setup2fa(ask.password); setSetup(r); setAsk(null); setCode(''); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); } };
  const enable2fa = async () => { setBusy('2fa'); try { await authService.enable2fa(code); setSetup(null); await refresh(); toast('Authenticator app switched on', 'success'); } catch (e) { toast(e.message, 'warn'); } finally { setBusy(''); } };
  const disable2fa = async () => { setBusy('2fa'); try { await authService.disable2fa(ask.password); setAsk(null); await refresh(); toast('Authenticator app switched off', 'success'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); } };
  const me = useEnterNavigation({ onSubmit: save }); const pwNav = useEnterNavigation({ onSubmit: changePw });
  return (
    <div className="w-full">
      <PageHeader title="My profile" subtitle={`${u?.LOGIN_NAME} · ${u?.ROLE}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <form ref={me.formRef} onKeyDown={me.onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="card p-5" noValidate><div className="section-title">Contact</div><div className="field-grid"><Input label="Name" {...f.bind('USER_NAME')} className="sm:col-span-2" /><Input label="Mobile" type="tel" upper={false} {...f.bind('MOBILE_NO')} /><Input label="E-mail" type="email" {...f.bind('EMAIL_ID')} submit /></div><div className="mt-4 flex justify-end"><Button type="submit" loading={busy === 'me'} disabled={!f.dirty}>Save</Button></div></form>
        <form ref={pwNav.formRef} onKeyDown={pwNav.onKeyDown} onSubmit={(e) => { e.preventDefault(); changePw(); }} className="card p-5" noValidate><div className="section-title"><KeyRound className="h-3.5 w-3.5" />Password</div><div className="field-grid"><Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="sm:col-span-2" /><Input label="New password" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /><Input label="Confirm" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} submit /></div><div className="mt-4 flex justify-end"><Button type="submit" loading={busy === 'pw'} disabled={!pw.current || !pw.password}>Change password</Button></div></form>
        <section className="card p-5"><div className="section-title"><Smartphone className="h-3.5 w-3.5" />Authenticator app</div><p className="text-[13px] normal-case text-muted">A 6-digit code from Google or Microsoft Authenticator is asked after the password. {u?.TOTP_ON ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}</p><div className="mt-3">{u?.TOTP_ON ? <Button variant="ghost" onClick={() => setAsk({ kind: 'off', password: '' })}>Switch off</Button> : <Button variant="soft" onClick={() => setAsk({ kind: 'on', password: '' })}>Set up</Button>}</div></section>
        <section className="card p-5"><div className="section-title"><Palette className="h-3.5 w-3.5" />Appearance</div><div className="flex flex-wrap items-center gap-4"><ThemeToggle /><AccentPicker /></div><p className="mt-2 text-[12px] normal-case text-faint">Saved on this device.</p></section>
        <section className="card p-5 lg:col-span-2"><div className="section-title"><MonitorSmartphone className="h-3.5 w-3.5" />Signed-in devices</div><ul className="divide-y divide-line text-[13px]">{sessions.map((s, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="normal-case">{s.USER_AGENT?.slice(0, 80) || 'Unknown device'} {s.CURRENT && <Badge tone="ok">This one</Badge>}</span><span className="text-muted">{s.IP_ADDR} · last {formatDateTime(s.LAST_TIME)}</span></li>)}</ul>{sessions.length > 1 && <div className="mt-3"><Button variant="ghost" onClick={async () => { await authService.endOthers(); setSessions((await authService.sessions()).rows); toast('Other devices signed out', 'success'); }}>Sign out other devices</Button></div>}</section>
      </div>
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask?.kind === 'on' ? 'Set up the authenticator app' : 'Switch off the authenticator app'} size="sm" footer={<><Button variant="ghost" onClick={() => setAsk(null)}>Cancel</Button><Button loading={busy === '2fa'} onClick={ask?.kind === 'on' ? start2fa : disable2fa}>Continue</Button></>}><Input label="Confirm your password" type="password" autoFocus value={ask?.password || ''} onChange={(e) => setAsk({ ...ask, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (ask?.kind === 'on' ? start2fa() : disable2fa())} /></Modal>
      <Modal open={!!setup} onClose={() => setSetup(null)} title="Scan with your authenticator app" size="sm" footer={<><Button variant="ghost" onClick={() => setSetup(null)}>Cancel</Button><Button loading={busy === '2fa'} onClick={enable2fa}>Turn on</Button></>}>
        {setup && <div className="space-y-3 normal-case"><img alt="QR code" className="mx-auto h-44 w-44 rounded-md bg-white p-2" src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(setup.url)}`} /><p className="text-[12.5px] text-muted">Or type the key by hand: <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">{setup.secret}</code></p><Input label="Code from the app" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="[&_input]:num [&_input]:text-center [&_input]:tracking-[.3em]" onKeyDown={(e) => e.key === 'Enter' && enable2fa()} autoFocus /></div>}
      </Modal>
    </div>
  );
}
