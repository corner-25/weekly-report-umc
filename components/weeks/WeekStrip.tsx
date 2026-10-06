import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatRange, hospitalWeekRange, weeksInYear } from '@/lib/weeks/hospital-week';
import { worstSeverity, type WeekIssue, type YearAudit } from '@/lib/weeks/audit';
import { SEVERITY_META, STATUS_META } from './badges';
import type { WeekListItem } from './types';

type CellState = 'COMPLETED' | 'DRAFT' | 'MISSING' | 'CURRENT' | 'FUTURE';

const CELL: Record<CellState, string> = {
  COMPLETED: 'bg-emerald-600 text-white hover:bg-emerald-700',
  DRAFT: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  MISSING: 'border border-dashed border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100',
  CURRENT: 'bg-white text-brand-700 ring-2 ring-inset ring-brand-500 hover:bg-brand-50',
  FUTURE: 'bg-slate-50 text-slate-300',
};

const LEGEND: { state: CellState; label: string; hint: string }[] = [
  { state: 'COMPLETED', label: STATUS_META.COMPLETED.label, hint: STATUS_META.COMPLETED.hint },
  { state: 'DRAFT', label: STATUS_META.DRAFT.label, hint: STATUS_META.DRAFT.hint },
  { state: 'MISSING', label: 'Thiếu', hint: 'Tuần đã kết thúc nhưng chưa có báo cáo.' },
  { state: 'CURRENT', label: 'Tuần hiện tại', hint: 'Tuần đang diễn ra.' },
  { state: 'FUTURE', label: 'Chưa tới', hint: 'Tuần chưa bắt đầu.' },
];

interface WeekStripProps {
  year: number;
  weeks: WeekListItem[];
  audit: YearAudit;
  weekHref: (id: string) => string;
}

/** Dải 52 ô — nhìn một lần biết tuần nào đã có, thiếu, nháp hay có vấn đề. */
export function WeekStrip({ year, weeks, audit, weekHref }: WeekStripProps) {
  const byNumber = new Map(weeks.filter((w) => w.year === year).map((w) => [w.weekNumber, w]));
  const missing = new Set(audit.missingWeeks.map((m) => m.weekNumber));
  const currentNumber = audit.currentWeek?.weekNumber ?? null;
  const total = weeksInYear(year);

  const cells = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const week = byNumber.get(n);
    const range = hospitalWeekRange(n, year);
    const state: CellState = week
      ? (week.status === 'COMPLETED' ? 'COMPLETED' : 'DRAFT')
      : n === currentNumber ? 'CURRENT' : missing.has(n) ? 'MISSING' : 'FUTURE';
    const issues: WeekIssue[] = week ? audit.issuesByWeek[week.id] ?? [] : [];
    const worst = worstSeverity(issues.filter((x) => x.severity !== 'info'));
    const label = LEGEND.find((l) => l.state === state)?.label ?? '';
    const title = [
      `Tuần ${n}: ${formatRange(range.startKey, range.endKey)}`,
      label,
      ...issues.filter((x) => x.severity !== 'info').map((x) => x.label),
    ].join(' · ');
    return { n, week, state, worst, title, startKey: range.startKey };
  });

  return (
    <section aria-labelledby="week-strip-heading" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="week-strip-heading" className="text-sm font-bold text-slate-900">Bản đồ {total} tuần năm {year}</h2>
        <p className="text-xs text-slate-500">Bấm vào ô để mở báo cáo hoặc tạo tuần còn thiếu</p>
      </div>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
        {cells.map((c) => {
          const content = (
            <>
              <span className="tabular-nums">{c.n}</span>
              {c.worst && (
                <span
                  aria-hidden="true"
                  className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', SEVERITY_META[c.worst].dot)}
                />
              )}
            </>
          );
          const cls = cn(
            'relative flex h-9 items-center justify-center rounded-lg text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            CELL[c.state],
          );
          return (
            <li key={c.n}>
              {c.week ? (
                <Link href={weekHref(c.week.id)} title={c.title} aria-label={c.title} className={cls}>{content}</Link>
              ) : (
                <span title={c.title} className={cls}>{content}</span>
              )}
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Chú thích">
        {LEGEND.map((l) => (
          <li key={l.state} className="inline-flex items-center gap-1.5" title={l.hint}>
            <span aria-hidden="true" className={cn('h-3 w-3 rounded', CELL[l.state])} />
            {l.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5" title="Chấm đỏ: lỗi dữ liệu (trùng ngày, rỗng). Chấm cam: cần kiểm tra (lệch ngày, thiếu đơn vị).">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span aria-hidden="true" className="-ml-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
          Có vấn đề
        </li>
      </ul>
    </section>
  );
}
