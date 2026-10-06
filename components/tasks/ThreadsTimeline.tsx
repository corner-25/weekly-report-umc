'use client';

/**
 * Dòng thời gian nhiệm vụ của một phòng (thay trang Timeline cũ): mỗi việc một
 * hàng, mỗi tuần một ô — ô tô màu là tuần có báo cáo việc đó, đậm dần theo %.
 * Màu viền theo tình trạng: xanh lá hoàn thành, hổ phách đứng yên, đỏ ngừng báo cáo.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import type { ThreadDto } from '@/lib/task-tracking/server';
import { STATUS_LABELS, type ThreadStatus } from './ThreadBits';

const STATUS_TONE: Record<ThreadStatus, string> = {
  IN_PROGRESS: 'bg-brand-500',
  DONE: 'bg-emerald-500',
  STALLED: 'bg-amber-400',
  STOPPED: 'bg-rose-400',
};

function cellTone(progress: number | null, status: ThreadStatus | null): string {
  if (status === 'DONE') return 'bg-emerald-400';
  if (progress === null) return 'bg-slate-300';
  if (progress >= 75) return 'bg-brand-600';
  if (progress >= 40) return 'bg-brand-400';
  return 'bg-brand-200';
}

export function ThreadsTimeline({ threads, latestWeek, onOpen, includeRoutine }: { threads: ThreadDto[]; latestWeek: number; onOpen: (t: ThreadDto) => void; includeRoutine: boolean }) {
  const rows = useMemo(
    () =>
      threads
        .filter((t) => includeRoutine || t.kind !== 'ROUTINE')
        .sort((a, b) => a.firstWeek - b.firstWeek || b.lastWeek - a.lastWeek),
    [threads, includeRoutine],
  );
  const weeks = Array.from({ length: Math.max(1, latestWeek) }, (_, i) => i + 1);
  if (!rows.length) return <p className={cn(PANEL, 'p-10 text-center text-sm text-slate-500')}>Không có việc nào để vẽ.</p>;

  return (
    <section className={cn(PANEL, 'overflow-hidden')} aria-label="Dòng thời gian nhiệm vụ">
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-200" />% thấp</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />% cao</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />không ghi %</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />hoàn thành</span>
        <span className="ml-auto">Bấm vào việc để xem diễn tiến</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="text-[10px] text-slate-400">
              <th scope="col" className="sticky left-0 z-10 min-w-[260px] bg-white px-3 py-1.5 text-left font-semibold">Việc</th>
              {weeks.map((w) => <th key={w} scope="col" className="w-5 px-0 py-1.5 text-center font-medium tabular-nums">{w % 5 === 0 || w === 1 ? w : ''}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const reported = new Map(t.weeks.map((w, i) => [w, t.progressHistory[i] ?? null]));
              return (
                <tr key={t.id} className="group hover:bg-slate-50">
                  <th scope="row" className="sticky left-0 z-10 max-w-[320px] bg-white px-3 py-1 text-left font-normal group-hover:bg-slate-50">
                    <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-1.5 text-left">
                      {t.status && <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_TONE[t.status as ThreadStatus])} title={STATUS_LABELS[t.status as ThreadStatus]} aria-hidden="true" />}
                      <span className="truncate font-medium text-slate-800 hover:text-brand-700">{t.title}</span>
                    </button>
                  </th>
                  {weeks.map((w) => {
                    const has = reported.has(w);
                    return (
                      <td key={w} className="px-[1px] py-1">
                        <span
                          className={cn('block h-3.5 w-4 rounded-[3px]', has ? cellTone(reported.get(w) ?? null, t.status as ThreadStatus | null) : 'bg-slate-50')}
                          title={has ? `Tuần ${w}${reported.get(w) != null ? ` · ${reported.get(w)}%` : ''}` : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
