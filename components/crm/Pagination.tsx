'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  total,
  pageSize = 20,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const handlePageChange = (nextPage: number) => {
    if (nextPage === page || nextPage < 1 || nextPage > pages || disabled) return;
    onChange(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const list: (number | '...')[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) list.push(i);
    } else {
      list.push(1);
      if (page > 3) list.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(pages - 1, page + 1);
      for (let i = start; i <= end; i++) list.push(i);
      if (page < pages - 2) list.push('...');
      list.push(pages);
    }
    return list;
  };

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 text-xs sm:text-sm text-slate-600"
    >
      <div className="tabular-nums">
        {total ? (
          <span>
            Hiển thị <b className="font-semibold text-slate-800">{from}–{to}</b> trên <b className="font-semibold text-slate-800">{total}</b>
          </span>
        ) : (
          '0 kết quả'
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => handlePageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Trước</span>
        </button>

        <div className="hidden sm:flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => handlePageChange(p)}
                className={cn(
                  'h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold tabular-nums transition',
                  p === page
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => handlePageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Sau</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
