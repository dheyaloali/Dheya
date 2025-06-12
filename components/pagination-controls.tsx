import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

interface PaginationControlsProps {
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  total: number;
  from: number;
  to: number;
}

export function PaginationControls({ page, setPage, totalPages, pageSize, setPageSize, total, from, to }: PaginationControlsProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 w-full">
      <div className="flex items-center gap-2 mb-2 md:mb-0">
        <span className="text-sm">Rows per page:</span>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
          {[10, 20, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
        <span className="text-sm text-muted-foreground ml-4">{from}–{to} of {total}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border text-sm disabled:opacity-50">First</button>
        <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border text-sm disabled:opacity-50">&lt; Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 2), Math.min(totalPages, page + 1)).map(pn => (
          <button key={pn} onClick={() => setPage(pn)} className={`px-2 py-1 rounded border text-sm ${pn === page ? 'bg-primary text-white' : 'bg-gray-100'}`}>{pn}</button>
        ))}
        <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border text-sm disabled:opacity-50">Next &gt;</button>
        <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border text-sm disabled:opacity-50">Last</button>
      </div>
    </div>
  );
} 