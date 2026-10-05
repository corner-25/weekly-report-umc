'use client';

/**
 * Khối "Nhiệm vụ báo cáo tuần": dải nộp báo cáo 12 tuần, tình trạng các nhiệm vụ
 * AI theo dõi từ báo cáo tuần (task threads) và nội dung báo cáo tuần gần nhất.
 */
import Link from 'next/link';
import { FileText, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/crm/ui';
import { ProgressTrack, ThreadStatusChip } from '@/components/tasks/ThreadBits';
import type { DepartmentProfile } from '@/lib/department-profile';
import type { ThreadItem } from '@/lib/department-profile-sections';
import { FOCUS_RING, TONE_SOFT, type Tone } from './bits';

export function ReportSection({ data }: { data: DepartmentProfile }) {
  const { summary: s, projects, review, recentDone, year } = data.threads;
  const progressUrl = `/dashboard/tasks/progress?phong=${encodeURIComponent(data.department.name)}`;
  const chips: Array<{ label: string; value: number; tone: Tone; hint: string }> = [
    { label: 'Đang theo dõi tiến độ', value: s.activeProjects, tone: 'active', hint: 'Việc có đích (theo %), đang làm hoặc đứng yên' },
    { label: 'Thường kỳ', value: s.routine, tone: 'neutral', hint: 'Tuần nào cũng làm — không gán %' },
    { label: 'Hoàn thành', value: s.done, tone: 'done', hint: 'AI hoặc Phòng HC xác định đã xong' },
    { label: 'Đứng yên', value: s.stalled, tone: 'stale', hint: '% không đổi nhiều tuần liền' },
    { label: 'Ngừng báo cáo', value: s.stopped, tone: 'neutral', hint: 'Không còn trong báo cáo, chưa có dấu hiệu xong' },
    { label: 'Cần xác nhận', value: s.needsReview, tone: 'review', hint: 'AI chưa chắc tình trạng — Phòng HC xác nhận ở trang Tiến độ nhiệm vụ' },
  ];

  return (
    <div id="bao-cao-tuan" className="scroll-mt-20">
      <SectionCard
        title="Nhiệm vụ báo cáo tuần"
        icon={<FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />}
        action={<Link href={progressUrl} className={cn('rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>Tiến độ nhiệm vụ →</Link>}
      >
        <div className="space-y-5">
          <div>
            <h3 className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Nộp báo cáo {data.submissions.length} tuần gần nhất
              <span className="font-medium normal-case tracking-normal text-slate-400">ô xanh: phòng có trong báo cáo chung</span>
            </h3>
            <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label={`${data.submissions.length} tuần gần nhất`}>
              {data.submissions.map((w) => (
                <li
                  key={`${w.year}-${w.week}`}
                  title={w.submitted ? `Tuần ${w.week}: ${w.taskCount ?? '?'} nhiệm vụ` : `Tuần ${w.week}: chưa có trong báo cáo chung`}
                  className={cn(
                    'rounded-lg py-1.5 text-center text-[11px] font-semibold tabular-nums',
                    w.submitted ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'border border-dashed border-slate-300 bg-white text-slate-400',
                  )}
                >
                  T{w.week}
                  <span className="block text-[10px] font-medium">{w.submitted ? `${w.taskCount ?? ''} NV` : 'chưa'}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Nhiệm vụ trong báo cáo năm {year ?? '—'} <span className="font-medium normal-case tracking-normal text-slate-400">· {s.total} việc AI đang theo dõi</span>
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <li key={c.label} title={c.hint} className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', c.value ? TONE_SOFT[c.tone] : 'bg-white text-slate-400 ring-slate-200')}>
                  {c.label} <span className="tabular-nums">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {review.length > 0 && <ThreadList title="Cần xác nhận" items={review} more={s.needsReview - review.length} href={progressUrl} />}
          <ThreadList title="Đang theo dõi tiến độ" items={projects} more={0} href={progressUrl} empty="Không có nhiệm vụ có tiến độ đang làm." />
          {recentDone.length > 0 && <ThreadList title="Mới hoàn thành" items={recentDone} more={0} href={progressUrl} />}

          <details className="group rounded-xl border border-slate-200">
            <summary className={cn('flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 marker:hidden hover:bg-slate-50', FOCUS_RING)}>
              Nội dung báo cáo {data.latestWeek ? `tuần ${data.latestWeek.week}` : 'tuần gần nhất'}
              <span className="text-xs font-medium text-slate-500">{data.latestTasks.length} nhiệm vụ</span>
              <span className="ml-auto text-xs font-medium text-slate-500 group-open:hidden">Mở</span>
              <span className="ml-auto hidden text-xs font-medium text-slate-500 group-open:inline">Thu gọn</span>
            </summary>
            {data.latestTasks.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-slate-500">Phòng chưa có nhiệm vụ trong tuần gần nhất.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                {data.latestTasks.map((t) => (
                  <li key={t.id} className="py-2.5 text-sm">
                    <p className="flex items-start gap-1.5 font-semibold text-slate-900">
                      {t.isImportant && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Quan trọng" />}
                      <span className="min-w-0 flex-1">{t.name}</span>
                      {t.progress != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-700">{t.progress}%</span>}
                    </p>
                    {t.result && <p className="mt-0.5 whitespace-pre-line text-slate-600 line-clamp-3">{t.result}</p>}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      </SectionCard>
    </div>
  );
}

function ThreadList({ title, items, more, href, empty }: { title: string; items: ThreadItem[]; more: number; href: string; empty?: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((t) => (
            <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900 line-clamp-2">{t.title}</span>
                <span className="text-[11px] text-slate-400">
                  tuần {t.firstWeek}–{t.completedWeek ?? t.lastWeek}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <ThreadStatusChip status={t.status} />
                {t.kind !== 'ROUTINE' && t.progress !== null && (
                  <>
                    <span className="hidden sm:block"><ProgressTrack value={t.progress} status={t.status} /></span>
                    <span className="text-xs font-bold tabular-nums text-slate-700 sm:hidden">{t.progress}%</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <Link href={href} className={cn('mt-1 inline-block rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>
          Còn {more} việc — xem ở Tiến độ nhiệm vụ →
        </Link>
      )}
    </div>
  );
}
