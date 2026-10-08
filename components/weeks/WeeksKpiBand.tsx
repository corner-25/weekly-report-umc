import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRange } from '@/lib/weeks/hospital-week';
import type { YearAudit } from '@/lib/weeks/audit';
import { STATUS_META } from './badges';

type Tone = 'brand' | 'good' | 'warn' | 'bad' | 'neutral';

interface ToneStyle {
  border: string;
  bgGradient: string;
  badgeBg: string;
  badgeText: string;
  badgeShadow: string;
  titleText: string;
  divider: string;
}

const TONE_STYLES: Record<Tone, ToneStyle> = {
  brand: {
    border: 'border-sky-200/80',
    bgGradient: 'from-sky-50/60 via-white to-white',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    badgeShadow: 'shadow-sky-200/50',
    titleText: 'text-sky-800',
    divider: 'border-sky-100/80',
  },
  good: {
    border: 'border-emerald-200/80',
    bgGradient: 'from-emerald-50/60 via-white to-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeShadow: 'shadow-emerald-200/50',
    titleText: 'text-emerald-800',
    divider: 'border-emerald-100/80',
  },
  warn: {
    border: 'border-amber-200/80',
    bgGradient: 'from-amber-50/60 via-white to-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeShadow: 'shadow-amber-200/50',
    titleText: 'text-amber-800',
    divider: 'border-amber-100/80',
  },
  bad: {
    border: 'border-rose-200/80',
    bgGradient: 'from-rose-50/60 via-white to-white',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    badgeShadow: 'shadow-rose-200/50',
    titleText: 'text-rose-800',
    divider: 'border-rose-100/80',
  },
  neutral: {
    border: 'border-indigo-200/80',
    bgGradient: 'from-indigo-50/60 via-white to-white',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    badgeShadow: 'shadow-indigo-200/50',
    titleText: 'text-indigo-800',
    divider: 'border-indigo-100/80',
  },
};

function Kpi({
  label,
  value,
  hint,
  definition,
  tone,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  definition: string;
  tone: Tone;
  icon: LucideIcon;
}) {
  const st = TONE_STYLES[tone];
  return (
    <div
      title={definition}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md',
        st.border,
        'bg-gradient-to-br',
        st.bgGradient
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', st.titleText)}>{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
              {value}
            </span>
          </div>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105', st.badgeBg, st.badgeText, st.badgeShadow)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {hint && (
        <div className={cn('mt-3 border-t pt-2.5 text-xs text-slate-500 leading-snug', st.divider)}>
          {hint}
        </div>
      )}
    </div>
  );
}

interface WeeksKpiBandProps {
  year: number;
  audit: YearAudit;
  attentionCount: number;
  weekHref: (id: string) => string;
}

export function WeeksKpiBand({ year, audit, attentionCount, weekHref }: WeeksKpiBandProps) {
  const { closedWeekCount, reportedClosedCount, missingWeeks, currentWeek } = audit;
  const missingList = missingWeeks.map((m) => m.weekNumber);

  return (
    <section aria-label="Chỉ số báo cáo tuần" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
      <Kpi
        label="Đã báo cáo"
        icon={CheckCircle2}
        tone={closedWeekCount === 0 ? 'neutral' : missingWeeks.length === 0 ? 'good' : 'warn'}
        value={closedWeekCount === 0 ? '—' : <>{reportedClosedCount}<span className="text-base font-semibold text-slate-400">/{closedWeekCount}</span></>}
        hint={closedWeekCount === 0 ? `Năm ${year} chưa có tuần nào kết thúc` : `tuần đã kết thúc trong năm ${year}`}
        definition="Số tuần đã qua (tính đến hết Thứ Sáu tuần trước) có báo cáo, trên tổng số tuần đã qua."
      />

      {currentWeek ? (
        <Kpi
          label="Tuần hiện tại"
          icon={CalendarDays}
          tone={currentWeek.weekId ? (currentWeek.status === 'COMPLETED' ? 'good' : 'brand') : 'warn'}
          value={`Tuần ${currentWeek.weekNumber}`}
          hint={
            <>
              <span className="font-medium text-slate-700">{formatRange(currentWeek.startKey, currentWeek.endKey)}</span>
              <span className="block mt-0.5">
                {currentWeek.weekId && currentWeek.status
                  ? <>Đã tạo · <Link href={weekHref(currentWeek.weekId)} className="font-semibold text-brand-700 underline-offset-2 hover:underline">{STATUS_META[currentWeek.status].label}</Link></>
                  : <>Chưa có dữ liệu · tự quét hằng ngày</>}
              </span>
            </>
          }
          definition="Tuần báo cáo đang diễn ra (Thứ Bảy → Thứ Sáu). Báo cáo các phòng được quét tự động hằng ngày; chưa có dữ liệu không tính là thiếu cho đến khi tuần kết thúc."
        />
      ) : (
        <Kpi label="Tuần hiện tại" icon={CalendarDays} tone="neutral" value="—" hint={`Không thuộc năm ${year}`} definition="Tuần báo cáo đang diễn ra." />
      )}

      <Kpi
        label="Còn thiếu"
        icon={AlertTriangle}
        tone={missingWeeks.length === 0 ? 'good' : 'bad'}
        value={missingWeeks.length}
        hint={missingWeeks.length === 0 ? 'Không thiếu tuần nào' : `Tuần ${missingList.slice(0, 6).join(', ')}${missingList.length > 6 ? '…' : ''}`}
        definition="Tuần đã kết thúc nhưng chưa có báo cáo trong hệ thống."
      />

      <Kpi
        label="Cần rà soát"
        icon={FileSearch}
        tone={attentionCount === 0 ? 'good' : 'warn'}
        value={attentionCount}
        hint="tuần lệch ngày, trùng ngày, rỗng hoặc thiếu đơn vị"
        definition="Số tuần có vấn đề mức Lỗi dữ liệu hoặc Cần kiểm tra. Mục Thông tin (việc trống kết quả, chưa có số liệu) không tính."
      />
    </section>
  );
}
