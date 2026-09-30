import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { contractService } from '../../services/amcService.js';
import { PrintSheet, Line, Box, Sign } from '../../components/print/PrintSheet.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { ErrorBox } from '../../components/ui/Controls.jsx';
import { useRights } from '../../app/AuthContext.jsx';
import { formatDate, fmt, displayMobile, amountWords } from '../../lib/fmt.js';
const EMIRATE = { AUH: 'Abu Dhabi', DXB: 'Dubai', SHJ: 'Sharjah', AJM: 'Ajman', UAQ: 'Umm Al Quwain', RAK: 'Ras Al Khaimah', FUJ: 'Fujairah' };
/** The AMC contract on A4: parties, period, cover, fee, terms, signatures. */
export function ContractPrintPage() {
  const { id } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(null); const { money } = useRights();
  useEffect(() => { contractService.print(id).then(setD).catch(setErr); }, [id]);
  if (err) return <ErrorBox error={err} />; if (!d) return <PageLoader title="Preparing the contract" />;
  const { contract: k, customer: c, company } = d;
  return <PrintSheet title="Annual Maintenance Contract" company={company} back={`/customers/${k.CUST_ID}?tab=contracts`}>
    <div className="mt-3 grid grid-cols-2 gap-4">
      <Box title="Contract"><Line label="Contract no">{k.CONTRACT_NO}</Line><Line label="Date">{formatDate(k.ENTRY_DATE)}</Line><Line label="Period" bold>{formatDate(k.START_DATE)} to {formatDate(k.END_DATE)}</Line><Line label="Status">{k.STATUS}</Line>{k.RENEWED_FROM && <Line label="Renews">previous contract</Line>}</Box>
      <Box title="Customer"><div className="text-[14px] font-bold">{c.SHOP_NAME}</div><div>Shop ID {c.SHOP_CODE} · Code {c.HDD || '—'}</div><div>{c.CONTACT_NAME}{c.MOBILE_NO ? ` · ${displayMobile(c.MOBILE_NO)}` : ''}</div><div>{c.EMAIL_ID}</div><div>{EMIRATE[c.EMIRATE_CODE] || c.EMIRATE_CODE || ''}{c.EMIRATE_CODE ? ', ' : ''}United Arab Emirates</div></Box>
    </div>
    <Box title="Software covered" className="mt-4"><Line label="Product">DataCare Jewellery ERP (web) — {k.PLAN_CODE || c.PLAN_CODE || 'as licensed'} version</Line><Line label="Licence">{k.TILLS ?? c.TILLS ?? '—'} concurrent sessions (tills) · licence to {formatDate(k.END_DATE)}</Line></Box>
    <Box title="Cover" className="mt-4"><ul className="list-disc space-y-0.5 pl-5">{k.COVERS_SUPPORT && <li>Remote support by telephone, WhatsApp and e-mail on working days, with response times by priority as agreed.</li>}{k.COVERS_UPDATES && <li>Program updates and database field updates released during the period, installed remotely.</li>}<li>{k.VISITS_INCLUDED > 0 ? `${k.VISITS_INCLUDED} site visit${k.VISITS_INCLUDED === 1 ? '' : 's'} included; further visits are charged separately.` : 'Site visits are charged separately.'}</li><li>Excluded: hardware, network, operating system, SQL Server licensing, data entry, and damage from misuse or third-party software.</li></ul></Box>
    {money && <Box title="Annual fee" className="mt-4"><table className="w-full"><tbody><tr><td className="py-0.5">Annual maintenance charge</td><td className="py-0.5 text-right tabular-nums">AED {fmt(k.AMOUNT)}</td></tr><tr><td className="py-0.5">VAT {Number(k.VAT_PRC)} %</td><td className="py-0.5 text-right tabular-nums">AED {fmt(k.VAT_AMT)}</td></tr><tr className="border-t border-black font-bold"><td className="py-1">Total</td><td className="py-1 text-right tabular-nums">AED {fmt(k.TOTAL)}</td></tr></tbody></table><div className="text-[11px] italic text-neutral-600">{amountWords(k.TOTAL)}</div><div className="mt-1 text-[11px] text-neutral-600">Payable in advance against tax invoice {k.INV_NO || '(to follow)'}. Support may be suspended while the fee is outstanding.</div></Box>}
    {k.REMARK && <Box title="Remarks" className="mt-4"><div className="whitespace-pre-wrap">{k.REMARK}</div></Box>}
    <Box title="Terms" className="mt-4 text-[11px] leading-snug text-neutral-700"><ol className="list-decimal space-y-0.5 pl-5"><li>This contract runs for the period above and renews only by a new contract; the ERP licence follows the contract end date.</li><li>Support is given to the customer's named users during DataCare's working hours (Dubai). Urgent calls outside these hours are on a best-effort basis.</li><li>The customer keeps daily backups switched on and gives DataCare remote access when asked for support.</li><li>Fees are exclusive of VAT unless stated; VAT is charged at the rate in force. This contract is governed by the laws of the UAE.</li></ol></Box>
    <Sign />
  </PrintSheet>;
}
