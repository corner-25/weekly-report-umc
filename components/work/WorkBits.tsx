'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { WORK_KIND_LABELS, WORK_STATUS_LABELS } from '@/lib/work/constants';
import { formatDate } from '@/components/crm/format';
import type { WorkHealthDTO, WorkItemDTO } from './types';

const CHIP = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset';

const STATUS_TONES = {
  NOT_STARTED: 'bg-slate-100 text-slate-600 ring-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-200',
  PAUSED: 'bg-amber-50 text-amber-800 ring-amber-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-slate-50 text-slate-400 ring-slate-200 line-through',
} as const;

export function StatusChip({ status }: { status: WorkItemDTO['status'] }) {
  return <span className={cn(CHIP, STATUS_TONES[status])}>{WORK_STATUS_LABELS[status]}</span>;
}

/** Tình trạng cần chú ý nhất của một việc: quá hạn > sắp đến hạn > lâu chưa cập nhật. */
export function HealthChip({ health }: { health: WorkHealthDTO }) {
  if (health.isOverdue) return <span className={cn(CHIP, 'bg-red-50 text-red-700 ring-red-200')}>Quá hạn {-(health.daysToDue ?? 0)} ngày</span>;
  if (health.isDueSoon) {
    return <span className={cn(CHIP, 'bg-orange-50 text-orange-700 ring-orange-200')}>{health.daysToDue === 0 ? 'Đến hạn hôm nay' : `Còn ${health.daysToDue} ngày`}</span>;
  }
  if (health.isStale) {
    return (
      <span className={cn(CHIP, 'bg-amber-50 text-amber-800 ring-amber-200')}>
        {health.daysSinceActivity === null ? 'Chưa có cập nhật' : `${health.daysSinceActivity} ngày chưa cập nhật`}
      </span>
    );
  }
  return null;
}

export function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-2" aria-label={`Tiến độ ${value}%`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', value >= 100 ? 'bg-emerald-500' : 'bg-cyan-500')} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{value}%</span>
    </div>
  );
}

/** Một dòng công việc trong danh sách: tên, đơn vị, hạn, tình trạng. */
export function WorkItemRow({ item }: { item: WorkItemDTO }) {
  return (
    <li>
      <Link
        href={`/dashboard/work/items/${item.id}`}
        className="grid gap-1 rounded-xl px-2 py-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{WORK_KIND_LABELS[item.kind]}</span>
            {item.priority === 'URGENT' || item.priority === 'HIGH' ? (
              <span className={cn(CHIP, 'bg-rose-50 text-rose-700 ring-rose-200')}>{item.priority === 'URGENT' ? 'Khẩn' : 'Ưu tiên cao'}</span>
            ) : null}
            <HealthChip health={item.health} />
          </span>
          <span className="mt-0.5 block font-semibold text-slate-900 line-clamp-2">{item.title}</span>
          <span className="block truncate text-xs text-slate-500">
            {[item.department?.name ?? item.leadUnit, item.directedBy && `Chỉ đạo: ${item.directedBy}`, item.dueDate && `Hạn ${formatDate(item.dueDate)}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="flex items-center gap-3 sm:justify-end">
          <ProgressBar value={item.progressPercent} />
          <StatusChip status={item.status} />
        </span>
      </Link>
    </li>
  );
}
