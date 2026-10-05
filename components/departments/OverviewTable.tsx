'use client';

/** Bảng tổng quan phòng ban (máy tính): mỗi phòng một dòng tín hiệu, bấm tiêu đề cột để xếp. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { InfoTip, type TermKey } from '@/components/work/dashboard/Glossary';
import type { DepartmentOverviewRow } from '@/lib/department-overview';
import { SORT_LABELS, type SortDir, type SortKey } from '@/lib/department-overview-view';
import { DeptIcon, FOCUS_RING, Freshness, Num, RateBar, ReportStrip, type Tone } from './bits';

interface OverviewTableProps {
  rows: DepartmentOverviewRow[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  weeksShown: number;
}

const workHref = (id: string, view?: string) => `/dashboard/work/items?departmentId=${id}${view ? `&view=${view}` : ''}`;

export function OverviewTable({ rows, sort, dir, onSort, weeksShown }: OverviewTableProps) {
  const head = (key: SortKey, label: ReactNode, opts: { term?: TermKey; hint?: string; align?: 'left' | 'right' } = {}) => (
    <th scope="col" aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2.5 font-semibold', opts.align === 'left' ? 'text-left' : 'text-right')}>
      <span className={cn('inline-flex items-center gap-0.5', opts.align !== 'left' && 'flex-row-reverse')}>
        {opts.term && <InfoTip term={opts.term} />}
        <button
          type="button"
          onClick={() => onSort(key)}
          title={opts.hint ?? `Xếp theo ${SORT_LABELS[key].toLowerCase()}`}
          className={cn('inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-slate-900', FOCUS_RING, sort === key && 'text-slate-900')}
        >
          {label}
          <span aria-hidden="true" className={cn('text-[10px]', sort === key ? 'opacity-100' : 'opacity-0')}>{dir === 'asc' ? '▲' : '▼'}</span>
        </button>
      </span>
    </th>
  );

  return (
    <div className={cn(PANEL, 'overflow-x-auto')}>
      <table className="w-full min-w-[1120px] text-sm">
        <caption className="sr-only">Tổng quan phòng ban — bấm tiêu đề cột để sắp xếp</caption>
        <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] text-slate-500">
          <tr>
            {head('name', 'Phòng ban', { align: 'left' })}
            {head('open', 'Đang TH', { term: 'active' })}
            {head('overdue', 'Quá hạn', { term: 'overdue' })}
            {head('dueSoon', 'Sắp hạn', { term: 'dueSoon' })}
            {head('stale', 'Lâu chưa CN', { term: 'stale' })}
            {head('completion', 'Hoàn thành', { term: 'completionRate' })}
            {head('report', 'Báo cáo tuần', { hint: `Số tuần phòng có trong báo cáo chung, ${weeksShown} tuần gần nhất (ô xanh = đã nộp)`, align: 'left' })}
            {head('threads', 'Nhiệm vụ BC', { hint: 'Nhiệm vụ báo cáo tuần có tiến độ đang theo dõi; số tím là nhiệm vụ AI chưa chắc, cần Phòng HC xác nhận' })}
            {head('metrics', 'Số liệu', { hint: 'Số chỉ số chuẩn có dữ liệu và tuần có số liệu mới nhất', align: 'left' })}
            {head('secretaries', 'Thư ký', { hint: 'Thư ký đang làm việc tại phòng' })}
            <th scope="col" className="w-8 px-2"><span className="sr-only">Mở hồ sơ</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="group transition-colors hover:bg-brand-50/30">
              <td className="max-w-[300px] px-3 py-2.5">
                <span className="flex items-center gap-2.5">
                  <DeptIcon name={r.name} size="sm" />
                  <span className="min-w-0">
                    <Link href={`/dashboard/departments/${r.id}`} className={cn('block truncate rounded font-semibold text-slate-900 hover:text-brand-700', FOCUS_RING)}>{r.name}</Link>
                    {r.description && <span className="block truncate text-xs text-slate-500">{r.description}</span>}
                  </span>
                </span>
              </td>
              <WorkCell value={r.work.open} tone="active" href={workHref(r.id)} label="việc đang thực hiện" />
              <WorkCell value={r.work.overdue} tone="overdue" href={workHref(r.id, 'overdue')} label="việc quá hạn" />
              <WorkCell value={r.work.dueSoon} tone="dueSoon" href={workHref(r.id)} label="việc sắp đến hạn" />
              <WorkCell value={r.work.stale} tone="stale" href={workHref(r.id, 'stale')} label="việc lâu chưa cập nhật" />
              <td className="px-3 py-2.5 text-right">
                <Num value={r.work.completionRate} tone="done" suffix="%" />
                <RateBar value={r.work.completionRate} className="ml-auto mt-1 w-16" />
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <ReportStrip strip={r.report.strip} />
                  <span className={cn('text-xs tabular-nums', r.report.latestSubmitted ? 'text-slate-500' : 'font-semibold text-amber-700')}>
                    {r.report.submittedWeeks}/{r.report.strip.length}
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <Num value={r.threads.activeProjects} tone="active" />
                {r.threads.needsReview > 0 && (
                  <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200" title={`${r.threads.needsReview} nhiệm vụ cần xác nhận`}>
                    {r.threads.needsReview} cần XN
                  </span>
                )}
              </td>
              <td className="min-w-[120px] whitespace-nowrap px-3 py-2.5">
                <span className="block text-xs tabular-nums text-slate-700">{r.metrics.tracked ? `${r.metrics.tracked} chỉ số` : ''}</span>
                <Freshness latestKey={r.metrics.latestKey} weeksBehind={r.metrics.weeksBehind} tracked={r.metrics.tracked} />
              </td>
              <td className="px-3 py-2.5 text-right"><Num value={r.counts.secretaries} tone="neutral" /></td>
              <td className="px-2 py-2.5">
                <Link href={`/dashboard/departments/${r.id}`} aria-label={`Mở hồ sơ ${r.name}`} className={cn('flex rounded p-1 text-slate-300 group-hover:text-brand-600', FOCUS_RING)}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkCell({ value, tone, href, label }: { value: number; tone: Tone; href: string; label: string }) {
  return (
    <td className="px-3 py-2.5 text-right">
      {value === 0 ? (
        <Num value={0} tone={tone} />
      ) : (
        <Link href={href} className={cn('rounded px-1 hover:underline', FOCUS_RING)} aria-label={`${value} ${label} — xem danh sách`}>
          <Num value={value} tone={tone} />
        </Link>
      )}
    </td>
  );
}
