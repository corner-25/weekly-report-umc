'use client';

/** Dải chỉ số chính của một phòng — mỗi số một màu theo nghĩa, nhãn có giải thích. */
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { Term } from '@/components/work/dashboard/Glossary';
import type { DepartmentProfile } from '@/lib/department-profile';
import { KpiTile, type Tone } from './bits';

const rateTone = (rate: number | null, good: number, bad: number): Tone => (rate === null ? 'neutral' : rate >= good ? 'done' : rate < bad ? 'overdue' : 'stale');

export function ProfileKpis({ data }: { data: DepartmentProfile }) {
  const k = data.work.kpi;
  const c = data.counts;
  const t = data.threads.summary;
  const pctText = (v: number | null) => (v === null ? '—' : `${v}%`);
  return (
    <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
      <KpiTile tone="active" label={<Term term="active" />} value={k.open} hint={`trên ${k.total} công việc chỉ đạo`} />
      <KpiTile tone="overdue" label={<Term term="overdue" />} value={k.overdue} hint={k.overdue ? 'cần đôn đốc ngay' : 'không có việc quá hạn'} />
      <KpiTile tone="dueSoon" label={<Term term="dueSoon" />} value={k.dueSoon} hint="hạn chót trong 30 ngày tới" />
      <KpiTile tone="stale" label={<Term term="stale" />} value={k.stale} hint="quá 14 ngày không có cập nhật" />
      <KpiTile
        tone={rateTone(k.completionRate, 80, 50)} label={<Term term="completionRate" />}
        value={pctText(k.completionRate)} hint={`${k.done} việc hoàn thành`}
      />
      <KpiTile
        tone={rateTone(k.onTimeRate, 80, 50)} label={<Term term="onTime" />}
        value={pctText(k.onTimeRate)} hint={k.onTimeBase ? `${k.onTimeBase - k.lateDone}/${k.onTimeBase} việc xong có hạn` : 'chưa có việc xong có hạn'}
      />
      <KpiTile
        tone={c.weeksSubmitted === c.weeksShown ? 'done' : c.weeksSubmitted < c.weeksShown / 2 ? 'overdue' : 'stale'}
        label={<span title="Số tuần phòng có trong báo cáo tuần chung">Nộp báo cáo tuần</span>}
        value={<>{c.weeksSubmitted}<span className="text-base font-semibold text-slate-400">/{c.weeksShown}</span></>}
        hint={`${c.weeksShown} tuần gần nhất`}
      />
      <KpiTile
        tone={t.needsReview ? 'review' : 'active'}
        label={<span title="Nhiệm vụ trong báo cáo tuần năm nay, AI theo dõi tình trạng từng việc">Nhiệm vụ báo cáo tuần</span>}
        value={t.activeProjects}
        hint={t.needsReview ? `đang theo dõi tiến độ · ${t.needsReview} cần xác nhận` : 'đang theo dõi tiến độ'}
      />
    </section>
  );
}
