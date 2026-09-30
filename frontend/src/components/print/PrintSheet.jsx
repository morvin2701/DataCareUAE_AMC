import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { kb } from '../../lib/platform.js';
import { displayMobile } from '../../lib/fmt.js';
/**
 * An A4 sheet with the DataCare letterhead: only `.print-page` prints (index.css), black on white. Ctrl/⌘+P prints; ?auto=1 prints on open.
 */
export function PrintSheet({ title, company, children, back, autoPrint }) {
  const nav = useNavigate();
  useEffect(() => { const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); window.print(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  useEffect(() => { if (autoPrint || new URLSearchParams(window.location.search).get('auto') === '1') setTimeout(() => window.print(), 500); }, [autoPrint]);
  return <div className="w-full">
    <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2"><button onClick={() => (back ? nav(back) : nav(-1))} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />Back</button><Button icon={Printer} onClick={() => window.print()} title={`Print (${kb('P')})`}>Print</Button></div>
    <div className="print-page mx-auto w-full max-w-[210mm] rounded-md border border-line bg-white p-[14mm] text-[12.5px] normal-case text-black shadow-card" style={{ minHeight: '297mm', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div className="flex items-start gap-3">{company?.logo ? <img src={company.logo} alt="" className="h-14 object-contain" /> : <img src="/logo.png" alt="" className="h-12" />}<div><div className="text-[18px] font-bold tracking-tight">{company?.name || 'DataCare Softech FZCO'}</div><div className="text-[11.5px] text-neutral-700">{company?.address}</div><div className="text-[11.5px] text-neutral-700">{[company?.mobile && `Tel ${displayMobile(company.mobile) || company.mobile}`, company?.email, company?.website].filter(Boolean).join(' · ')}</div>{company?.trn && <div className="text-[11.5px] font-semibold">TRN {company.trn}</div>}</div></div>
        <div className="text-right"><div className="text-[20px] font-extrabold uppercase tracking-wide">{title}</div></div>
      </header>
      {children}
    </div>
  </div>;
}
export const Line = ({ label, children, bold }) => <div className={`flex justify-between gap-4 py-0.5 ${bold ? 'font-semibold' : ''}`}><span className="text-neutral-600">{label}</span><span className="text-right">{children}</span></div>;
export const Box = ({ title, children, className = '' }) => <section className={`rounded border border-neutral-400 p-3 ${className}`}><div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">{title}</div>{children}</section>;
export const Sign = ({ left = 'For DataCare Softech FZCO', right = 'For the customer' }) => <div className="mt-12 grid grid-cols-2 gap-12"><div><div className="h-10 border-b border-black" /><div className="mt-1 text-[11px]">{left}</div><div className="text-[10.5px] text-neutral-500">Authorised signatory · date</div></div><div><div className="h-10 border-b border-black" /><div className="mt-1 text-[11px]">{right}</div><div className="text-[10.5px] text-neutral-500">Name · signature · stamp · date</div></div></div>;
