'use client';

import Link from 'next/link';
import { ArrowUpRight, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/components/crm/format';
import type { WorkListItem } from '@/lib/work/list';
import { StatusChip, WorkBadges } from '../WorkBits';

/** Vạch màu bên trái theo mức cần chú ý — nhìn lướt cả danh sách vẫn thấy việc nóng. */
function railClass(i: WorkListItem): string {
  if (i.isOverdue) return 'before:bg-rose-500';
  if (i.isDueSoon) return 'before:bg-orange-400';
  if (i.isStale) return 'before:bg-amber-300';
  if (i.status === 'DONE') return 'before:bg-emerald-400';
  if (i.isOpen) return 'before:bg-brand-300';
  return 'before:bg-slate-200';
}

function ProgressDial({ value, done }: { value: number | null; done: boolean }) {
  const pct = done ? 100 : value;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center" title={pct === null ? 'Chưa ghi %' : `Tiến độ ${pct}%`}>
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-slate-100" />
        {pct !== null && (
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className={pct >= 100 ? 'stroke-emerald-500' : 'stroke-brand-500'} />
        )}
      </svg>
      <span className={cn('absolute text-[10px] font-bold tabular-nums', pct === null ? 'text-slate-300' : 'text-slate-700')}>{pct === null ? '—' : `${pct}%`}</span>
    </span>
  );
}

export function WorkListRow({ item, selected, onOpen }: { item: WorkListItem; selected: boolean; onOpen: (id: string) => void }) {
  const unit = item.department?.name ?? item.leadUnit;
  return (
    <li id={`work-row-${item.id}`}>
      <div
        className={cn(
          'group relative grid gap-3 py-3.5 pl-5 pr-3 transition before:absolute before:inset-y-2 before:left-1.5 before:w-1 before:rounded-full sm:grid-cols-[minmax(0,1fr)_auto] sm:pr-4',
          railClass(item),
          selected ? 'bg-brand-50/70' : 'hover:bg-slate-50',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={item.status} />
            <WorkBadges item={item} />
            {item.tags[0] && <span className="text-[11px] font-medium text-slate-400">· {item.tags[0]}</span>}
          </div>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="mt-1 block text-left text-[15px] font-semibold leading-snug text-slate-900 after:absolute after:inset-0 hover:text-brand-700 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500"
          >
            <span className="line-clamp-2">{item.title}</span>
          </button>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {unit && <span className="font-medium text-slate-600">{unit}</span>}
            {item.leader && <span>Chỉ đạo: {item.leader}</span>}
            {item.directedAt && <span>Giao {formatDate(item.directedAt)} · {item.ageDays} ngày</span>}
            {item.dueDate && <span className={cn(item.isOverdue && 'font-semibold text-rose-600')}>Hạn {formatDate(item.dueDate)}</span>}
            {item.completedAt && <span className="text-emerald-700">Xong {formatDate(item.completedAt)}</span>}
          </p>
          {item.lastUpdate ? (
            <p className="mt-1.5 line-clamp-2 border-l-2 border-slate-200 pl-2 text-[13px] text-slate-600">
              <span className="font-semibold text-slate-500">{formatDateTime(item.lastUpdate.at)}{item.lastUpdate.progressPercent != null && ` · ${item.lastUpdate.progressPercent}%`}:</span>{' '}
              {item.lastUpdate.content}
            </p>
          ) : (
            item.isOpen && <p className="mt-1.5 border-l-2 border-amber-200 pl-2 text-[13px] italic text-slate-400">Chưa có báo cáo tiến độ nào</p>
          )}
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:flex-col sm:items-end sm:justify-between">
          <ProgressDial value={item.progressPercent} done={item.status === 'DONE'} />
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1" title={`${item.updateCount} lần cập nhật`}>
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              {item.updateCount}
            </span>
            <Link
              href={`/dashboard/work/items/${item.id}`}
              className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-white hover:text-brand-700 focus-visible:opacity-100 group-hover:opacity-100"
              title="Mở trang chi tiết"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Mở trang chi tiết {item.title}</span>
            </Link>
          </span>
        </div>
      </div>
    </li>
  );
}
