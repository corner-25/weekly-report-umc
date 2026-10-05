'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, LayoutList, Rows3, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { PANEL, inputClass } from '@/components/crm/ui';
import { WORK_PRIORITY_LABELS, type WorkPriorityKey } from '@/lib/work/constants';
import { LIST_SORTS, LIST_VIEWS, type ListFilters, type ListSort, type ListView, type WorkListItem } from '@/lib/work/list';

const VIEW_DOT: Record<ListView, string> = {
  open: 'bg-brand-500',
  overdue: 'bg-rose-500',
  dueSoon: 'bg-orange-400',
  stale: 'bg-amber-400',
  noUpdate: 'bg-amber-200',
  done: 'bg-emerald-500',
  all: 'bg-slate-300',
};

const VIEW_HINT: Record<ListView, string> = {
  open: 'Chưa hoàn thành, chưa huỷ',
  overdue: 'Đang thực hiện, đã qua hạn chót',
  dueSoon: 'Hạn chót trong 30 ngày tới',
  stale: 'Đang thực hiện, quá 14 ngày không có cập nhật — gồm cả việc quá hạn',
  noUpdate: 'Đang thực hiện, chưa có dòng báo cáo tiến độ nào',
  done: 'Đã hoàn thành',
  all: 'Mọi công việc',
};

function countBy<T extends string>(values: Array<T | null | undefined>) {
  const counts = new Map<T, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()];
}

export interface ToolbarProps {
  all: WorkListItem[];
  filters: ListFilters;
  sort: ListSort;
  grouped: boolean;
  counts: Record<ListView, number> | null;
  onChange: (changes: Record<string, string>) => void;
  onExport: () => void;
  exportCount: number;
}

/** Tab theo tình trạng (kèm số đếm), tìm kiếm, bộ lọc, sắp xếp, cách hiển thị và xuất Excel. */
export function WorkListToolbar({ all, filters, sort, grouped, counts, onChange, onExport, exportCount }: ToolbarProps) {
  const [q, setQ] = useState(filters.q ?? '');
  useEffect(() => setQ(filters.q ?? ''), [filters.q]);
  // Gõ tới đâu lọc tới đó, chờ ngắt tay một nhịp để không ghi URL liên tục.
  useEffect(() => {
    if (q === (filters.q ?? '')) return;
    const timer = setTimeout(() => onChange({ q: q.trim() }), 250);
    return () => clearTimeout(timer);
  }, [q, filters.q, onChange]);

  const options = useMemo(() => {
    const years = countBy(all.map((i) => i.directedAt?.slice(0, 4))).sort((a, b) => b[0].localeCompare(a[0]));
    const depts = new Map<string, { name: string; count: number }>();
    for (const i of all) {
      if (!i.department) continue;
      const d = depts.get(i.department.id) ?? { name: i.department.name, count: 0 };
      depts.set(i.department.id, { ...d, count: d.count + 1 });
    }
    return {
      years,
      departments: [...depts.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi')),
      unassigned: all.filter((i) => !i.department).length,
      leaders: countBy(all.map((i) => i.leader)).sort((a, b) => b[1] - a[1]),
      categories: countBy(all.map((i) => i.tags[0])).sort((a, b) => b[1] - a[1]),
    };
  }, [all]);

  const departmentName = filters.departmentId === 'none' ? 'Chưa gắn đơn vị' : options.departments.find(([id]) => id === filters.departmentId)?.[1].name;
  const chips = [
    filters.year && { key: 'nam', label: `Giao năm ${filters.year}` },
    filters.departmentId && { key: 'departmentId', label: departmentName ?? 'Một đơn vị' },
    filters.leader && { key: 'lanhdao', label: `Chỉ đạo: ${filters.leader}` },
    filters.category && { key: 'hinhthuc', label: filters.category },
    filters.priority && { key: 'uutien', label: `Ưu tiên: ${WORK_PRIORITY_LABELS[filters.priority as WorkPriorityKey] ?? filters.priority}` },
    filters.q && { key: 'q', label: `“${filters.q}”` },
  ].filter((c): c is { key: string; label: string } => Boolean(c));

  return (
    <div className={cn(PANEL, 'sticky top-2 z-20 space-y-3 p-3 shadow-md shadow-slate-200/50 sm:p-4')}>
      <div role="tablist" aria-label="Lọc theo tình trạng" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 xl:flex-wrap xl:overflow-visible">
        {LIST_VIEWS.map((v) => {
          const active = filters.view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={VIEW_HINT[v.key]}
              onClick={() => onChange({ view: v.key === 'open' ? '' : v.key })}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                active ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', VIEW_DOT[v.key])} aria-hidden="true" />
              {v.label}
              <span className={cn('rounded-md px-1.5 text-[11px] tabular-nums', active ? 'bg-white/15' : 'bg-white text-slate-500')}>{counts ? counts[v.key] : '…'}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Tìm công việc</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên việc, đơn vị, người thực hiện, mã việc…" className={inputClass(undefined, 'py-2 pl-9')} />
        </label>
        <Select aria-label="Năm giao việc" value={filters.year ?? ''} onChange={(e) => onChange({ nam: e.target.value })} className="px-3 py-2">
          <option value="">Mọi năm</option>
          {options.years.map(([y, n]) => <option key={y} value={y}>{`Giao năm ${y} (${n})`}</option>)}
        </Select>
        <Select aria-label="Đơn vị chủ trì" value={filters.departmentId ?? ''} onChange={(e) => onChange({ departmentId: e.target.value })} className="px-3 py-2">
          <option value="">Mọi đơn vị</option>
          {options.departments.map(([id, d]) => <option key={id} value={id}>{`${d.name} (${d.count})`}</option>)}
          {options.unassigned > 0 && <option value="none">{`Chưa gắn đơn vị (${options.unassigned})`}</option>}
        </Select>
        <Select aria-label="Lãnh đạo chỉ đạo" value={filters.leader ?? ''} onChange={(e) => onChange({ lanhdao: e.target.value })} className="px-3 py-2">
          <option value="">Mọi lãnh đạo</option>
          {options.leaders.map(([name, n]) => <option key={name} value={name}>{`${name} (${n})`}</option>)}
        </Select>
        <Select aria-label="Hình thức chỉ đạo" value={filters.category ?? ''} onChange={(e) => onChange({ hinhthuc: e.target.value })} className="px-3 py-2">
          <option value="">Mọi hình thức</option>
          {options.categories.map(([name, n]) => <option key={name} value={name}>{`${name} (${n})`}</option>)}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => onChange({ [c.key]: '' })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100">
            {c.label}
            <X className="h-3.5 w-3.5" aria-label="Bỏ lọc" />
          </button>
        ))}
        {chips.length > 1 && (
          <button type="button" onClick={() => onChange({ nam: '', departmentId: '', lanhdao: '', hinhthuc: '', uutien: '', q: '' })} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Bỏ hết bộ lọc
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500">
            Sắp xếp
            <Select aria-label="Sắp xếp" value={sort} onChange={(e) => onChange({ sapxep: e.target.value === 'smart' ? '' : e.target.value })} className="px-2.5 py-1.5 text-sm">
              {LIST_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </label>
          <div role="group" aria-label="Cách hiển thị" className="flex rounded-lg bg-slate-100 p-0.5">
            <button type="button" aria-pressed={!grouped} onClick={() => onChange({ nhom: '' })} title="Danh sách liền" className={cn('rounded-md p-1.5', !grouped ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              <LayoutList className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Danh sách liền</span>
            </button>
            <button type="button" aria-pressed={grouped} onClick={() => onChange({ nhom: 'donvi' })} title="Nhóm theo đơn vị" className={cn('rounded-md p-1.5', grouped ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              <Rows3 className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Nhóm theo đơn vị</span>
            </button>
          </div>
          <button type="button" onClick={onExport} disabled={exportCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Xuất Excel ({exportCount})
          </button>
        </div>
      </div>
    </div>
  );
}
