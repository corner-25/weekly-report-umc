'use client';

/**
 * Mảnh giao diện dùng chung cho trang Phòng ban: màu theo nghĩa (giống bảng điều
 * hành công việc), con số tô màu, dải nộp báo cáo, độ mới số liệu, biểu tượng phòng.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getDeptVisual, PALETTE_STYLES } from '@/lib/department-visual';

/** Cùng một nghĩa thì cùng một màu ở mọi nơi. */
export type Tone = 'active' | 'overdue' | 'dueSoon' | 'stale' | 'done' | 'review' | 'neutral';

export const TONE_TEXT: Record<Tone, string> = {
  active: 'text-brand-700',
  overdue: 'text-rose-600',
  dueSoon: 'text-orange-600',
  stale: 'text-amber-600',
  done: 'text-emerald-600',
  review: 'text-violet-600',
  neutral: 'text-slate-800',
};

export const TONE_RAIL: Record<Tone, string> = {
  active: 'before:bg-brand-500',
  overdue: 'before:bg-rose-500',
  dueSoon: 'before:bg-orange-400',
  stale: 'before:bg-amber-400',
  done: 'before:bg-emerald-500',
  review: 'before:bg-violet-400',
  neutral: 'before:bg-slate-300',
};

export const TONE_SOFT: Record<Tone, string> = {
  active: 'bg-brand-50 text-brand-700 ring-brand-200',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
  dueSoon: 'bg-orange-50 text-orange-700 ring-orange-200',
  stale: 'bg-amber-50 text-amber-800 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  review: 'bg-violet-50 text-violet-700 ring-violet-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

/** Con số tô màu theo nghĩa; số 0 nhạt đi để số khác nổi lên. */
export function Num({ value, tone, suffix, className }: { value: number | null; tone: Tone; suffix?: string; className?: string }) {
  if (value === null) return <span className={cn('tabular-nums text-slate-300', className)}>—</span>;
  return (
    <span className={cn('font-semibold tabular-nums', value === 0 ? 'text-slate-300' : TONE_TEXT[tone], className)}>
      {value.toLocaleString('vi-VN')}{suffix}
    </span>
  );
}

/** Thanh tỷ lệ hoàn thành nhỏ, xanh lá. */
export function RateBar({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)} aria-hidden="true">
      {value !== null && <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, value)}%` }} />}
    </span>
  );
}

/** Dải ô vuông: mỗi ô một tuần (cũ → mới), xanh lá là đã nộp, viền đứt là chưa có. */
export function ReportStrip({ strip, size = 'sm' }: { strip: Array<{ year: number; week: number; submitted: boolean }>; size?: 'sm' | 'md' }) {
  const submitted = strip.filter((s) => s.submitted).length;
  return (
    <span className="flex items-center gap-[3px]" role="img" aria-label={`Đã nộp ${submitted}/${strip.length} tuần gần nhất`}>
      {strip.map((s) => (
        <span
          key={`${s.year}-${s.week}`}
          title={`Tuần ${s.week}/${s.year}: ${s.submitted ? 'đã nộp' : 'chưa có trong báo cáo chung'}`}
          className={cn(
            'shrink-0 rounded-[3px]',
            size === 'sm' ? 'h-3 w-2' : 'h-4 w-3',
            s.submitted ? 'bg-emerald-500' : 'border border-dashed border-slate-300 bg-white',
          )}
        />
      ))}
    </span>
  );
}

/** "T40" nếu mới, "chậm 3 tuần" nếu cũ, "chưa có" nếu không theo dõi. */
export function Freshness({ latestKey, weeksBehind, tracked }: { latestKey: number | null; weeksBehind: number | null; tracked: number }) {
  if (!tracked || latestKey === null) return <span className="text-xs text-slate-400">chưa có số liệu</span>;
  const week = latestKey % 100;
  if (!weeksBehind) return <span className="text-xs font-semibold text-emerald-700" title="Số liệu đã có tới tuần báo cáo mới nhất">đến T{week}</span>;
  return (
    <span className={cn('text-xs font-semibold', weeksBehind >= 2 ? 'text-amber-700' : 'text-slate-600')} title={`Số liệu mới nhất là tuần ${week}, chậm ${weeksBehind} tuần so với tuần báo cáo mới nhất`}>
      T{week} · chậm {weeksBehind} tuần
    </span>
  );
}

/** Ô biểu tượng của phòng theo tên (màu, hình). */
export function DeptIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const visual = getDeptVisual(name);
  const styles = PALETTE_STYLES[visual.palette];
  const Icon = visual.icon;
  const box = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'md' ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg';
  const icon = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className={cn('flex shrink-0 items-center justify-center ring-1 ring-inset', box, styles.bg, styles.text, styles.ring)} aria-hidden="true">
      <Icon className={icon} />
    </span>
  );
}

import type { LucideIcon } from 'lucide-react';

const KPI_TONE_STYLES: Record<Tone, { border: string; bg: string; badge: string; title: string; divider: string }> = {
  active: { border: 'border-sky-200/80', bg: 'from-sky-50/60 via-white to-white', badge: 'bg-sky-100 text-sky-700 shadow-sky-200/50', title: 'text-sky-800', divider: 'border-sky-100/80' },
  overdue: { border: 'border-rose-200/80', bg: 'from-rose-50/60 via-white to-white', badge: 'bg-rose-100 text-rose-700 shadow-rose-200/50', title: 'text-rose-800', divider: 'border-rose-100/80' },
  dueSoon: { border: 'border-orange-200/80', bg: 'from-orange-50/60 via-white to-white', badge: 'bg-orange-100 text-orange-700 shadow-orange-200/50', title: 'text-orange-800', divider: 'border-orange-100/80' },
  stale: { border: 'border-amber-200/80', bg: 'from-amber-50/60 via-white to-white', badge: 'bg-amber-100 text-amber-700 shadow-amber-200/50', title: 'text-amber-800', divider: 'border-amber-100/80' },
  done: { border: 'border-emerald-200/80', bg: 'from-emerald-50/60 via-white to-white', badge: 'bg-emerald-100 text-emerald-700 shadow-emerald-200/50', title: 'text-emerald-800', divider: 'border-emerald-100/80' },
  review: { border: 'border-violet-200/80', bg: 'from-violet-50/60 via-white to-white', badge: 'bg-violet-100 text-violet-700 shadow-violet-200/50', title: 'text-violet-800', divider: 'border-violet-100/80' },
  neutral: { border: 'border-slate-200/80', bg: 'from-slate-50/60 via-white to-white', badge: 'bg-slate-100 text-slate-700 shadow-slate-200/50', title: 'text-slate-800', divider: 'border-slate-100/80' },
};

/** Ô chỉ số dạng thẻ hiện đại có gradient và vạch phân tách. */
export function KpiTile({ label, value, tone, hint, icon: Icon, onClick, active, className }: {
  label: ReactNode;
  value: ReactNode;
  tone: Tone;
  hint?: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const st = KPI_TONE_STYLES[tone];
  const body = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={cn('relative z-10 flex w-fit items-center text-[11px] font-bold uppercase tracking-wider', st.title)}>{label}</span>
          <span className="mt-1.5 block text-2xl font-extrabold leading-none tabular-nums sm:text-[28px] text-slate-900">{value}</span>
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform', st.badge)}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        )}
      </div>
      {hint && <span className={cn('mt-2.5 block text-xs text-slate-500 border-t pt-2 leading-tight', st.divider)}>{hint}</span>}
    </div>
  );
  const cls = cn(
    'relative block min-w-0 rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md bg-gradient-to-br',
    st.border,
    st.bg,
    className,
  );
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <div className={cn(cls, 'hover:-translate-y-0.5 cursor-pointer', active && 'ring-2 ring-inset ring-brand-500')}>
      {body}
      <button type="button" onClick={onClick} aria-pressed={active} className={cn('absolute inset-0 rounded-2xl', FOCUS_RING)}>
        <span className="sr-only">Lọc theo chỉ số này</span>
      </button>
    </div>
  );
}
