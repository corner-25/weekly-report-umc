'use client';

/** Dạng thẻ của tổng quan phòng ban — dùng trên điện thoại và khi chọn "Thẻ". */
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { TERMS } from '@/components/work/dashboard/Glossary';
import type { DepartmentOverviewRow } from '@/lib/department-overview';
import { DeptIcon, Freshness, Num, RateBar, ReportStrip, TONE_SOFT, type Tone } from './bits';

const WORK_CELLS: Array<{ key: 'open' | 'overdue' | 'dueSoon' | 'stale'; label: string; tone: Tone; term: keyof typeof TERMS }> = [
  { key: 'open', label: 'Đang TH', tone: 'active', term: 'active' },
  { key: 'overdue', label: 'Quá hạn', tone: 'overdue', term: 'overdue' },
  { key: 'dueSoon', label: 'Sắp hạn', tone: 'dueSoon', term: 'dueSoon' },
  { key: 'stale', label: 'Lâu chưa CN', tone: 'stale', term: 'stale' },
];

export function OverviewCards({ rows, latestWeek }: { rows: DepartmentOverviewRow[]; latestWeek: { week: number } | null }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id} className={cn(PANEL, 'group relative flex flex-col p-4 transition hover:border-brand-200 hover:shadow-md focus-within:ring-2 focus-within:ring-brand-500')}>
          <div className="flex items-start gap-3">
            <DeptIcon name={r.name} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold leading-snug text-slate-900">
                <Link href={`/dashboard/departments/${r.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl group-hover:text-brand-700">{r.name}</Link>
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{r.description || 'Chưa có mô tả'}</p>
            </div>
          </div>

          <Flags row={r} latestWeek={latestWeek} />

          <dl className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-2 text-center">
            {WORK_CELLS.map((c) => (
              <div key={c.key} title={`${TERMS[c.term].label}: ${TERMS[c.term].def}`}>
                <dt className="flex min-h-[2.4em] items-end justify-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">{c.label}</dt>
                <dd className="text-lg leading-tight"><Num value={r.work[c.key]} tone={c.tone} /></dd>
              </div>
            ))}
          </dl>

          <div className="mb-3 mt-3 flex items-center gap-2 text-xs" title={TERMS.completionRate.def}>
            <span className="shrink-0 text-slate-500">Hoàn thành</span>
            <RateBar value={r.work.completionRate} className="flex-1" />
            <Num value={r.work.completionRate} tone="done" suffix="%" className="w-9 text-right" />
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5" title="Nộp báo cáo tuần — ô xanh là tuần phòng có trong báo cáo chung">
              <ReportStrip strip={r.report.strip} />
              <span className="tabular-nums">{r.report.submittedWeeks}/{r.report.strip.length}</span>
            </span>
            <Freshness latestKey={r.metrics.latestKey} weeksBehind={r.metrics.weeksBehind} tracked={r.metrics.tracked} />
            <span className="ml-auto tabular-nums" title="Thư ký đang làm việc tại phòng">{r.counts.secretaries} thư ký</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Nhãn cảnh báo ngắn — chỉ hiện điều cần chú ý. */
function Flags({ row: r, latestWeek }: { row: DepartmentOverviewRow; latestWeek: { week: number } | null }) {
  const flags: Array<{ text: string; tone: Tone; title: string }> = [];
  if (!r.report.latestSubmitted) flags.push({ text: `Chưa nộp T${latestWeek?.week ?? ''}`, tone: 'stale', title: 'Không có trong báo cáo tuần chung của tuần mới nhất' });
  if (r.threads.needsReview > 0) flags.push({ text: `${r.threads.needsReview} nhiệm vụ cần xác nhận`, tone: 'review', title: 'AI chưa chắc tình trạng, Phòng HC cần xác nhận' });
  if (r.metrics.flagged > 0) flags.push({ text: `${r.metrics.flagged} số liệu cần rà soát`, tone: 'stale', title: 'Số liệu AI trích ra có cờ cảnh báo, đang chờ rà soát' });
  if (r.licensesExpiring > 0) flags.push({ text: `${r.licensesExpiring} giấy phép sắp/đã hết hạn`, tone: 'overdue', title: 'Giấy phép đã hết hạn hoặc hết hạn trong 60 ngày' });
  if (flags.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.text} title={f.title} className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONE_SOFT[f.tone])}>{f.text}</span>
      ))}
    </p>
  );
}

