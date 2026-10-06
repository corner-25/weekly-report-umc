import Link from 'next/link';
import { BarChart3, Eye, FileDown, Pencil, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateKey, formatRange, storedDateKey, vnTodayKey } from '@/lib/weeks/hospital-week';
import { worstSeverity, type WeekIssue } from '@/lib/weeks/audit';
import { IssueChip, SEVERITY_META, WeekStatusBadge } from './badges';
import type { WeekListItem } from './types';

const ACTION =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

interface WeekRowProps {
  week: WeekListItem;
  issues: WeekIssue[];
  detailHref: string;
  editHref: string;
  metricsHref: string;
}

export function WeekRow({ week, issues, detailHref, editHref, metricsHref }: WeekRowProps) {
  const worst = worstSeverity(issues.filter((i) => i.severity !== 'info'));
  const accent = worst
    ? SEVERITY_META[worst].accent
    : week.status === 'COMPLETED' ? 'border-l-emerald-500' : 'border-l-amber-300';
  const metricTotal = (week.metricValueCount ?? 0) + (week.extractedMetricCount ?? 0);
  const startKey = storedDateKey(week.startDate);
  const endKey = storedDateKey(week.endDate);

  return (
    <article
      aria-labelledby={`week-${week.id}-title`}
      className={cn(
        'grid gap-3 rounded-2xl border border-l-4 border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md',
        'md:grid-cols-[5.5rem_minmax(0,1fr)_auto] md:items-center',
        accent,
      )}
    >
      <div className="flex items-baseline gap-2 md:block">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tuần</p>
        <h3 id={`week-${week.id}-title`} className="text-3xl font-black tabular-nums leading-none text-slate-900">
          <Link href={detailHref} className="hover:text-brand-700 focus-visible:outline-none focus-visible:underline">
            {week.weekNumber}
          </Link>
          <span className="sr-only">/{week.year}</span>
        </h3>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{formatRange(startKey, endKey)}</span>
          <WeekStatusBadge status={week.status} />
          {week.reportFileUrl && (
            <a
              href={week.reportFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-100"
              title="Mở file biên bản đính kèm"
            >
              <FileDown className="h-3 w-3" aria-hidden="true" /> Biên bản
            </a>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <div className="inline-flex gap-1" title="Số khoa/phòng có ít nhất một nhiệm vụ trong tuần">
            <dt className="text-slate-500">Đơn vị</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{week.departmentCount}</dd>
          </div>
          <div className="inline-flex gap-1" title="Tổng số dòng nhiệm vụ đã báo cáo trong tuần">
            <dt className="text-slate-500">Nhiệm vụ</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{week.taskCount}</dd>
          </div>
          {(week.metricValueCount !== undefined || week.extractedMetricCount !== undefined) && (
            <div className="inline-flex gap-1" title="Số liệu định lượng: nhập tay (Nhập số liệu) + AI trích từ báo cáo">
              <dt className="text-slate-500">Số liệu</dt>
              <dd className={cn('font-semibold tabular-nums', metricTotal === 0 ? 'text-slate-400' : 'text-slate-800')}>{metricTotal}</dd>
            </div>
          )}
          <div className="inline-flex gap-1" title="Lần sửa gần nhất">
            <dt className="text-slate-500">Cập nhật</dt>
            <dd className="tabular-nums text-slate-700">
              {formatDateKey(vnTodayKey(new Date(week.updatedAt)), true)}
              {week.createdByName ? ` · ${week.createdByName}` : ''}
            </dd>
          </div>
        </dl>
        {issues.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Vấn đề dữ liệu">
            {issues.map((i) => <li key={i.code} className="max-w-full"><IssueChip issue={i} /></li>)}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:flex md:flex-col lg:flex-row">
        <Link href={detailHref} className={cn(ACTION, 'bg-brand-50 text-brand-700 hover:bg-brand-100')}>
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Xem
        </Link>
        <Link href={editHref} className={cn(ACTION, 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Sửa
        </Link>
        <Link
          href={metricsHref}
          title="Nhập số liệu định lượng của tuần"
          className={cn(ACTION, 'bg-violet-50 text-violet-700 hover:bg-violet-100')}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Số liệu
        </Link>
        <Link
          href={`/dashboard/weeks/${week.id}/summary`}
          title="Báo cáo tóm tắt hoạt động Bệnh viện do AI viết"
          className={cn(ACTION, 'bg-amber-50 text-amber-800 hover:bg-amber-100')}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Tóm tắt
        </Link>
      </div>
    </article>
  );
}
