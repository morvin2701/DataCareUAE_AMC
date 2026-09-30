import { useEffect, useState } from 'react';
import { Plus, KeyRound, LogOut, ShieldCheck, Users, UserCheck, Radio, Lock, Unlock, Smartphone, ShieldOff } from 'lucide-react';
import { userService } from '../../services/authService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { useForm } from '../../lib/form.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Toggle, Badge, PageHeader, ConfirmDialog, Kpi, ErrorBox } from '../../components/ui/Controls.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { displayMobile, formatDate, rel, initials } from '../../lib/fmt.js';

const ROLES = [{ value: 'OWNER', label: 'Owner', hint: 'everything' }, { value: 'ACCOUNTS', label: 'Accounts', hint: 'contracts, invoices, payments, reports' }, { value: 'SUPPORT', label: 'Support', hint: 'customers, tickets, visits — no money' }];
const EMPTY = { LOGIN_NAME: '', USER_NAME: '', ROLE: 'SUPPORT', MOBILE_NO: '', EMAIL_ID: '', password: '', CHANGE_PWD: true, ACTIVE: true };
const toForm = (u) => ({ ...EMPTY, ...u, MOBILE_NO: u.MOBILE_NO || '', EMAIL_ID: u.EMAIL_ID || '', password: '', CHANGE_PWD: !!u.CHANGE_PWD, ACTIVE: !!u.ACTIVE });
/** Users & roles — DcAMC's own logins. OWNER everything · ACCOUNTS money and contracts · SUPPORT customers, tickets, visits. */
export function UsersPage() {
  const toast = useToast(); const { session } = useAuth(); const me = session?.user?.USER_ID;
  const users = useQuery(() => userService.list(), []); const rows = users.data?.rows || [];
  const [cur, setCur] = useState(null); const [busy, setBusy] = useState(false); const [pwd, setPwd] = useState(null); const [ask2fa, setAsk2fa] = useState(false);
  const f = useForm(EMPTY);
  useEffect(() => { if (!cur && rows.length) { const u = rows.find((x) => x.USER_ID === me) || rows[0]; setCur(u); f.reset(toForm(u)); } }, [rows]); // eslint-disable-line
  const pick = (u) => { setCur(u); f.reset(toForm(u)); };
  const openNew = () => { setCur({ isNew: true }); f.reset(EMPTY); setTimeout(() => document.getElementById('u-login')?.focus(), 30); };
  useHotkeys({ 'alt+n': openNew }, []);
  const save = async () => { if (busy) return; setBusy(true); const isNew = !!cur?.isNew;
    try { const r = await userService.save({ ...f.values, USER_ID: isNew ? undefined : cur.USER_ID }); const id = isNew ? r.USER_ID : cur.USER_ID; const fresh = await userService.list(); users.setData(fresh); const u = (fresh.rows || []).find((x) => x.USER_ID === id); setCur(null); setTimeout(() => u && pick(u), 0); toast(isNew ? `${f.values.USER_NAME} created` : 'User saved', 'success'); }
    catch (e) { f.applyError(e); toast(e.message, e.code === 'VALIDATION' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const resetPwd = async () => { if (!pwd?.value) return toast('Enter a temporary password', 'warn'); setBusy(true); try { await userService.resetPassword(cur.USER_ID, pwd.value, true); toast('Password reset — they must change it at next sign-in', 'success'); setPwd(null); users.refetch(); } catch (e) { toast(e.message, e.code === 'PASSWORD_POLICY' ? 'warn' : 'error'); } finally { setBusy(false); } };
  const act = (fn, msg) => async () => { try { await fn(cur.USER_ID); toast(msg, 'success'); users.refetch(); } catch (e) { toast(e.message, 'error'); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: () => cur && !cur.isNew && f.reset(toForm(cur)) });
  const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label || r;
  return (
    <div className="w-full">
      <PageHeader title="Users & roles" subtitle="DcAMC's own logins (AMC_USER). Owner: everything. Accounts: contracts, invoices, payments, reports. Support: customers, tickets, visits — read-only contracts, never money." actions={<Button icon={Plus} onClick={openNew} title="Alt+N">New user</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Users" value={rows.length} icon={Users} /><Kpi label="Active" value={rows.filter((u) => u.ACTIVE).length} icon={UserCheck} /><Kpi label="Online now" value={rows.filter((u) => u.LIVE_SESSIONS > 0).length} icon={Radio} /><Kpi label="Owners" value={rows.filter((u) => u.ROLE === 'OWNER').length} icon={ShieldCheck} /></div>
      <ErrorBox error={users.error} />
      <div className="space-y-4">
        <DataTable rows={rows} loading={users.loading} rowKey="USER_ID" onRowClick={pick} activeId={cur?.USER_ID} columns={[
          { key: 'USER_NAME', label: 'User', primary: true, render: (u) => <div className="flex items-center gap-3"><span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold">{initials(u.USER_NAME)}{u.LIVE_SESSIONS > 0 ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ok" /> : null}</span><div><div className="flex items-center gap-1.5 font-medium">{u.USER_NAME}{u.USER_ID === me ? <Badge tone="ok">You</Badge> : null}</div><div className="text-[12px] normal-case text-muted">@{u.LOGIN_NAME}</div></div></div> },
          { key: 'ROLE', label: 'Role', render: (u) => <Badge tone={u.ROLE === 'OWNER' ? 'accent' : u.ROLE === 'ACCOUNTS' ? 'info' : 'muted'}>{roleLabel(u.ROLE)}</Badge> },
          { key: 'MOBILE_NO', label: 'Mobile', hideBelow: 'lg', render: (u) => u.MOBILE_NO ? <span className="num whitespace-nowrap">{displayMobile(u.MOBILE_NO)}</span> : <span className="text-faint">—</span> },
          { key: 'EMAIL_ID', label: 'E-mail', hideBelow: 'lg', render: (u) => <span className="normal-case">{u.EMAIL_ID || <span className="text-faint">—</span>}</span> },
          { key: 'LIVE_SESSIONS', label: 'Sessions', render: (u) => u.LIVE_SESSIONS > 0 ? <Badge tone="ok">{u.LIVE_SESSIONS} live</Badge> : <span className="text-faint">offline</span> },
          { key: 'LAST_LOGIN', label: 'Last sign-in', hideBelow: 'md', render: (u) => <span className="whitespace-nowrap">{rel(u.LAST_LOGIN)}</span> },
          { key: 'SIGNIN', label: 'Sign-in', hideBelow: 'md', render: (u) => u.TOTP_ON ? <span className="inline-flex items-center gap-1 text-ok"><Smartphone className="h-3.5 w-3.5" />app</span> : <span className="text-faint">password</span> },
          { key: 'ACTIVE', label: 'Status', render: (u) => u.LOCKED_UNTIL ? <Badge tone="warn"><Lock className="mr-1 inline h-3 w-3" />Locked</Badge> : <Badge tone={u.ACTIVE ? 'ok' : 'bad'}>{u.ACTIVE ? 'Active' : 'Disabled'}</Badge> },
        ]} emptyTitle="No users" footer={<span>{rows.length} users · click a row to edit · <kbd className="kbd">Alt N</kbd> new user</span>} />
        <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="card anim-fade" noValidate>
          {!cur ? <div className="p-8 text-center text-[13px] text-muted">Select a user above or add a new one.</div> : (<>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-[12px] font-semibold">{initials(f.values.USER_NAME || (cur.isNew ? 'New' : cur.USER_NAME))}</span><div><div className="text-[14px] font-semibold">{cur.isNew ? 'New user' : cur.USER_NAME}</div>{!cur.isNew && <div className="text-[12px] text-muted">USER_ID {cur.USER_ID} · created {formatDate(cur.ENTRY_DATE)} · last sign-in {rel(cur.LAST_LOGIN)}</div>}</div></div>
              {!cur.isNew && <div className="flex flex-wrap gap-2">{cur.LOCKED_UNTIL && <Button type="button" variant="ghost" icon={Unlock} className="!text-warn" onClick={act(userService.unlock, `${cur.USER_NAME} can sign in again`)}>Unlock</Button>}{cur.TOTP_ON ? <Button type="button" variant="ghost" icon={ShieldOff} onClick={() => setAsk2fa(true)}>Reset 2FA</Button> : null}<Button type="button" variant="ghost" icon={KeyRound} onClick={() => setPwd({ value: '' })}>Reset password</Button>{cur.LIVE_SESSIONS > 0 && <Button type="button" variant="ghost" icon={LogOut} onClick={act(userService.signOut, `${cur.USER_NAME} signed out everywhere`)}>Sign out everywhere ({cur.LIVE_SESSIONS})</Button>}</div>}
            </div>
            <div className="grid gap-x-4 gap-y-3.5 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <Input id="u-login" label="Login name" {...f.bind('LOGIN_NAME')} upper={false} autoCapitalize="none" /><Input label="Display name" {...f.bind('USER_NAME')} />
              <Select label="Role" options={ROLES} {...f.bind('ROLE')} error={f.errors.ROLE} />
              <Input label="Mobile" type="tel" inputMode="tel" placeholder="+971 50 123 4567" {...f.bind('MOBILE_NO')} upper={false} />
              <Input label="E-mail" type="email" {...f.bind('EMAIL_ID')} submit={!cur.isNew} />
              {cur.isNew && <Input label="Initial password" type="password" autoComplete="new-password" {...f.bind('password')} hint="At least 8 characters with letters and numbers. They are asked to change it at first sign-in." submit />}
              <div className="rounded-md border border-line bg-surface-2/50 px-4 py-1 sm:col-span-2"><Toggle label="Active" hint="Disabling ends all live sessions immediately" {...f.bindBool('ACTIVE')} disabled={cur.USER_ID === me} /><Toggle label="Must change password at next sign-in" {...f.bindBool('CHANGE_PWD')} /></div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/50 px-5 py-3"><span className="text-[12.5px] text-muted">{f.dirty ? 'Unsaved changes' : cur.isNew ? 'Enter on the last field creates the user' : 'No changes'}</span><div className="flex gap-2"><Button type="button" variant="ghost" disabled={!f.dirty && !cur.isNew} onClick={() => (cur.isNew ? setCur(null) : f.reset(toForm(cur)))}>{cur.isNew ? 'Cancel' : 'Discard'}</Button><Button type="submit" loading={busy} disabled={!f.dirty && !cur.isNew}>{cur.isNew ? 'Create user' : 'Save user'}</Button></div></div>
          </>)}
        </form>
      </div>
      <Modal open={!!pwd} onClose={() => setPwd(null)} title={`Reset password · ${cur?.USER_NAME}`} size="sm" footer={<><Button variant="ghost" onClick={() => setPwd(null)}>Cancel</Button><Button loading={busy} onClick={resetPwd}>Reset</Button></>}><Input label="New temporary password" type="password" value={pwd?.value || ''} onChange={(e) => setPwd({ value: e.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && resetPwd()} hint="They will be asked to choose their own at next sign-in. It also unlocks the account and signs them out." /></Modal>
      <ConfirmDialog open={ask2fa} onClose={() => setAsk2fa(false)} onConfirm={() => { setAsk2fa(false); act(userService.reset2fa, `Authenticator app removed for ${cur.USER_NAME}`)(); }} title={`Reset 2FA for ${cur?.USER_NAME}?`} message="Use this when they lost their phone. The authenticator app is removed; they sign in with the password and can set it up again." confirmLabel="Reset 2FA" />
    </div>
  );
}
