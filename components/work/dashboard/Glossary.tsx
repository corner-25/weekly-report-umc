'use client';

/**
 * Thuật ngữ của bảng điều hành — mỗi con số đều phải nói rõ nó đếm gì. Nút ⓘ
 * cạnh chỉ số và khung "Giải thích thuật ngữ" cuối trang dùng chung một nguồn.
 */
import { useId, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { DUE_SOON_DAYS, STALE_DAYS } from '@/lib/work/constants';

export const TERMS = {
  total: { label: 'Tổng việc', def: 'Mọi công việc chỉ đạo trong phạm vi đang lọc (năm giao việc, đơn vị).' },
  active: {
    label: 'Đang thực hiện',
    def: 'Việc chưa hoàn thành và chưa huỷ — gồm việc đang xử lý, việc chưa bắt đầu và việc tạm dừng.',
  },
  inProgress: { label: 'Đang xử lý', def: 'Trạng thái "Đang xử lý" ở phân hệ Quản lý công việc: đơn vị đã nhận và đang làm.' },
  notStarted: { label: 'Chưa bắt đầu', def: 'Trạng thái "Mới" ở phân hệ Quản lý công việc: đã giao, chưa có ai nhận xử lý.' },
  paused: { label: 'Tạm dừng', def: 'Trạng thái "Ngưng" ở phân hệ Quản lý công việc: tạm dừng theo chỉ đạo, vẫn tính là việc đang thực hiện.' },
  cancelled: { label: 'Đã huỷ', def: 'Việc bị huỷ/thu hồi — không tính vào tỷ lệ hoàn thành.' },
  done: { label: 'Hoàn thành', def: 'Trạng thái "Hoàn thành" ở phân hệ Quản lý công việc.' },
  completionRate: { label: 'Tỷ lệ hoàn thành', def: 'Số việc hoàn thành ÷ (tổng việc − việc đã huỷ).' },
  overdue: { label: 'Quá hạn', def: 'Việc đang thực hiện đã qua hạn chót mà chưa hoàn thành. Chỉ xét việc có ghi hạn.' },
  dueSoon: { label: 'Sắp đến hạn', def: `Việc đang thực hiện có hạn chót trong ${DUE_SOON_DAYS} ngày tới.` },
  stale: {
    label: 'Lâu chưa cập nhật',
    def: `Việc đang thực hiện quá ${STALE_DAYS} ngày không có dòng báo cáo tiến độ mới. Việc chưa có dòng nào thì tính từ ngày chỉ đạo.`,
  },
  normal: { label: 'Bình thường', def: `Việc đang thực hiện, chưa quá hạn và có cập nhật trong ${STALE_DAYS} ngày qua.` },
  onTime: { label: 'Đúng hạn', def: 'Trong các việc đã hoàn thành có ghi hạn: tỷ lệ việc xong trước hoặc đúng ngày hạn.' },
  cycleTime: {
    label: 'Thời gian xử lý',
    def: 'Số ngày từ ngày chỉ đạo đến ngày hoàn thành. Lấy trung vị: một nửa số việc xong nhanh hơn con số này.',
  },
  avgProgress: { label: 'Tiến độ trung bình', def: 'Trung bình % do đơn vị tự ghi của các việc đang thực hiện có ghi %.' },
  oldest: { label: 'Tồn lâu nhất', def: 'Số ngày, tính từ ngày chỉ đạo, của việc đang thực hiện lâu nhất.' },
  age: { label: 'Tuổi việc', def: 'Số ngày từ ngày chỉ đạo đến hôm nay.' },
  assigned: { label: 'Giao mới', def: 'Số việc có ngày chỉ đạo trong tháng (không có ngày chỉ đạo thì lấy ngày tạo việc).' },
  backlog: { label: 'Còn tồn cuối tháng', def: 'Việc đã giao tính đến cuối tháng mà đến cuối tháng đó chưa hoàn thành (không tính việc đã huỷ).' },
  leadUnit: { label: 'Đơn vị chủ trì', def: 'Đơn vị được giao chính ở phân hệ Quản lý công việc. Tên mờ là đơn vị chưa khớp danh mục phòng ban.' },
  leader: { label: 'Lãnh đạo chỉ đạo', def: 'Thành viên Ban Giám đốc giao việc (người giao ở phân hệ Quản lý công việc).' },
  category: { label: 'Hình thức chỉ đạo', def: 'Phân loại ở phân hệ Quản lý công việc: Giao ban tuần, Giao ban tháng, Cuộc họp, Chỉ đạo trực tiếp.' },
  progressPct: { label: '% tiến độ', def: 'Phần trăm đơn vị tự ghi ở phân hệ Quản lý công việc; "Chưa ghi %" là việc chưa từng ghi.' },
} as const satisfies Record<string, { label: string; def: string }>;

export type TermKey = keyof typeof TERMS;

/** Nút ⓘ: rê chuột hoặc Tab tới để đọc định nghĩa. */
export function InfoTip({ term, className, align = 'center' }: { term: TermKey; className?: string; align?: 'center' | 'left' | 'right' }) {
  const id = useId();
  const t = TERMS[term];
  return (
    <span className={cn('group/tip relative inline-flex align-middle', className)}>
      <button type="button" aria-describedby={id} aria-label={`Giải thích: ${t.label}`} className="rounded-full p-0.5 text-slate-400 transition hover:text-brand-600 focus-visible:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none invisible absolute top-full z-30 mt-1.5 w-64 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-xl transition duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'left' && 'left-0',
          align === 'right' && 'right-0',
        )}
      >
        <b className="mb-0.5 block text-[13px]">{t.label}</b>
        {t.def}
      </span>
    </span>
  );
}

/** Nhãn kèm nút ⓘ. */
export function Term({ term, children, align }: { term: TermKey; children?: ReactNode; align?: 'center' | 'left' | 'right' }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {children ?? TERMS[term].label}
      <InfoTip term={term} align={align} />
    </span>
  );
}

const GROUPS: Array<{ title: string; terms: TermKey[] }> = [
  { title: 'Trạng thái', terms: ['active', 'inProgress', 'notStarted', 'paused', 'done', 'cancelled'] },
  { title: 'Cần chú ý', terms: ['overdue', 'dueSoon', 'stale', 'normal'] },
  { title: 'Chỉ số', terms: ['total', 'completionRate', 'onTime', 'cycleTime', 'avgProgress', 'oldest', 'age', 'progressPct'] },
  { title: 'Biểu đồ và nhóm', terms: ['assigned', 'backlog', 'leadUnit', 'leader', 'category'] },
];

/** Bảng thuật ngữ đầy đủ, gập lại mặc định để không chiếm chỗ. */
export function GlossaryCard() {
  return (
    <details className={cn(PANEL, 'group p-4 sm:p-5')}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-slate-900 marker:hidden">
        <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />
        Giải thích thuật ngữ và cách tính
        <span className="ml-auto text-xs font-medium text-slate-500 group-open:hidden">Mở</span>
        <span className="ml-auto hidden text-xs font-medium text-slate-500 group-open:inline">Thu gọn</span>
      </summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <dl className="space-y-2 text-sm">
              {g.terms.map((k) => (
                <div key={k} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3">
                  <dt className="font-semibold text-slate-800">{TERMS[k].label}</dt>
                  <dd className="text-slate-600">{TERMS[k].def}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}
