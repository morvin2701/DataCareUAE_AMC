import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, X, Trash2, Printer, ExternalLink, Store, ShieldCheck, CalendarClock, Coins } from 'lucide-react';
import { customerService } from '../../services/amcService.js';
import { useQuery, useDebounce } from '../../hooks/useQuery.js';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useEnterNavigation } from '../../hooks/useEnterNavigation.js';
import { useRights } from '../../app/AuthContext.jsx';
import { useTeam } from '../tickets/TicketDialogs.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PageHeader, Badge, Kpi, ErrorBox, ConfirmDialog, SearchBox, FormSection } from '../../components/ui/Controls.jsx';
import { Dropdown } from '../../components/ui/Dropdown.jsx';
import { Expiry } from '../customers/CustomersPage.jsx';
import { formatDate, formatAED, fmt, today, yearEnd } from '../../lib/fmt.js';

const PLANS = [['', '—'], ['BASIC', 'Basic'], ['PRO', 'Pro'], ['ADVANCE', 'Advance'], ['ENTERPRISE', 'Enterprise']];
const TYPES = [['NEW', 'New'], ['EXISTING', 'Existing'], ['CONVERTED', 'Converted']];
const EMIRATES = [['', '—'], ['DXB', 'Dubai'], ['AUH', 'Abu Dhabi'], ['SHJ', 'Sharjah'], ['AJM', 'Ajman'], ['RAK', 'Ras Al Khaimah'], ['FUJ', 'Fujairah'], ['UAQ', 'Umm Al Quwain']];
const EMPTY = { SHOP_NAME: '', INSTALLER: '', PLAN_CODE: '', CONTACT_NAME: '', ADDRESS1: '', ADDRESS2: '', ADDRESS3: '', STATE_NAME: '', CITY: '', AREA: '', EMIRATE_CODE: 'DXB', PIN_CODE: '', MOBILE_NO: '', PHONE_NO: '', EMAIL_ID: '', TRN_NO: '', INSTALL_DATE: today(), LIC_START: today(), LIC_END: yearEnd(today()), BIRTH_DATE: '', INSTALL_AMT: '', CUST_TYPE: 'NEW', TILLS: '', REF_BY: '', OLD_HDD: '', OLD_INSTALL_DATE: '', MAIN_PC_SERIAL: '', LAN_PC_SERIAL1: '', LAN_PC_SERIAL2: '', REMARK: '', HDD: '', SHOP_CODE: '', STATUS: 'ACTIVE' };
const toForm = (c) => { const o = { ...EMPTY }; for (const k of Object.keys(EMPTY)) o[k] = c[k] == null ? '' : String(c[k]); return o; };

/**
 * Party master — the customers, the way the India AMC software has them: every party on the left, its details on the right.
 * Add: shop name, who installed it, software type, contact, address, dates (install → AMC start, end = +365 days), amounts.
 * A party may arrive from an ERP heartbeat too; then its licence facts are refreshed by the ERP and read-only here.
 */
export function PartyMasterPage() {
  const nav = useNavigate(); const toast = useToast(); const { support, money } = useRights(); const team = useTeam(); const [sp] = useSearchParams();
  const [q, setQ] = useState(''); const dq = useDebounce(q); const [flt, setFlt] = useState({ expiry: sp.get('expiry') || '', active: '1' });
  const list = useQuery(() => customerService.list({ q: dq, ...flt }), [dq, flt]); const rows = list.data?.rows || [];
  const [cur, setCur] = useState(null); const [f, setF] = useState(EMPTY); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false); const [meta, setMeta] = useState(null); const [changes, setChanges] = useState([]);
  useEffect(() => { customerService.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { if (!cur && rows.length && !sp.get('new')) pick(rows[0]); if (sp.get('new')) openNew(); }, [rows.length]); // eslint-disable-line
  const pick = async (c) => { setCur(c); setF(toForm(c)); setDirty(false); try { const r = await customerService.get(c.CUST_ID); setChanges(r.changes || []); } catch { setChanges([]); } };
  const openNew = () => { setCur({ isNew: true }); setF({ ...EMPTY }); setDirty(false); setChanges([]); setTimeout(() => document.getElementById('p-name')?.focus(), 30); };
  useHotkeys({ 'alt+n': () => support && openNew(), '/': () => document.getElementById('p-q')?.focus() }, [support]);
  const set = (k, v) => { setF((s) => { const n = { ...s, [k]: v }; if (k === 'INSTALL_DATE') { n.LIC_START = v; n.LIC_END = yearEnd(v); } if (k === 'LIC_START') n.LIC_END = yearEnd(v); return n; }); setDirty(true); };
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => set(k, e.target.value) });
  const fromErp = cur && !cur.isNew && cur.SOURCE === 'ERP';
  const convert = useMemo(() => { if (!meta?.prices || !cur || cur.isNew || !f.PLAN_CODE || !cur.PLAN_CODE || f.PLAN_CODE === cur.PLAN_CODE) return null; const d = (Number(meta.prices[f.PLAN_CODE]) || 0) - (Number(meta.prices[cur.PLAN_CODE]) || 0); return { from: cur.PLAN_CODE, to: f.PLAN_CODE, amount: d }; }, [meta, cur, f.PLAN_CODE]);
  const save = async () => { if (busy) return; setBusy(true);
    try { const r = cur.isNew ? await customerService.create(f) : await customerService.update(cur.CUST_ID, f); toast(cur.isNew ? `${r.customer.SHOP_NAME} added — code ${r.customer.HDD}` : 'Party saved', 'success', 5000); const fresh = await customerService.list({ q: dq, ...flt }); list.setData(fresh); const c = (fresh.rows || []).find((x) => x.CUST_ID === r.customer.CUST_ID) || r.customer; pick(c); }
    catch (e) { toast(e.message, e.code === 'VALIDATION' || e.code === 'DUPLICATE' ? 'warn' : 'error', 6000); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { const r = await customerService.remove(cur.CUST_ID); toast(r.deleted ? 'Party deleted' : 'Party has records — switched off instead of deleted', r.deleted ? 'success' : 'info', 5000); setCur(null); list.refetch(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setAsk(false); } };
  const { formRef, onKeyDown } = useEnterNavigation({ onSubmit: save, onEscape: () => (cur?.isNew ? setCur(null) : cur && pick(cur)) });
  const installers = useMemo(() => { const seen = new Map(); for (const u of team) { const ini = (u.USER_NAME || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2); if (ini && !seen.has(ini)) seen.set(ini, `${ini} · ${u.USER_NAME}`); } for (const r of rows) if (r.INSTALLER && !seen.has(r.INSTALLER)) seen.set(r.INSTALLER, r.INSTALLER); if (f.INSTALLER && !seen.has(f.INSTALLER)) seen.set(f.INSTALLER, f.INSTALLER); return [['', '—'], ...[...seen.entries()]]; }, [team, rows, f.INSTALLER]);
  const all = list.data?.rows || [];
  return <div className="w-full">
    <PageHeader title="Party master" subtitle="Every customer: who they are, who installed the software, which type, when it was installed and what they owe. Parties reported by an ERP server are matched by their code and kept current by its heartbeat." actions={support && <Button icon={Plus} onClick={openNew} title="Alt+N">New party</Button>} />
    <div className="mb-3 grid gap-2 sm:grid-cols-4"><Kpi label="Parties" value={all.length} icon={Store} onClick={() => setFlt({ ...flt, expiry: '' })} /><Kpi label="Licence live" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS >= 0).length} icon={ShieldCheck} tone="text-ok" /><Kpi label="Ending in 30 days" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS >= 0 && r.LIC_DAYS <= 30).length} icon={CalendarClock} tone="text-warn" onClick={() => setFlt({ ...flt, expiry: '30' })} />{money ? <Kpi label="Outstanding" value={formatAED(all.reduce((a, r) => a + Number(r.OUTSTANDING || 0), 0))} icon={Coins} tone="text-bad" onClick={() => setFlt({ ...flt, expiry: 'due' })} /> : <Kpi label="Expired" value={all.filter((r) => r.LIC_DAYS != null && r.LIC_DAYS < 0).length} icon={CalendarClock} tone="text-bad" onClick={() => setFlt({ ...flt, expiry: 'expired' })} />}</div>
    <ErrorBox error={list.error} />
    <div className="grid gap-4 xl:grid-cols-[minmax(340px,440px)_1fr]">
      {/* left: the parties */}
      <section className="card flex max-h-[calc(100vh-15rem)] min-h-[420px] flex-col">
        <div className="flex flex-wrap gap-2 border-b border-line p-2"><SearchBox value={q} onChange={setQ} placeholder="Search record" className="min-w-[180px] flex-1" inputRef={(el) => el && (el.id = 'p-q')} /><Dropdown size="md" className="w-36" value={flt.expiry} onChange={(e) => setFlt({ ...flt, expiry: e.target.value })} options={[['', 'All'], ['30', 'Ending in 30 d'], ['expired', 'Expired'], ['noamc', 'No AMC'], ...(money ? [['due', 'Money due']] : [])]} /><Dropdown size="md" className="w-28" value={flt.active} onChange={(e) => setFlt({ ...flt, active: e.target.value })} options={[['1', 'Current'], ['0', 'Left us'], ['', 'All']]} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><table className="table"><thead><tr><th>Ins by</th><th>AC name</th><th>Ins date</th><th>HDD</th></tr></thead><tbody>
          {list.loading && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={4}><div className="skeleton h-4 w-2/3" /></td></tr>)}
          {!list.loading && rows.map((r) => <tr key={r.CUST_ID} className={`row-click ${cur?.CUST_ID === r.CUST_ID ? 'row-active' : ''}`} onClick={() => pick(r)}><td className="!py-1.5 text-muted">{r.INSTALLER || '—'}</td><td className="!py-1.5"><div className="font-medium">{r.SHOP_NAME}</div><div className="text-[11px] text-muted">{r.PLAN_CODE || ''}{r.SOURCE === 'ERP' ? ' · ERP' : ''}{Number(r.OUTSTANDING) > 0 && money ? ` · due ${fmt(r.OUTSTANDING)}` : ''}</div></td><td className="num !py-1.5 whitespace-nowrap">{formatDate(r.INSTALL_DATE || r.LIC_START)}</td><td className="!py-1.5 font-mono text-[12px]">{r.HDD || '—'}</td></tr>)}
          {!list.loading && !rows.length && <tr><td colSpan={4} className="py-10 text-center text-faint">No parties yet — press New party.</td></tr>}
        </tbody></table></div>
        <div className="border-t border-line bg-surface-2/60 px-3 py-2 text-[12px] text-muted">{rows.length} parties · <kbd className="kbd">/</kbd> search · <kbd className="kbd">Alt N</kbd> new</div>
      </section>
      {/* right: the party */}
      <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); save(); }} className="card min-w-0" noValidate>
        {!cur ? <div className="p-10 text-center text-[13px] text-muted">Select a party on the left, or add a new one.</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="min-w-0"><div className="truncate text-[15px] font-semibold">{cur.isNew ? 'New party' : cur.SHOP_NAME}</div>{!cur.isNew && <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted"><span className="font-mono">{cur.HDD || 'no code'}</span>{cur.SOURCE === 'ERP' && <Badge tone="info">from ERP</Badge>}<Badge tone={cur.STATUS === 'ACTIVE' ? 'ok' : 'bad'}>{cur.STATUS}</Badge>{!cur.ACTIVE && <Badge tone="bad">Left us</Badge>}<span>Licence <Expiry date={cur.LIC_END} days={cur.LIC_DAYS} /></span>{cur.AMC_NO ? <span>AMC {cur.AMC_NO} · <Expiry date={cur.AMC_END} days={cur.AMC_DAYS} /></span> : <span className="text-warn">No AMC</span>}</div>}</div>
            {!cur.isNew && <div className="flex flex-wrap gap-1.5"><Button type="button" variant="ghost" icon={ExternalLink} onClick={() => nav(`/customers/${cur.CUST_ID}`)}>Open</Button><Button type="button" variant="ghost" icon={Printer} onClick={() => window.print()}>Print</Button></div>}
          </div>
          <div className="print-page grid gap-x-4 gap-y-2 p-4 md:grid-cols-2 xl:grid-cols-3 [&_.input]:!h-8 [&_.input]:!text-[13px] [&_.label]:!mb-0.5 [&_.label]:!text-[11.5px] [&_textarea.input]:!h-auto">
            <Input id="p-name" label="AC name (shop)" className="md:col-span-2 xl:col-span-2" {...bind('SHOP_NAME')} disabled={fromErp} />
            <Select label="Install by" options={installers} {...bind('INSTALLER')} />
            <Select label="Software type" options={PLANS} {...bind('PLAN_CODE')} hint={convert ? `Convert amount ${convert.from} → ${convert.to}: AED ${fmt(Math.max(0, convert.amount))}${convert.amount > 0 ? ' — an upgrade invoice is raised on save' : ''}` : undefined} />
            <Input label="Contact person" {...bind('CONTACT_NAME')} /><Select label="Customer type" options={TYPES} {...bind('CUST_TYPE')} />
            <Input label="Address 1" className="md:col-span-2 xl:col-span-3" upper={false} {...bind('ADDRESS1')} /><Input label="Address 2" className="md:col-span-2 xl:col-span-3" upper={false} {...bind('ADDRESS2')} />
            <Input label="Area" {...bind('AREA')} /><Input label="City" {...bind('CITY')} /><Select label="Emirate" options={EMIRATES} {...bind('EMIRATE_CODE')} /><Input label="State / country" {...bind('STATE_NAME')} placeholder="UAE" /><Input label="Pin code" upper={false} {...bind('PIN_CODE')} />
            <Input label="Mobile" type="tel" upper={false} {...bind('MOBILE_NO')} placeholder="971 50 123 4567" /><Input label="Phone" type="tel" upper={false} {...bind('PHONE_NO')} /><Input label="E-mail" type="email" {...bind('EMAIL_ID')} /><Input label="TRN" upper={false} {...bind('TRN_NO')} />
            <Input label="Installation date" type="date" {...bind('INSTALL_DATE')} /><Input label="AMC start date" type="date" {...bind('LIC_START')} disabled={fromErp} hint={fromErp ? 'From the ERP licence' : undefined} /><Input label="AMC end date (one year)" type="date" {...bind('LIC_END')} disabled={fromErp} />
            <Input label="Birth date" type="date" {...bind('BIRTH_DATE')} /><Input label="Tills" type="number" min="0" {...bind('TILLS')} disabled={fromErp} />
            {money ? <Input label="Installation amount (AED)" type="number" step="0.01" min="0" className="[&_input]:num [&_input]:text-right" {...bind('INSTALL_AMT')} hint={cur.isNew ? 'Billed as an installation invoice on save' : undefined} /> : <div />}
            <Input label="Recognition code (HDD)" upper={false} {...bind('HDD')} placeholder={meta?.nextHdd ? `next: ${meta.nextHdd}` : ''} hint={cur.isNew ? 'Blank = made from serial, type and installer' : undefined} disabled={fromErp} /><Input label="Shop ID" {...bind('SHOP_CODE')} hint={cur.isNew ? 'Blank = from the name' : undefined} disabled={fromErp} /><Input label="Ref by" {...bind('REF_BY')} />
            <Input label="Old HDD" upper={false} {...bind('OLD_HDD')} /><Input label="Old install date" type="date" {...bind('OLD_INSTALL_DATE')} /><Select label="Status" options={[['ACTIVE', 'Active'], ['SUSPEND', 'Suspended']]} {...bind('STATUS')} disabled={fromErp} />
            <Input label="Main PC serial" upper={false} {...bind('MAIN_PC_SERIAL')} /><Input label="LAN PC serial" upper={false} {...bind('LAN_PC_SERIAL1')} /><Input label="LAN PC serial 2" upper={false} {...bind('LAN_PC_SERIAL2')} />
            <Textarea label="Remark" className="md:col-span-2 xl:col-span-3" rows={2} {...bind('REMARK')} />
            {!cur.isNew && money && <div className="md:col-span-2 xl:col-span-3"><FormSection title="Money"><div className="vbar justify-between"><span className="text-muted">Billed</span><span className="num">AED {fmt(cur.BILLED)}</span></div><div className="vbar justify-between"><span className="text-muted">Received</span><span className="num">AED {fmt(cur.RECEIVED)}</span></div><div className="vbar justify-between md:col-span-2"><span className="text-muted">Outstanding</span><span className={`num font-semibold ${Number(cur.OUTSTANDING) > 0 ? 'text-bad' : ''}`}>AED {fmt(cur.OUTSTANDING)}</span></div></FormSection>
              {changes.length > 0 && <div className="mt-3"><div className="section-title">Convert amounts</div><table className="table"><thead><tr><th>Date</th><th>From → to</th><th className="!text-right">Amount</th><th>Invoice</th><th>By</th></tr></thead><tbody>{changes.map((x) => <tr key={x.CHANGE_ID}><td className="num">{formatDate(x.CHANGE_DATE)}</td><td>{x.FROM_PLAN || '—'} → {x.TO_PLAN}</td><td className="num text-right">{fmt(x.AMOUNT)}</td><td>{x.INV_NO ? `${x.INV_NO} · ${x.INV_STATUS}` : '—'}</td><td className="text-muted">{x.USER_NAME}</td></tr>)}</tbody></table></div>}</div>}
          </div>
          {support && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/50 px-4 py-2.5"><span className="text-[12.5px] text-muted">{dirty ? 'Unsaved changes' : cur.isNew ? 'Enter on the last field saves' : 'No changes'}</span><div className="flex gap-2">{!cur.isNew && <Button type="button" variant="ghost" icon={Trash2} className="!text-bad" onClick={() => setAsk(true)}>Delete</Button>}<Button type="button" variant="ghost" icon={X} onClick={() => (cur.isNew ? setCur(null) : pick(cur))}>Cancel</Button><Button type="submit" icon={Save} loading={busy} disabled={!dirty && !cur.isNew}>Save</Button></div></div>}
        </>}
      </form>
    </div>
    <ConfirmDialog open={ask} onClose={() => setAsk(false)} busy={busy} onConfirm={remove} title={`Delete ${cur?.SHOP_NAME}?`} message="A party with contracts, invoices, tickets or visits on record is switched off instead, so nothing is lost." confirmLabel="Delete" />
  </div>;
}
