'use client';

import { cn } from '@/lib/utils';
import type { ThreadDto } from '@/lib/task-tracking/server';

export const KIND_LABELS = { ROUTINE: 'Thường kỳ', PROJECT: 'Có tiến độ', ONE_OFF: 'Việc một lần' } as const;
export const STATUS_LABELS = { IN_PROGRESS: 'Đang thực hiện', DONE: 'Hoàn thành', STALLED: 'Đứng yên', STOPPED: 'Ngừng báo cáo' } as const;
export type ThreadKind = keyof typeof KIND_LABELS;
export type ThreadStatus = keyof typeof STATUS_LABELS;

const CHIP = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset';
const STATUS_TONES: Record<ThreadStatus, string> = {
  IN_PROGRESS: 'bg-brand-50 text-brand-700 ring-brand-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  STALLED: 'bg-amber-50 text-amber-800 ring-amber-200',
  STOPPED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function ThreadStatusChip({ status }: { status: ThreadStatus | null }) {
  if (!status) return <span className={cn(CHIP, 'bg-slate-50 text-slate-400 ring-slate-200')}>Chưa đánh giá</span>;
  return <span className={cn(CHIP, STATUS_TONES[status])}>{STATUS_LABELS[status]}</span>;
}

export function ProgressTrack({ value, status }: { value: number | null; status: ThreadStatus | null }) {
  if (value === null) return <span className="text-xs text-slate-400">không theo %</span>;
  const tone = status === 'DONE' ? 'bg-emerald-500' : status === 'STALLED' ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <span className="flex items-center gap-2" aria-label={`Tiến độ ${value}%`}>
      <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </span>
      <span className="w-9 text-right text-xs font-bold tabular-nums text-slate-700">{value}%</span>
    </span>
  );
}

/** Các mốc % phòng đã ghi qua các tuần, dạng chấm nhỏ — thấy ngay đi lên hay đứng yên. */
export function ProgressDots({ history }: { history: Array<number | null> }) {
  const shown = history.slice(-12);
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {shown.map((p, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-sm', p === null ? 'h-1 bg-slate-200' : 'bg-brand-300')}
          style={p === null ? undefined : { height: `${Math.max(3, (p / 100) * 18)}px` }}
        />
      ))}
    </span>
  );
}

export function ThreadRow({ thread, onOpen }: { thread: ThreadDto; onOpen: (t: ThreadDto) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(thread)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_170px_110px]"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900" title={thread.title}>{thread.title}</span>
            {thread.needsReview && <span className={cn(CHIP, 'bg-amber-50 text-amber-800 ring-amber-200')}>Cần xác nhận</span>}
            {thread.override && <span className={cn(CHIP, 'bg-violet-50 text-violet-700 ring-violet-200')}>Đã xác nhận</span>}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {thread.rawName !== '(không tên)' && `${thread.rawName} · `}
            {thread.firstWeek === thread.lastWeek ? `tuần ${thread.lastWeek}` : `tuần ${thread.firstWeek}–${thread.lastWeek}`} · {thread.weeksReported} lần báo cáo
            {thread.completedWeek && ` · xong tuần ${thread.completedWeek}`}
          </span>
        </span>
        <span className="hidden sm:block"><ProgressTrack value={thread.progress} status={thread.status} /></span>
        <span className="flex items-center justify-end gap-2">
          <ProgressDots history={thread.progressHistory} />
          <ThreadStatusChip status={thread.status} />
        </span>
      </button>
    </li>
  );
}
