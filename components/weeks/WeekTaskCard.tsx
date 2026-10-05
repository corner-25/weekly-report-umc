import { Building2, CalendarClock, Clock, Star, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProgressMeaning = 'COMPLETION' | 'WEEKLY_DONE' | 'TIME_RATIO' | 'MEANINGLESS';

export interface WeekTask {
  id: string;
  orderNumber: number;
  taskName?: string;
  subject?: string | null;
  masterTask?: { name: string; description?: string | null; progressMeaning?: ProgressMeaning };
  result: string;
  timePeriod: string;
  progress: number | null;
  nextWeekPlan: string;
  isImportant: boolean;
}

export interface WeekTaskWithDept extends WeekTask {
  department: { id: string; name: string };
}

/** Con số tiến độ nghĩa là gì — lấy theo MasterTask.progressMeaning. */
const PROGRESS_MEANING: Record<ProgressMeaning, string> = {
  COMPLETION: '% hoàn thành thật của toàn bộ công việc',
  WEEKLY_DONE: 'Đã xong phần việc của tuần này (không phải xong hẳn công việc)',
  TIME_RATIO: '% thời gian đã trôi qua trong năm, không phải mức hoàn thành',
  MEANINGLESS: 'Con số điền cho có, không phản ánh tiến độ',
};

export const KIND_META = {
  important: { label: 'Quan trọng', hint: 'Nhiệm vụ được đánh dấu sao' },
  recurring: { label: 'Thường kỳ', hint: 'Nhiệm vụ trong danh mục của đơn vị, lặp lại qua các tuần' },
  adhoc: { label: 'Phát sinh', hint: 'Công việc đột xuất, chỉ có trong tuần này, không thuộc danh mục' },
} as const;

export function WeekTaskCard({ task, showDept }: { task: WeekTaskWithDept; showDept: boolean }) {
  const isRecurring = !!task.masterTask;
  const name = task.masterTask?.name || task.taskName || '';
  const desc = task.masterTask?.description;
  const meaning = task.masterTask?.progressMeaning;
  const accent = task.isImportant ? 'border-l-amber-400' : isRecurring ? 'border-l-brand-400' : 'border-l-violet-400';
  const kind = isRecurring ? KIND_META.recurring : KIND_META.adhoc;
  const hasResult = task.result.trim().length > 0;

  return (
    <article className={cn('rounded-xl border border-l-4 border-slate-200/80 bg-white shadow-sm transition hover:shadow-md', accent)}>
      <div className="p-4">
        <div className="mb-2 flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600" title="Thứ tự trong báo cáo">
            {task.orderNumber}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="min-w-0 flex-1 basis-48 text-sm font-semibold leading-snug text-slate-900">{name}</h3>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {task.isImportant && (
                  <span title={KIND_META.important.hint} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" aria-hidden="true" /> {KIND_META.important.label}
                  </span>
                )}
                <span
                  title={kind.hint}
                  className={cn(
                    'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                    isRecurring ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-violet-50 text-violet-700 ring-violet-200',
                  )}
                >
                  {kind.label}
                </span>
                {task.progress !== null && (
                  <span
                    title={meaning ? `Tiến độ: ${PROGRESS_MEANING[meaning]}` : 'Tiến độ do đơn vị tự điền'}
                    className={cn(
                      'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset',
                      task.progress === 100 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-700 ring-slate-200',
                    )}
                  >
                    {task.progress}%
                  </span>
                )}
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {showDept && (
                <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden="true" /> {task.department.name}</span>
              )}
              {task.subject && <span className="font-medium text-slate-600" title="Đối tượng cụ thể của tuần">· {task.subject}</span>}
              {task.timePeriod && (
                <span className="inline-flex items-center gap-1" title="Thời gian thực hiện"><Clock className="h-3 w-3" aria-hidden="true" /> {task.timePeriod}</span>
              )}
            </div>

            {desc && <p className="mt-2 line-clamp-2 text-xs italic text-slate-500">{desc}</p>}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-slate-50/70 p-2.5">
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Target className="h-3 w-3" aria-hidden="true" /> Kết quả
            </p>
            <div className="whitespace-pre-wrap break-words text-sm text-slate-700">
              {hasResult ? task.result : <span className="italic text-amber-700">Chưa ghi kết quả</span>}
            </div>
          </div>
          {task.nextWeekPlan.trim() && (
            <div className="rounded-lg bg-brand-50/50 p-2.5">
              <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                <CalendarClock className="h-3 w-3" aria-hidden="true" /> Kế hoạch tuần sau
              </p>
              <div className="whitespace-pre-wrap break-words text-sm text-slate-700">{task.nextWeekPlan}</div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
