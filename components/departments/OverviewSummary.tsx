'use client';

/** Dải số liệu toàn viện đầu trang Phòng ban; bấm một ô để lọc bảng theo ô đó. */
import { AlertTriangle, Briefcase, CheckCircle2, Clock, FileCheck, Hourglass } from 'lucide-react';
import { Term } from '@/components/work/dashboard/Glossary';
import type { FilterKey, OverviewTotals } from '@/lib/department-overview-view';
import { KpiTile } from './bits';

interface OverviewSummaryProps {
  totals: OverviewTotals;
  latestWeek: { year: number; week: number } | null;
  filter: FilterKey;
  onFilter: (filter: FilterKey) => void;
}

export function OverviewSummary({ totals: t, latestWeek, filter, onFilter }: OverviewSummaryProps) {
  const toggle = (key: FilterKey) => () => onFilter(filter === key ? 'all' : key);
  const missing = t.departments - t.reportedLatest;
  return (
    <section aria-label="Tổng quan toàn viện" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 sm:gap-4">
        <KpiTile tone="active" icon={Briefcase} label={<Term term="active" />} value={t.open.toLocaleString('vi-VN')} hint="công việc chỉ đạo của các phòng" />
        <KpiTile
          tone="overdue" icon={AlertTriangle} label={<Term term="overdue" />} value={t.overdue}
          hint="bấm để lọc phòng có việc quá hạn" onClick={toggle('overdue')} active={filter === 'overdue'}
        />
        <KpiTile tone="dueSoon" icon={Clock} label={<Term term="dueSoon" />} value={t.dueSoon} hint="hạn chót trong 30 ngày tới" />
        <KpiTile
          tone="stale" icon={Hourglass} label={<Term term="stale" />} value={t.stale}
          hint="bấm để lọc phòng có việc im lâu" onClick={toggle('stale')} active={filter === 'stale'}
        />
        <KpiTile
          tone="done" icon={CheckCircle2} label={<Term term="completionRate" />} value={t.completionRate === null ? '—' : `${t.completionRate}%`}
          hint={`${t.done.toLocaleString('vi-VN')} việc đã hoàn thành`}
        />
        <KpiTile
          tone={missing > 0 ? 'stale' : 'done'}
          icon={FileCheck}
          label={<span title="Số phòng có trong báo cáo tuần chung của tuần mới nhất">Nộp báo cáo {latestWeek ? `T${latestWeek.week}` : 'tuần'}</span>}
          value={<>{t.reportedLatest}<span className="text-base font-semibold text-slate-400">/{t.departments}</span></>}
          hint={missing > 0 ? `${missing} phòng chưa nộp — bấm để lọc` : 'mọi phòng đã nộp'}
          onClick={toggle('noReport')} active={filter === 'noReport'}
        />
      </div>
      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Danh mục: <b className="text-slate-700">{t.departments}</b> phòng ban · <b className="text-slate-700">{t.masterTasks.toLocaleString('vi-VN')}</b> nhiệm vụ thường kỳ ·{' '}
        <b className="text-slate-700">{t.metricDefinitions.toLocaleString('vi-VN')}</b> định nghĩa chỉ số · <b className="text-slate-700">{t.secretaries}</b> thư ký ·{' '}
        <b className="text-slate-700">{t.mous}</b> MOU · <b className="text-slate-700">{t.licenses}</b> giấy phép
        {t.licensesExpiring > 0 && <span className="font-semibold text-rose-600"> ({t.licensesExpiring} đã/sắp hết hạn trong 60 ngày)</span>}
        {t.needsReview > 0 && <> · <b className="text-violet-700">{t.needsReview}</b> nhiệm vụ báo cáo tuần cần xác nhận</>}
      </p>
    </section>
  );
}
