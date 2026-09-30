import { ChevronUp, ChevronDown, Inbox } from 'lucide-react';
/** columns: [{ key, label, render?(row), sortable?, align?: 'right'|'center', className?, hideBelow?: 'sm'|'md'|'lg', primary?: bool }] — dense ERP table; cards on phones. */
export function DataTable({ columns, rows, loading, sort, onSort, onRowClick, rowKey = 'id', activeId, emptyTitle = 'Nothing here yet', emptyHint, emptyAction, footer, dense = true }) {
  const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };
  const th = (c) => <th key={c.key} className={`${c.hideBelow ? hide[c.hideBelow] : ''} ${c.align === 'right' ? '!text-right' : c.align === 'center' ? '!text-center' : ''} ${c.sortable && onSort ? 'cursor-pointer select-none hover:text-ink' : ''}`} onClick={() => c.sortable && onSort?.(c.key)}><span className="inline-flex items-center gap-1">{c.label}{sort?.key === c.key && (sort.dir === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />)}</span></th>;
  const cell = (c, row) => (c.render ? c.render(row) : row[c.key]);
  const primary = columns.find((c) => c.primary) || columns[0]; const secondary = columns.filter((c) => c !== primary).slice(0, 3);
  return (
    <div className="table-wrap">
      <table className={`table hidden md:table ${dense ? '[&_td]:!py-1.5' : ''}`}>
        <thead><tr>{columns.map(th)}</tr></thead>
        <tbody>
          {loading && Array.from({ length: 6 }).map((_, i) => <tr key={`s${i}`}>{columns.map((c) => <td key={c.key} className={c.hideBelow ? hide[c.hideBelow] : ''}><div className="skeleton h-4" style={{ width: `${40 + ((i * 17 + c.key.length * 7) % 50)}%` }} /></td>)}</tr>)}
          {!loading && rows?.map((row) => <tr key={row[rowKey]} className={`${onRowClick ? 'row-click' : ''} ${activeId != null && activeId === row[rowKey] ? 'row-active' : ''}`} onClick={() => onRowClick?.(row)}>{columns.map((c) => <td key={c.key} className={`${c.hideBelow ? hide[c.hideBelow] : ''} ${c.align === 'right' ? 'num text-right' : c.align === 'center' ? 'num text-center' : ''} ${c.className || ''}`}>{cell(c, row)}</td>)}</tr>)}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {loading && Array.from({ length: 4 }).map((_, i) => <li key={i} className="space-y-2 p-4"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3" /></li>)}
        {!loading && rows?.map((row) => <li key={row[rowKey]} className={`p-4 ${onRowClick ? 'active:bg-accent/10' : ''}`} onClick={() => onRowClick?.(row)}><div className="text-[15px] font-semibold">{cell(primary, row)}</div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">{secondary.map((c) => <span key={c.key} className="inline-flex items-center gap-1"><span className="text-faint">{c.label}:</span> <span className="text-ink">{cell(c, row)}</span></span>)}</div></li>)}
      </ul>
      {!loading && rows?.length === 0 && <div className="flex flex-col items-center gap-2 px-6 py-14 text-center anim-fade"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10"><Inbox className="h-6 w-6 text-accent" /></div><p className="font-display text-[16px] font-bold">{emptyTitle}</p>{emptyHint && <p className="max-w-sm text-[13.5px] normal-case text-muted">{emptyHint}</p>}{emptyAction}</div>}
      {footer && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/60 px-4 py-2.5 text-[13px] text-muted">{footer}</div>}
    </div>
  );
}
export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize)); const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return <><span>{total ? `${from}–${to} of ${total}` : 'No records'}</span><span className="inline-flex items-center gap-1"><button className="btn-ghost !h-8 !px-2.5 !text-[13px]" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button><span className="px-2">Page {page} / {pages}</span><button className="btn-ghost !h-8 !px-2.5 !text-[13px]" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></span></>;
}
