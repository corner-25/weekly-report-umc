import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatRange } from '@/lib/weeks/hospital-week';
import type { YearAudit } from '@/lib/weeks/audit';
import { STATUS_META } from './badges';

type Tone = 'brand' | 'good' | 'warn' | 'bad' | 'neutral';

const TONE: Record<Tone, string> = {
  brand: 'border-t-brand-500',
  good: 'border-t-emerald-500',
  warn: 'border-t-orange-400',
  bad: 'border-t-rose-500',
  neutral: 'border-t-slate-300',
};

const VALUE_TONE: Record<Tone, string> = {
  brand: 'text-brand-700',
  good: 'text-emerald-700',
  warn: 'text-orange-700',
  bad: 'text-rose-700',
  neutral: 'text-slate-900',
};

function Kpi({ label, value, hint, definition, tone, children }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  definition: string;
  tone: Tone;
  children?: ReactNode;
}) {
  return (
    <div
      title={definition}
      className={cn('min-w-0 rounded-2xl border border-t-4 border-slate-200/80 bg-white p-4 shadow-sm', TONE[tone])}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums sm:text-3xl', VALUE_TONE[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-slate-500">{hint}</p>}
      {children}
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
    <section aria-label="Chỉ số báo cáo tuần" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label="Đã báo cáo"
        tone={closedWeekCount === 0 ? 'neutral' : missingWeeks.length === 0 ? 'good' : 'warn'}
        value={closedWeekCount === 0 ? '—' : <>{reportedClosedCount}<span className="text-base font-semibold text-slate-400">/{closedWeekCount}</span></>}
        hint={closedWeekCount === 0 ? `Năm ${year} chưa có tuần nào kết thúc` : `tuần đã kết thúc trong năm ${year}`}
        definition="Số tuần đã qua (tính đến hết Thứ Sáu tuần trước) có báo cáo, trên tổng số tuần đã qua."
      />

      {currentWeek ? (
        <Kpi
          label="Tuần hiện tại"
          tone={currentWeek.weekId ? (currentWeek.status === 'COMPLETED' ? 'good' : 'brand') : 'warn'}
          value={`Tuần ${currentWeek.weekNumber}`}
          hint={
            <>
              {formatRange(currentWeek.startKey, currentWeek.endKey)}
              <br />
              {currentWeek.weekId && currentWeek.status
                ? <>Đã tạo · <Link href={weekHref(currentWeek.weekId)} className="font-semibold text-brand-700 underline-offset-2 hover:underline">{STATUS_META[currentWeek.status].label}</Link></>
                : <>Chưa có dữ liệu · hệ thống tự quét hằng ngày</>}
            </>
          }
          definition="Tuần báo cáo đang diễn ra (Thứ Bảy → Thứ Sáu). Báo cáo các phòng được quét tự động hằng ngày; chưa có dữ liệu không tính là thiếu cho đến khi tuần kết thúc."
        />
      ) : (
        <Kpi label="Tuần hiện tại" tone="neutral" value="—" hint={`Không thuộc năm ${year}`} definition="Tuần báo cáo đang diễn ra." />
      )}

      <Kpi
        label="Còn thiếu"
        tone={missingWeeks.length === 0 ? 'good' : 'bad'}
        value={missingWeeks.length}
        hint={missingWeeks.length === 0 ? 'Không thiếu tuần nào' : `Tuần ${missingList.slice(0, 6).join(', ')}${missingList.length > 6 ? '…' : ''}`}
        definition="Tuần đã kết thúc nhưng chưa có báo cáo trong hệ thống."
      />

      <Kpi
        label="Cần rà soát"
        tone={attentionCount === 0 ? 'good' : 'warn'}
        value={attentionCount}
        hint="tuần lệch ngày, trùng ngày, rỗng hoặc thiếu đơn vị"
        definition="Số tuần có vấn đề mức Lỗi dữ liệu hoặc Cần kiểm tra. Mục Thông tin (việc trống kết quả, chưa có số liệu) không tính."
      />
    </section>
  );
}
