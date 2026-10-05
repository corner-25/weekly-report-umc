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

/** Mọi tình trạng cần chú ý của một việc — quá hạn và lâu chưa cập nhật có thể cùng lúc. */
export function HealthChip({ health }: { health: WorkHealthDTO }) {
  return (
    <>
      {health.isOverdue && <span className={cn(CHIP, 'bg-red-50 text-red-700 ring-red-200')}>Quá hạn {-(health.daysToDue ?? 0)} ngày</span>}
      {health.isDueSoon && (
        <span className={cn(CHIP, 'bg-orange-50 text-orange-700 ring-orange-200')}>{health.daysToDue === 0 ? 'Đến hạn hôm nay' : `Còn ${health.daysToDue} ngày`}</span>
      )}
      {health.isStale && (
        <span className={cn(CHIP, 'bg-amber-50 text-amber-800 ring-amber-200')}>
          {health.daysSinceActivity === null ? 'Chưa có cập nhật' : `${health.daysSinceActivity} ngày chưa cập nhật`}
        </span>
      )}
    </>
  );
}

export interface BadgeSource {
  status: WorkItemDTO['status'];
  isOpen: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isStale: boolean;
  daysToDue: number | null;
  silentDays: number;
  updateCount: number;
  dueDate: string | null;
  lateDays: number | null;
  priority: WorkItemDTO['priority'];
}

/** Đủ badge cho một dòng danh sách: hạn, im lặng, chưa có hạn, xong đúng/trễ hạn, ưu tiên. */
export function WorkBadges({ item }: { item: BadgeSource }) {
  return (
    <>
      {(item.priority === 'URGENT' || item.priority === 'HIGH') && (
        <span className={cn(CHIP, 'bg-rose-600 text-white ring-rose-600')}>{item.priority === 'URGENT' ? 'Khẩn' : 'Ưu tiên cao'}</span>
      )}
      {item.isOverdue && <span className={cn(CHIP, 'bg-red-50 text-red-700 ring-red-200')}>Quá hạn {-(item.daysToDue ?? 0)} ngày</span>}
      {item.isDueSoon && (
        <span className={cn(CHIP, 'bg-orange-50 text-orange-700 ring-orange-200')}>{item.daysToDue === 0 ? 'Đến hạn hôm nay' : `Còn ${item.daysToDue} ngày đến hạn`}</span>
      )}
      {item.isStale && (
        <span className={cn(CHIP, 'bg-amber-50 text-amber-800 ring-amber-200')}>
          {item.updateCount === 0 ? `Chưa từng cập nhật · ${item.silentDays} ngày` : `${item.silentDays} ngày chưa cập nhật`}
        </span>
      )}
      {item.isOpen && !item.dueDate && <span className={cn(CHIP, 'bg-white text-slate-500 ring-slate-200')}>Chưa có hạn</span>}
      {item.status === 'DONE' && item.lateDays !== null && (
        item.lateDays === 0 ? (
          <span className={cn(CHIP, 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>Xong đúng hạn</span>
        ) : (
          <span className={cn(CHIP, 'bg-rose-50 text-rose-700 ring-rose-200')}>Xong trễ {item.lateDays} ngày</span>
        )
      )}
    </>
  );
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
