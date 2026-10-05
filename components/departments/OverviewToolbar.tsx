'use client';

/** Thanh tìm, lọc nhanh, sắp xếp và chọn dạng xem cho bảng tổng quan phòng ban. */
import { ArrowDownWideNarrow, ArrowUpNarrowWide, LayoutGrid, Search, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { inputClass } from '@/components/crm/ui';
import {
  FILTER_KEYS, FILTER_LABELS, SORT_KEYS, SORT_LABELS,
  type FilterKey, type SortDir, type SortKey,
} from '@/lib/department-overview-view';
import { FOCUS_RING } from './bits';

export type ViewMode = 'table' | 'cards';

interface OverviewToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  filter: FilterKey;
  counts: Record<FilterKey, number>;
  onFilter: (f: FilterKey) => void;
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey, dir?: SortDir) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
}

const CHIP_TONE: Record<FilterKey, string> = {
  all: 'bg-slate-900 text-white ring-slate-900',
  overdue: 'bg-rose-600 text-white ring-rose-600',
  stale: 'bg-amber-500 text-white ring-amber-500',
  noReport: 'bg-slate-700 text-white ring-slate-700',
  review: 'bg-violet-600 text-white ring-violet-600',
  metricsLate: 'bg-amber-600 text-white ring-amber-600',
};

export function OverviewToolbar({ query, onQuery, filter, counts, onFilter, sort, dir, onSort, view, onView }: OverviewToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Tìm phòng ban</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Tìm phòng ban (gõ không dấu cũng được)…" className={inputClass(undefined, 'pl-9')} />
        </label>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sắp xếp theo">
              {SORT_KEYS.map((k) => <option key={k} value={k}>Xếp: {SORT_LABELS[k]}</option>)}
            </Select>
          </div>
          <button
            type="button"
            onClick={() => onSort(sort, dir === 'asc' ? 'desc' : 'asc')}
            className={cn('rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 hover:text-brand-700', FOCUS_RING)}
            aria-label={dir === 'asc' ? 'Đang xếp tăng dần — bấm để giảm dần' : 'Đang xếp giảm dần — bấm để tăng dần'}
            title={dir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
          >
            {dir === 'asc' ? <ArrowUpNarrowWide className="h-4 w-4" aria-hidden="true" /> : <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />}
          </button>
          <div className="hidden rounded-xl border border-slate-200 bg-white p-1 md:inline-flex" role="group" aria-label="Dạng xem">
            {([['table', 'Bảng', Table2], ['cards', 'Thẻ', LayoutGrid]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => onView(key)}
                aria-pressed={view === key}
                className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', FOCUS_RING, view === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc nhanh">
        {FILTER_KEYS.map((k) => {
          const active = filter === k;
          const empty = counts[k] === 0 && k !== 'all';
          return (
            <button
              key={k}
              type="button"
              onClick={() => onFilter(active && k !== 'all' ? 'all' : k)}
              aria-pressed={active}
              title={FILTER_LABELS[k].hint}
              disabled={empty && !active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition',
                FOCUS_RING,
                active ? CHIP_TONE[k] : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300 disabled:opacity-40',
              )}
            >
              {FILTER_LABELS[k].label}
              <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-slate-400')}>{counts[k]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
