'use client';

/**
 * Tổng quan nhiệm vụ toàn viện — gộp "Phân tích nhiệm vụ" và "Tổng hợp theo đầu mục"
 * cũ: mỗi phòng một dòng, đếm việc theo tình trạng AI đã đánh giá từ báo cáo tuần.
 * Bấm tên phòng để xem từng việc.
 */
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';

export interface DepartmentStats {
  id: string;
  name: string;
  style: string;
  total: number;
  activeProjects: number;
  needsReview: number;
  latestWeek: number;
  done: number;
  stalled: number;
  stopped: number;
  routine: number;
  avgProgress: number | null;
}

const STYLE_LABELS: Record<string, string> = {
  NO_PERCENT: 'Không ghi %',
  ALWAYS_100: 'Ghi 100% mỗi tuần',
  PROGRESSIVE: 'Ghi % thật',
  MIXED: 'Ghi lẫn lộn',
};

const COLUMNS: Array<{ key: keyof DepartmentStats; label: string; hint: string; tone: string }> = [
  { key: 'activeProjects', label: 'Có tiến độ', hint: 'Việc có đích đang làm (theo dõi bằng %)', tone: 'text-brand-700' },
  { key: 'done', label: 'Hoàn thành', hint: 'Việc đã xong trong năm', tone: 'text-emerald-600' },
  { key: 'stalled', label: 'Đứng yên', hint: 'Còn báo cáo nhưng % và nội dung không đổi nhiều tuần', tone: 'text-amber-600' },
  { key: 'stopped', label: 'Ngừng báo cáo', hint: 'Không còn trong báo cáo, chưa có dấu hiệu xong', tone: 'text-rose-600' },
  { key: 'routine', label: 'Thường kỳ', hint: 'Việc tuần nào cũng làm, không gán %', tone: 'text-slate-600' },
  { key: 'needsReview', label: 'Cần xác nhận', hint: 'AI chưa chắc — Phòng HC xem lại', tone: 'text-violet-700' },
];

export function ThreadsOverview({ departments, onOpen }: { departments: DepartmentStats[]; onOpen: (name: string) => void }) {
  const sum = (k: keyof DepartmentStats) => departments.reduce((s, d) => s + (Number(d[k]) || 0), 0);
  const rows = [...departments].sort((a, b) => b.activeProjects + b.stalled - (a.activeProjects + a.stalled) || a.name.localeCompare(b.name, 'vi'));
  const max = Math.max(1, ...rows.map((d) => d.total));
  return (
    <div className="space-y-4">
      <div className={cn(PANEL, 'grid grid-cols-2 gap-px overflow-hidden bg-slate-100 sm:grid-cols-3 lg:grid-cols-6')}>
        {COLUMNS.map((c) => (
          <div key={c.key} className="bg-white px-4 py-3" title={c.hint}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', c.tone)}>{sum(c.key)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{c.hint}</p>
          </div>
        ))}
      </div>

      <section className={cn(PANEL, 'overflow-hidden')} aria-label="Nhiệm vụ theo phòng">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Phòng</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Số việc</th>
                {COLUMNS.map((c) => <th key={c.key} scope="col" title={c.hint} className="px-3 py-2.5 text-right font-semibold">{c.label}</th>)}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold" title="Tiến độ trung bình các việc có tiến độ">TB %</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Tuần mới nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-brand-50/40">
                  <th scope="row" className="px-4 py-2.5 text-left">
                    <button type="button" onClick={() => onOpen(d.name)} className="text-left font-semibold text-slate-900 hover:text-brand-700 hover:underline">{d.name}</button>
                    <span className="block text-[11px] font-normal text-slate-400">{STYLE_LABELS[d.style] ?? d.style}</span>
                  </th>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 rounded-full bg-slate-300" style={{ width: `${Math.max(4, (d.total / max) * 80)}px` }} aria-hidden="true" />
                      <span className="tabular-nums text-slate-700">{d.total}</span>
                    </span>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2.5 text-right tabular-nums', d[c.key] ? cn('font-semibold', c.tone) : 'text-slate-300')}>{d[c.key] as number}</td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{d.avgProgress === null ? '—' : `${d.avgProgress}%`}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{d.latestWeek || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
