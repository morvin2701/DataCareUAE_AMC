import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { invoiceService, paymentService } from '../../services/amcService.js';
import { PrintSheet, Line, Box } from '../../components/print/PrintSheet.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { ErrorBox } from '../../components/ui/Controls.jsx';
import { formatDate, fmt, displayMobile, amountWords } from '../../lib/fmt.js';
/** Tax invoice (FTA style: TRN, taxable amount, VAT, total, amount in words, payments so far, bank details). */
export function InvoicePrintPage() {
  const { id } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { invoiceService.print(id).then(setD).catch(setErr); }, [id]);
  if (err) return <ErrorBox error={err} />; if (!d) return <PageLoader title="Preparing the tax invoice" />;
  const { invoice: i, customer: c, payments, company } = d;
  return <PrintSheet title={i.STATUS === 'CANCELLED' ? 'Tax Invoice (cancelled)' : 'Tax Invoice'} company={company} back="/invoices">
    <div className="mt-3 grid grid-cols-2 gap-4">
      <Box title="Invoice"><Line label="Invoice no" bold>{i.INV_NO}</Line><Line label="Date">{formatDate(i.INV_DATE)}</Line><Line label="Due">{formatDate(i.DUE_DATE)}</Line><Line label="Contract">{i.CONTRACT_NO}</Line></Box>
      <Box title="Bill to"><div className="text-[14px] font-bold">{c.SHOP_NAME}</div><div>Shop ID {c.SHOP_CODE} · Code {c.HDD || '—'}</div><div>{c.CONTACT_NAME}{c.MOBILE_NO ? ` · ${displayMobile(c.MOBILE_NO)}` : ''}</div><div>{c.EMAIL_ID}</div></Box>
    </div>
    <table className="mt-5 w-full border-collapse"><thead><tr className="border-b-2 border-black text-left text-[11px] uppercase tracking-wide"><th className="py-1.5">#</th><th className="py-1.5">Description</th><th className="py-1.5 text-right">Taxable (AED)</th><th className="py-1.5 text-right">VAT %</th><th className="py-1.5 text-right">VAT (AED)</th><th className="py-1.5 text-right">Total (AED)</th></tr></thead>
      <tbody><tr className="border-b border-neutral-300"><td className="py-2 align-top">1</td><td className="py-2 align-top">{i.DESCRIPTION}</td><td className="py-2 text-right tabular-nums">{fmt(i.AMOUNT)}</td><td className="py-2 text-right tabular-nums">{Number(i.VAT_PRC)}</td><td className="py-2 text-right tabular-nums">{fmt(i.VAT_AMT)}</td><td className="py-2 text-right tabular-nums">{fmt(i.TOTAL)}</td></tr></tbody>
      <tfoot><tr><td colSpan={4} /><td className="py-1 text-right">Taxable</td><td className="py-1 text-right tabular-nums">{fmt(i.AMOUNT)}</td></tr><tr><td colSpan={4} /><td className="py-1 text-right">VAT {Number(i.VAT_PRC)} %</td><td className="py-1 text-right tabular-nums">{fmt(i.VAT_AMT)}</td></tr><tr className="border-t-2 border-black font-bold text-[14px]"><td colSpan={4} /><td className="py-1.5 text-right">Total</td><td className="py-1.5 text-right tabular-nums">AED {fmt(i.TOTAL)}</td></tr>{Number(i.PAID) > 0 && <><tr><td colSpan={4} /><td className="py-1 text-right">Received</td><td className="py-1 text-right tabular-nums">{fmt(i.PAID)}</td></tr><tr className="font-semibold"><td colSpan={4} /><td className="py-1 text-right">Balance due</td><td className="py-1 text-right tabular-nums">AED {fmt(i.BALANCE)}</td></tr></>}</tfoot></table>
    <div className="mt-2 text-[11px] italic text-neutral-600">Amount in words: {amountWords(i.TOTAL)}</div>
    {payments.length > 0 && <Box title="Payments received" className="mt-4"><table className="w-full text-[11.5px]"><tbody>{payments.map((p) => <tr key={p.RCPT_NO}><td className="py-0.5">{formatDate(p.PAY_DATE)}</td><td className="py-0.5">{p.RCPT_NO}</td><td className="py-0.5">{p.PAY_MODE}{p.REF_NO ? ` ${p.REF_NO}` : ''}</td><td className="py-0.5 text-right tabular-nums">AED {fmt(p.AMOUNT)}</td></tr>)}</tbody></table></Box>}
    <div className="mt-4 grid grid-cols-2 gap-4"><Box title="Payment"><div className="whitespace-pre-wrap text-[11.5px]">{company?.bank || 'Bank transfer, cheque in favour of the company, cash or card.'}</div><div className="mt-1 text-[11px] text-neutral-600">Please quote {i.INV_NO} with your payment.</div></Box><Box title="Notes"><div className="text-[11.5px]">{i.REMARK || 'This is a tax invoice under UAE Federal Decree-Law No. 8 of 2017 on VAT.'}</div></Box></div>
    <div className="mt-10 flex justify-end"><div className="w-64"><div className="h-10 border-b border-black" /><div className="mt-1 text-[11px]">For {company?.name || 'DataCare Softech FZCO'}</div></div></div>
  </PrintSheet>;
}
/** Receipt for one payment. */
export function ReceiptPrintPage() {
  const { id } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { paymentService.print(id).then(setD).catch(setErr); }, [id]);
  if (err) return <ErrorBox error={err} />; if (!d) return <PageLoader title="Preparing the receipt" />;
  const { payment: p, invoice: i, customer: c, company } = d;
  return <PrintSheet title={p.CANCELLED ? 'Receipt (cancelled)' : 'Receipt'} company={company} back="/payments">
    <div className="mt-3 grid grid-cols-2 gap-4"><Box title="Receipt"><Line label="Receipt no" bold>{p.RCPT_NO}</Line><Line label="Date">{formatDate(p.PAY_DATE)}</Line><Line label="Against">{i.INV_NO} · {i.CONTRACT_NO}</Line><Line label="Mode">{p.PAY_MODE}{p.REF_NO ? ` · ${p.REF_NO}` : ''}</Line></Box><Box title="Received from"><div className="text-[14px] font-bold">{c.SHOP_NAME}</div><div>Shop ID {c.SHOP_CODE} · Code {c.HDD || '—'}</div><div>{c.CONTACT_NAME}{c.MOBILE_NO ? ` · ${displayMobile(c.MOBILE_NO)}` : ''}</div></Box></div>
    <div className="mt-6 rounded border-2 border-black p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-600">Amount received</div><div className="text-[26px] font-extrabold tabular-nums">AED {fmt(p.AMOUNT)}</div><div className="text-[11.5px] italic text-neutral-600">{amountWords(p.AMOUNT)}</div></div>
    <div className="mt-4 grid grid-cols-3 gap-3"><Box title="Invoice total">AED {fmt(i.TOTAL)}</Box><Box title="Received to date">AED {fmt(i.PAID)}</Box><Box title="Balance">AED {fmt(i.BALANCE)}</Box></div>
    {p.REMARK && <div className="mt-3 text-[11.5px]">{p.REMARK}</div>}
    <div className="mt-10 flex justify-end"><div className="w-64"><div className="h-10 border-b border-black" /><div className="mt-1 text-[11px]">For {company?.name || 'DataCare Softech FZCO'}</div></div></div>
  </PrintSheet>;
}
/** Statement of account for one customer. */
export function StatementPrintPage() {
  const { id } = useParams(); const [d, setD] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { invoiceService.statement(id).then(setD).catch(setErr); }, [id]);
  if (err) return <ErrorBox error={err} />; if (!d) return <PageLoader title="Preparing the statement" />;
  const { customer: c, rows, balance, company } = d;
  return <PrintSheet title="Statement of Account" company={company} back={`/customers/${id}?tab=payments`}>
    <div className="mt-3 grid grid-cols-2 gap-4"><Box title="Customer"><div className="text-[14px] font-bold">{c.SHOP_NAME}</div><div>Shop ID {c.SHOP_CODE} · Code {c.HDD || '—'}</div><div>{c.CONTACT_NAME}{c.MOBILE_NO ? ` · ${displayMobile(c.MOBILE_NO)}` : ''}</div></Box><Box title="As at"><div className="text-[14px]">{formatDate(new Date())}</div><div className={`mt-1 text-[16px] font-bold tabular-nums ${balance > 0 ? '' : 'text-neutral-600'}`}>Balance due AED {fmt(balance)}</div></Box></div>
    <table className="mt-5 w-full border-collapse text-[12px]"><thead><tr className="border-b-2 border-black text-left text-[11px] uppercase tracking-wide"><th className="py-1.5">Date</th><th className="py-1.5">Ref</th><th className="py-1.5">Particulars</th><th className="py-1.5 text-right">Debit</th><th className="py-1.5 text-right">Credit</th><th className="py-1.5 text-right">Balance</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-1 tabular-nums">{formatDate(r.D)}</td><td className="py-1">{r.REF}</td><td className="py-1">{r.TEXT}</td><td className="py-1 text-right tabular-nums">{Number(r.DEBIT) ? fmt(r.DEBIT) : ''}</td><td className="py-1 text-right tabular-nums">{Number(r.CREDIT) ? fmt(r.CREDIT) : ''}</td><td className="py-1 text-right tabular-nums">{fmt(r.BALANCE)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-neutral-500">No invoices or receipts yet.</td></tr>}</tbody>
      <tfoot><tr className="border-t-2 border-black font-bold"><td colSpan={5} className="py-1.5 text-right">Balance due</td><td className="py-1.5 text-right tabular-nums">AED {fmt(balance)}</td></tr></tfoot></table>
  </PrintSheet>;
}
