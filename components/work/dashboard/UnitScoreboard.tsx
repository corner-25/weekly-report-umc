'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/crm/ui';
import type { UnitStats } from '@/lib/work/analytics';
import { StackBar } from './charts';
import { healthSegments } from './tones';
import { InfoTip, type TermKey } from './Glossary';

type SortKey = 'unit' | 'total' | 'open' | 'overdue' | 'stale' | 'completionRate' | 'onTimeRate' | 'medianDaysToComplete' | 'oldestOpenDays';
const COLLAPSED_ROWS = 12;

const COLUMNS: Array<{ key: SortKey; label: string; term: TermKey; align?: 'left' }> = [
  { key: 'unit', label: 'Đơn vị chủ trì', term: 'leadUnit', align: 'left' },
  { key: 'total', label: 'Tổng', term: 'total' },
  { key: 'completionRate', label: 'Hoàn thành', term: 'completionRate' },
  { key: 'open', label: 'Đang thực hiện', term: 'active' },
  { key: 'overdue', label: 'Quá hạn', term: 'overdue' },
  { key: 'stale', label: 'Lâu chưa CN', term: 'stale' },
  { key: 'onTimeRate', label: 'Đúng hạn', term: 'onTime' },
  { key: 'medianDaysToComplete', label: 'Xử lý', term: 'cycleTime' },
  { key: 'oldestOpenDays', label: 'Tồn lâu nhất', term: 'oldest' },
];

/** So sánh theo cột; ô trống luôn xuống cuối dù sắp tăng hay giảm. */
function compareBy(key: SortKey, desc: boolean) {
  return (a: UnitStats, b: UnitStats) => {
    const va = a[key];
    const vb = b[key];
    if (va === null || vb === null) return va === vb ? b.total - a.total : va === null ? 1 : -1;
    const diff = typeof va === 'string' ? va.localeCompare(String(vb), 'vi') : va - (vb as number);
    return (desc ? -diff : diff) || b.total - a.total;
  };
}

const onTimeClass = (rate: number | null) => (rate === null ? '' : rate >= 80 ? 'text-emerald-600' : rate < 60 ? 'text-rose-600' : 'text-amber-600');
const num = (v: number | null, suffix = '') => (v === null ? <span className="text-slate-300">—</span> : `${v}${suffix}`);

/**
 * Bảng xếp hạng đơn vị — câu hỏi điều hành chính: phòng nào còn tồn, quá hạn,
 * làm nhanh hay chậm. Bấm tiêu đề cột để sắp xếp; bấm tên đơn vị để xem riêng.
 */
export function UnitScoreboard({ units, scopeHref, listHref }: { units: UnitStats[]; scopeHref: (departmentId: string) => string; listHref: (departmentId: string) => string }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'open', desc: true });
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => [...units].sort(compareBy(sort.key, sort.desc)), [units, sort]);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const maxTotal = Math.max(1, ...units.map((u) => u.total));

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'unit' }));

  return (
    <SectionCard
      title="Bảng theo dõi theo đơn vị"
      action={<span className="text-xs text-slate-500">{units.length} đơn vị · bấm tiêu đề cột để sắp xếp</span>}
    >
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}
                  className={cn('px-3 py-2 font-semibold first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5', c.align === 'left' ? 'text-left' : 'text-right', c.key === 'completionRate' && 'w-[170px]')}
                >
                  <span className="inline-flex items-center gap-0.5">
                  <button type="button" onClick={() => toggle(c.key)} className={cn('inline-flex items-center gap-1 rounded hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', sort.key === c.key && 'text-slate-900')}>
                    {c.label}
                    {sort.key === c.key && (sort.desc ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : <ArrowUp className="h-3 w-3" aria-hidden="true" />)}
                  </button>
                  <InfoTip term={c.term} align={c.align === 'left' ? 'left' : 'right'} />
                  </span>
                </th>
              ))}
              <th scope="col" className="w-10 pr-4"><span className="sr-only">Danh sách</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((u) => (
              <tr key={u.key} className="group hover:bg-brand-50/40">
                <th scope="row" className="min-w-[200px] max-w-[280px] py-2.5 pl-4 pr-3 text-left font-semibold text-slate-800 sm:pl-5">
                  {u.departmentId ? (
                    <Link href={scopeHref(u.departmentId)} className="line-clamp-2 hover:text-brand-700 hover:underline" title={`Xem số liệu riêng ${u.unit}`}>{u.unit}</Link>
                  ) : (
                    <span className="line-clamp-2 text-slate-500" title="Chưa khớp phòng ban trong hệ thống">{u.unit}</span>
                  )}
                </th>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="hidden h-1 rounded-full bg-slate-200 sm:block" style={{ width: `${Math.max(4, (u.total / maxTotal) * 48)}px` }} aria-hidden="true" />
                    <span className="font-medium tabular-nums text-slate-700">{u.total}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <StackBar segments={healthSegments(u)} className="flex-1" />
                    <span className="w-9 text-right text-xs font-bold tabular-nums text-emerald-600">{num(u.completionRate, '%')}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-brand-700">{u.open || <span className="font-normal text-slate-300">0</span>}</td>
                <td className={cn('px-3 py-2.5 text-right tabular-nums', u.overdue ? 'font-bold text-rose-600' : 'text-slate-300')}>{u.overdue}</td>
                <td className={cn('px-3 py-2.5 text-right tabular-nums', u.stale ? 'font-semibold text-amber-600' : 'text-slate-300')}>{u.stale}</td>
                <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', onTimeClass(u.onTimeRate))}>{num(u.onTimeRate, '%')}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-violet-600">{num(u.medianDaysToComplete, ' ng')}</td>
                <td className={cn('whitespace-nowrap px-3 py-2.5 text-right tabular-nums', (u.oldestOpenDays ?? 0) > 180 ? 'font-semibold text-indigo-700' : 'text-indigo-500')}>{num(u.oldestOpenDays, ' ng')}</td>
                <td className="pr-4 text-right sm:pr-5">
                  {u.departmentId && (
                    <Link href={listHref(u.departmentId)} className="inline-flex rounded-lg p-1.5 text-slate-400 opacity-60 transition hover:bg-white hover:text-brand-700 group-hover:opacity-100" title={`Danh sách việc của ${u.unit}`}>
                      <ListFilter className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Danh sách việc của {u.unit}</span>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > COLLAPSED_ROWS && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {expanded ? 'Thu gọn' : `Xem đủ ${rows.length} đơn vị`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    </SectionCard>
  );
}
