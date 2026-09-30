import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Hash, ShieldCheck, Timer, Mail, MessageCircle, Server, DatabaseZap, Tags } from 'lucide-react';
import { settingsService } from '../../services/authService.js';
import { useQuery } from '../../hooks/useQuery.js';
import { Input, Select } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PageHeader, Toggle, FormSection, Badge, ErrorBox } from '../../components/ui/Controls.jsx';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { formatDateTime } from '../../lib/fmt.js';

const TABS = [['company', 'Company', Building2], ['numbering', 'Numbering & VAT', Hash], ['prices', 'Software prices', Tags], ['security', 'Security', ShieldCheck], ['sla', 'SLA & reminders', Timer], ['smtp', 'E-mail (SMTP)', Mail], ['whatsapp', 'WhatsApp', MessageCircle], ['field', 'Field update', DatabaseZap]];
/** One settings form: loads the key, edits a copy, saves the key (+ an optional secret). */
function SettingForm({ settingKey, initial, children, secretLabel, secretHint, hasSecret, onSaved, extra = {} }) {
  const toast = useToast(); const [v, setV] = useState(initial); const [secret, setSecret] = useState(''); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  useEffect(() => { setV(initial); setDirty(false); }, [initial]);
  const set = (k, x) => { setV((s) => ({ ...s, [k]: x })); setDirty(true); };
  const bind = (k, { num = false } = {}) => ({ value: v?.[k] ?? '', onChange: (e) => set(k, num ? e.target.value : e.target.value) });
  const bindBool = (k) => ({ checked: !!v?.[k], onChange: (x) => set(k, !!x) });
  const save = async () => { setBusy(true); try { const r = await settingsService.save(settingKey, v, { ...extra, ...(secret ? { secret } : {}) }); setV(r.value); setSecret(''); setDirty(false); toast('Saved', 'success'); onSaved?.(r.value); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save });
  return <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="card p-5" noValidate>
    {children({ v, set, bind, bindBool })}
    {secretLabel && <div className="mt-4 max-w-md"><Input label={secretLabel} type="password" autoComplete="new-password" value={secret} onChange={(e) => { setSecret(e.target.value); setDirty(true); }} hint={`${hasSecret ? 'One is stored — leave blank to keep it. ' : 'Not set yet. '}${secretHint || ''}`} /></div>}
    <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-[12.5px] text-muted">{dirty ? 'Unsaved changes' : 'No changes'}</span><Button type="submit" loading={busy} disabled={!dirty}>Save</Button></div>
  </form>;
}
export function SettingsPage() {
  const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') || 'company'; const setTab = (t) => setSp({ tab: t });
  const all = useQuery(() => settingsService.all(), []); const s = all.data?.settings || {}; const toast = useToast();
  const [schema, setSchema] = useState(null); const [fu, setFu] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (tab === 'field') settingsService.schema().then(setSchema).catch((e) => toast(e.message, 'error')); }, [tab]); // eslint-disable-line
  const runFieldUpdate = async () => { setBusy(true); try { const r = await settingsService.fieldUpdate(); setFu(r); setSchema(await settingsService.schema()); toast(r.applied.length ? `${r.applied.length} script(s) applied` : 'Database already up to date', 'success'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  return <div className="w-full">
    <PageHeader title="Settings" subtitle="Company details for the tax invoice, numbering, VAT, security, SLA hours, SMTP and WhatsApp, the customers' servers and their link keys, and Field update." />
    <ErrorBox error={all.error} />
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav className="card p-2 lg:sticky lg:top-16 lg:self-start">{TABS.map(([k, l, I]) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] ${tab === k ? 'bg-accent/12 font-medium text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}><I className="h-4 w-4" />{l}</button>)}</nav>
      <div className="min-w-0">
        {tab === 'company' && s.COMPANY && <SettingForm settingKey="COMPANY" initial={s.COMPANY}>{({ bind, v, set }) => <FormSection title="DataCare Softech FZCO — on the contract, tax invoice and receipt"><Input label="Company name" {...bind('name')} className="sm:col-span-2" /><Input label="TRN" {...bind('trn')} upper={false} hint="15 digits, on every tax invoice" /><Input label="Mobile / phone" upper={false} {...bind('mobile')} /><Input label="Address" {...bind('address')} className="sm:col-span-2" upper={false} /><Input label="E-mail" type="email" {...bind('email')} /><Input label="Website" type="url" {...bind('website')} /><Input label="Bank details (on the invoice)" upper={false} {...bind('bank')} className="sm:col-span-2" placeholder="Bank · Account name · IBAN" /><div className="sm:col-span-2"><label className="label">Logo (PNG / JPG, up to 300 KB)</label><div className="flex items-center gap-3">{v.logo && <img src={v.logo} alt="" className="h-12 rounded border border-line bg-white p-1" />}<input type="file" accept="image/png,image/jpeg" className="text-[12.5px]" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 300 * 1024) return toast('Keep the logo under 300 KB', 'warn'); const rd = new FileReader(); rd.onload = () => set('logo', rd.result); rd.readAsDataURL(f); }} />{v.logo && <Button type="button" variant="ghost" onClick={() => set('logo', null)}>Remove</Button>}</div></div></FormSection>}</SettingForm>}
        {tab === 'numbering' && s.NUMBERING && <div className="space-y-4">
          <SettingForm settingKey="NUMBERING" initial={s.NUMBERING}>{({ bind }) => <FormSection title="Number prefixes — the running number is 5 digits and never reused"><Input label="Contract" {...bind('CONTRACT')} upper={false} /><Input label="Tax invoice" {...bind('INVOICE')} upper={false} /><Input label="Receipt" {...bind('RECEIPT')} upper={false} /><Input label="Ticket" {...bind('TICKET')} upper={false} /></FormSection>}</SettingForm>
          <SettingForm settingKey="VAT_PRC" initial={{ value: s.VAT_PRC }} extra={{}}>{({ bind }) => <VatField bind={bind} />}</SettingForm>
        </div>}
        {tab === 'prices' && s.PRICES && <SettingForm settingKey="PRICES" initial={s.PRICES}>{({ bind }) => <FormSection title="Price of each software type (AED, before VAT) — the convert amount when a shop moves up is the difference"><Input label="Basic" type="number" min="0" step="0.01" {...bind('BASIC')} /><Input label="Pro" type="number" min="0" step="0.01" {...bind('PRO')} /><Input label="Advance" type="number" min="0" step="0.01" {...bind('ADVANCE')} /><Input label="Enterprise" type="number" min="0" step="0.01" {...bind('ENTERPRISE')} /></FormSection>}</SettingForm>}
        {tab === 'security' && s.SECURITY && <div className="space-y-4">
          <SettingForm settingKey="SECURITY" initial={s.SECURITY}>{({ bind }) => <FormSection title="Sign-in"><Input label="Lock after wrong passwords" type="number" min="0" {...bind('LOCK_ATTEMPTS')} hint="0 = never lock" /><Input label="Locked for (minutes)" type="number" min="1" {...bind('LOCK_MINUTES')} /><Input label="Minimum password length" type="number" min="6" {...bind('MIN_LEN')} /></FormSection>}</SettingForm>
          <SettingForm settingKey="IDLE_MINUTES" initial={{ value: s.IDLE_MINUTES }}>{({ bind }) => <FormSection title="Idle sign-out"><Input label="Sign out after (minutes of no activity)" type="number" min="0" max="1440" {...bind('value')} hint="0 = never. Takes effect at the next sign-in." /></FormSection>}</SettingForm>
        </div>}
        {tab === 'sla' && s.SLA_HOURS && <div className="space-y-4">
          <SettingForm settingKey="SLA_HOURS" initial={s.SLA_HOURS}>{({ bind }) => <FormSection title="Response time per ticket priority (hours)"><Input label="Low" type="number" min="1" {...bind('LOW')} /><Input label="Normal" type="number" min="1" {...bind('NORMAL')} /><Input label="High" type="number" min="1" {...bind('HIGH')} /><Input label="Urgent" type="number" min="1" {...bind('URGENT')} /></FormSection>}</SettingForm>
          <SettingForm settingKey="REMINDERS" initial={s.REMINDERS}>{({ bind }) => <FormSection title="Reminder run"><Input label="Send reminders daily at (Dubai time)" type="time" {...bind('time')} /><div /><Input label="Team WhatsApp number" upper={false} {...bind('teamMobile')} hint="Rules marked 'also tell the team' go here" /><Input label="Team e-mail" type="email" {...bind('teamEmail')} /></FormSection>}</SettingForm>
        </div>}
        {tab === 'smtp' && s.SMTP && <SettingForm settingKey="SMTP" initial={s.SMTP} secretLabel="Mailbox password" secretHint="Gmail needs an App password (Google account → Security → 2-Step Verification → App passwords)." hasSecret={s.SMTP.hasPassword}>{({ bind, bindBool }) => <><div className="mb-3 rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Send e-mail" hint="Reminders and invoices by e-mail" {...bindBool('on')} /></div><FormSection title="Outgoing server"><Input label="SMTP host" upper={false} {...bind('host')} placeholder="smtp.gmail.com" /><Input label="Port" type="number" {...bind('port')} hint="587 (STARTTLS) or 465 (SSL)" /><Input label="User name" upper={false} {...bind('user')} /><div className="rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="SSL (port 465)" {...bindBool('secure')} /></div><Input label="From address" type="email" {...bind('from')} /><Input label="From name" upper={false} {...bind('name')} /></FormSection></>}</SettingForm>}
        {tab === 'whatsapp' && s.WHATSAPP && <SettingForm settingKey="WHATSAPP" initial={s.WHATSAPP} secretLabel="DataCare Chat licence (HDD)" hasSecret={s.WHATSAPP.hasLicence}>{({ bind, bindBool }) => <><div className="mb-3 rounded-md border border-line bg-surface-2/50 px-4 py-1"><Toggle label="Send WhatsApp" hint="Through DataCare Chat (datacarechat.com)" {...bindBool('on')} /></div><FormSection title="DataCare Chat"><Input label="Endpoint URL" type="url" {...bind('url')} className="sm:col-span-2" /><Input label="TYPE (case-sensitive — sent exactly as typed)" upper={false} {...bind('type')} hint="The template name mapped on the licence, e.g. NF_UPDATE" /><Input label="Company name sent (CO_NAME)" upper={false} {...bind('coName')} /><Input label="Default country code" upper={false} {...bind('cc')} /></FormSection></>}</SettingForm>}
        {tab === 'field' && <div className="card p-5"><div className="section-title">Field update</div><p className="text-[13px] normal-case text-muted">Brings the DcAmc database up to the running program: every numbered script in <code>database/</code> that SCHEMA_VER has not seen is applied once. Safe to press again.</p>
          {schema && <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]"><Badge tone={schema.pending.length ? 'warn' : 'ok'}>{schema.pending.length ? `${schema.pending.length} pending` : 'Up to date'}</Badge><span className="text-muted">{schema.scripts} scripts on the server · {schema.database}</span>{schema.pending.length > 0 && <span className="font-mono text-[12px] normal-case text-muted">{schema.pending.join(', ')}</span>}</div>}
          <div className="mt-4"><Button icon={DatabaseZap} loading={busy} onClick={runFieldUpdate}>Run Field update</Button></div>
          {fu && <ul className="mt-4 space-y-1 font-mono text-[12px] normal-case text-muted">{fu.applied.length ? fu.applied.map((a) => <li key={a}>+ {a}</li>) : <li>Nothing to apply.</li>}</ul>}
        </div>}
      </div>
    </div>
  </div>;
}
function VatField({ bind }) { return <FormSection title="VAT"><Input label="VAT % on contracts and invoices" type="number" min="0" max="100" step="0.01" {...bind('value')} /></FormSection>; }
