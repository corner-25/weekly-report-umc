'use client';

import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/crm/ui';
import type { WorkAnalyticsDTO } from '../types';
import { ColumnChart, StackBar, type Segment } from './charts';
import { TONE, healthSegments } from './tones';
import { InfoTip, Term, type TermKey } from './Glossary';

const LEGEND: Array<{ label: string; swatch: string; term: TermKey }> = [
  { label: 'Hoàn thành', swatch: TONE.done.swatch, term: 'done' },
  { label: 'Bình thường', swatch: TONE.active.swatch, term: 'normal' },
  { label: 'Lâu chưa cập nhật', swatch: TONE.stale.swatch, term: 'stale' },
  { label: 'Quá hạn', swatch: TONE.overdue.swatch, term: 'overdue' },
];

export function HealthLegend({ only }: { only?: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {LEGEND.filter((l) => !only || only.includes(l.label)).map((l) => (
        <span key={l.label} className="flex items-center gap-1"><span className={cn('h-2 w-2 rounded-sm', l.swatch)} aria-hidden="true" /><Term term={l.term} align="right">{l.label}</Term></span>
      ))}
    </div>
  );
}

/** Việc đang tồn chia theo tuổi (kể từ ngày chỉ đạo): việc càng cũ càng cần hỏi lý do. */
export function AgingCard({ aging }: { aging: WorkAnalyticsDTO['aging'] }) {
  const max = Math.max(1, ...aging.map((b) => b.active + b.stale + b.overdue));
  return (
    <SectionCard title="Tuổi việc đang thực hiện" info={<InfoTip term="age" align="left" />} action={<HealthLegend only={['Bình thường', 'Lâu chưa cập nhật', 'Quá hạn']} />}>
      <ul className="space-y-3.5">
        {aging.map((b) => {
          const total = b.active + b.stale + b.overdue;
          const segments: Segment[] = [
            { key: 'active', label: 'Bình thường', value: b.active, ...TONE.active },
            { key: 'stale', label: 'Lâu chưa cập nhật', value: b.stale, ...TONE.stale },
            { key: 'overdue', label: 'Quá hạn', value: b.overdue, ...TONE.overdue },
          ];
          return (
            <li key={b.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-slate-600">{b.label}</span>
                <span className="font-bold tabular-nums text-brand-700">{total}</span>
              </div>
              <div style={{ width: `${Math.max(total ? 6 : 0, (total / max) * 100)}%` }}>
                <StackBar segments={segments} className="h-3" />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

const PROGRESS_TONES = ['bg-slate-300', 'bg-rose-300', 'bg-brand-200', 'bg-brand-300', 'bg-brand-500', 'bg-brand-700'];

export function ProgressCard({ progress }: { progress: WorkAnalyticsDTO['progress'] }) {
  return (
    <SectionCard title="Tiến độ việc đang thực hiện" info={<InfoTip term="progressPct" align="left" />} action={<span className="text-xs text-slate-500">theo % đơn vị tự ghi</span>}>
      <ColumnChart data={progress.map((p, i) => ({ label: p.label, count: p.count, className: PROGRESS_TONES[i] }))} />
    </SectionCard>
  );
}

/** Danh sách nhóm có thanh chồng — dùng cho lãnh đạo chỉ đạo và phân loại. */
export function GroupBars({ title, term, rows, empty }: { title: string; term: TermKey; rows: WorkAnalyticsDTO['leaders']; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <SectionCard title={title} info={<InfoTip term={term} align="left" />}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 8).map((r) => (
            <li key={r.name}>
              <div className="mb-1.5 text-sm">
                <p className="font-semibold text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500">
                  <b className="tabular-nums text-slate-800">{r.total}</b> việc · <b className="tabular-nums text-emerald-600">{r.done}</b> xong · <b className="tabular-nums text-brand-700">{r.open}</b> đang thực hiện
                  {r.overdue > 0 && <b className="text-rose-600"> · {r.overdue} quá hạn</b>}
                </p>
              </div>
              <div style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}>
                <StackBar segments={healthSegments(r)} className="h-2.5" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
