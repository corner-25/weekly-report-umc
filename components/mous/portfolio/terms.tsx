'use client';

/**
 * Thuật ngữ của bảng điều hành MOU — mỗi con số nói rõ nó đếm gì; nhãn và màu
 * vòng đời/mức triển khai dùng chung cho bảng điều hành và danh sách.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { DORMANT_MONTHS, EXPIRING_DAYS, PENDING_SLOW_DAYS, LIFECYCLE_LABELS, STAGE_LABELS, type Lifecycle, type Stage } from '@/lib/mou/portfolio';

export const MOU_TERMS = {
  live: { label: 'Còn hiệu lực', def: 'MOU đã ký, chưa kết thúc và chưa qua ngày hết hạn (gồm cả MOU sắp hết hạn và MOU không ghi thời hạn).' },
  started: {
    label: 'Đang triển khai',
    def: 'MOU còn hiệu lực đã có kết quả thực tế: tiến độ trên 0% hoặc có ít nhất một hoạt động hợp tác được ghi nhận.',
  },
  implementationRate: { label: 'Tỷ lệ triển khai', def: 'Số MOU đang triển khai ÷ số MOU còn hiệu lực. Đo xem ký kết có đi vào thực chất hay không.' },
  dormant: {
    label: 'Ký rồi chưa triển khai',
    def: `MOU còn hiệu lực, đã ký quá ${DORMANT_MONTHS} tháng mà tiến độ vẫn 0% và chưa có hoạt động nào. Cần phòng đầu mối giải trình: thúc đẩy hay đề xuất dừng.`,
  },
  decide: {
    label: 'Cần quyết định gia hạn',
    def: `MOU hết hạn trong ${EXPIRING_DAYS} ngày tới, hoặc đã qua ngày hết hạn mà vẫn đang theo dõi — lãnh đạo cần quyết gia hạn, ký mới hay kết thúc.`,
  },
  pending: { label: 'Chờ ký', def: `MOU đang soạn thảo, trình duyệt hoặc chờ đối tác ký (trạng thái "Mới" trên office). Chờ quá ${PENDING_SLOW_DAYS} ngày là chậm.` },
  ended: { label: 'Hết hạn, kết thúc', def: 'MOU đã qua ngày hết hạn hoặc đã đóng ("Hoàn thành" trên office) — chỉ để tra cứu.' },
  international: { label: 'Đối tác quốc tế', def: 'MOU còn hiệu lực với đối tác nước ngoài (nhận từ tên đối tác và quốc gia).' },
  incomplete: {
    label: 'Hồ sơ thiếu',
    def: 'MOU còn hiệu lực thiếu một trong: ngày hết hạn, văn bản ký, phòng đầu mối, người phụ trách — thiếu thì không theo dõi hạn và trách nhiệm được.',
  },
  avgProgress: { label: 'Tiến độ trung bình', def: 'Trung bình % tiến độ của MOU còn hiệu lực: theo các hạng mục nếu đã chia hạng mục, không thì % phòng đầu mối ghi trên office.' },
  signedThisYear: { label: 'Ký mới trong năm', def: 'Số MOU có ngày ký trong năm nay (không tính MOU đang chờ ký).' },
  noTerm: { label: 'Không ghi thời hạn', def: 'MOU còn hiệu lực chưa ghi ngày hết hạn — không biết khi nào cần đánh giá lại.' },
  department: { label: 'Phòng đầu mối', def: 'Đơn vị chủ trì theo dõi, triển khai MOU (đơn vị thực hiện trên office).' },
  field: { label: 'Lĩnh vực hợp tác', def: '"Phân loại lĩnh vực" ghi trên office. Một MOU có thể thuộc nhiều lĩnh vực.' },
} as const satisfies Record<string, { label: string; def: string }>;
export type MouTermKey = keyof typeof MOU_TERMS;

export function MouTerm({ term, children }: { term: MouTermKey; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {children ?? MOU_TERMS[term].label}
      <HintTip label={MOU_TERMS[term].label} def={MOU_TERMS[term].def} />
    </span>
  );
}

export const LIFECYCLE_TONE: Record<Lifecycle, { chip: string; dot: string; stroke: string; swatch: string; text: string }> = {
  ACTIVE: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', stroke: 'stroke-emerald-500', swatch: 'bg-emerald-500', text: 'text-emerald-700' },
  EXPIRING: { chip: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-400', stroke: 'stroke-orange-400', swatch: 'bg-orange-400', text: 'text-orange-600' },
  PENDING: { chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-400', stroke: 'stroke-sky-400', swatch: 'bg-sky-400', text: 'text-sky-700' },
  EXPIRED: { chip: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', stroke: 'stroke-rose-400', swatch: 'bg-rose-400', text: 'text-rose-600' },
  ENDED: { chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', stroke: 'stroke-slate-300', swatch: 'bg-slate-300', text: 'text-slate-500' },
};

export const STAGE_TONE: Record<Stage, { bar: string; text: string; stroke: string; swatch: string }> = {
  NONE: { bar: 'bg-slate-300', text: 'text-slate-500', stroke: 'stroke-slate-300', swatch: 'bg-slate-300' },
  STARTED: { bar: 'bg-brand-500', text: 'text-brand-700', stroke: 'stroke-brand-500', swatch: 'bg-brand-500' },
  DONE: { bar: 'bg-emerald-500', text: 'text-emerald-700', stroke: 'stroke-emerald-500', swatch: 'bg-emerald-500' },
};

export function LifecycleChip({ lifecycle, className }: { lifecycle: Lifecycle; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', LIFECYCLE_TONE[lifecycle].chip, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', LIFECYCLE_TONE[lifecycle].dot)} aria-hidden="true" />
      {LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}

/** Thanh tiến độ nhỏ; null là "chưa ghi". */
export function ProgressBar({ value, stage, className }: { value: number | null; stage: Stage; className?: string }) {
  if (value === null) return <span className={cn('text-xs text-slate-400', className)}>Chưa ghi %</span>;
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={STAGE_LABELS[stage]}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', STAGE_TONE[stage].bar)} style={{ width: `${Math.max(value > 0 ? 4 : 0, Math.min(100, value))}%` }} />
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', value === 0 ? 'text-slate-400' : STAGE_TONE[stage].text)}>{value}%</span>
    </span>
  );
}

/** "Còn 45 ngày" / "Quá hạn 12 ngày" / ngày hết hạn. */
export function ExpiryText({ days, iso }: { days: number | null; iso: string | null }) {
  if (days === null || !iso) return <span className="text-xs text-slate-400">Không thời hạn</span>;
  const date = new Date(iso).toLocaleDateString('vi-VN');
  if (days < 0) return <span className="text-xs font-semibold text-rose-600" title={date}>Quá hạn {-days} ngày</span>;
  if (days <= EXPIRING_DAYS) return <span className="text-xs font-semibold text-orange-600" title={date}>Còn {days} ngày</span>;
  return <span className="text-xs tabular-nums text-slate-600">{date}</span>;
}

export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');
export const fmtMonths = (m: number | null) => (m === null ? '' : m >= 24 ? `${Math.floor(m / 12)} năm` : `${m} tháng`);
