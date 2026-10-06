'use client';

/**
 * Thuật ngữ của bảng điều hành — mỗi con số đều phải nói rõ nó đếm gì. Nút ⓘ
 * cạnh chỉ số và khung "Giải thích thuật ngữ" cuối trang dùng chung một nguồn.
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { DUE_SOON_DAYS, STALE_DAYS } from '@/lib/work/constants';

export const TERMS = {
  total: { label: 'Tổng việc', def: 'Mọi công việc chỉ đạo trong phạm vi đang lọc (năm giao việc, đơn vị).' },
  active: {
    label: 'Đang thực hiện',
    def: 'Việc chưa hoàn thành và chưa huỷ — gồm việc đang xử lý, việc chưa thực hiện và việc tạm dừng.',
  },
  inProgress: { label: 'Đang xử lý', def: 'Trạng thái "Đang xử lý" ở phân hệ Quản lý công việc: đơn vị đã nhận và đang làm.' },
  notStarted: { label: 'Chưa thực hiện', def: 'Trạng thái "Mới" ở phân hệ Quản lý công việc: đã giao, chưa có ai nhận xử lý.' },
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

const TIP_WIDTH = 256;
const TIP_GAP = 6;
const EDGE = 8;

/**
 * Nút ⓘ: rê chuột hoặc Tab tới để đọc định nghĩa. Bong bóng vẽ ra ngoài cùng
 * trang (portal, vị trí cố định) nên không bị khung có overflow che mất; gần
 * mép dưới thì lật lên trên, gần mép trái/phải thì dịch vào trong.
 */
export function InfoTip({ term, className }: { term: TermKey; className?: string; align?: 'center' | 'left' | 'right' }) {
  return <HintTip label={TERMS[term].label} def={TERMS[term].def} className={className} />;
}

/** Nút ⓘ với nhãn và định nghĩa tuỳ ý — dùng cho thuật ngữ của phân hệ khác. */
export function HintTip({ label, def, className }: { label: string; def: string; className?: string }) {
  const id = useId();
  const t = { label, def };
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const b = buttonRef.current!.getBoundingClientRect();
      const h = tipRef.current?.offsetHeight ?? 80;
      const left = Math.min(Math.max(EDGE, b.left + b.width / 2 - TIP_WIDTH / 2), window.innerWidth - TIP_WIDTH - EDGE);
      const below = b.bottom + TIP_GAP;
      const top = below + h > window.innerHeight - EDGE ? b.top - TIP_GAP - h : below;
      setPos({ left, top });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <span className={cn('inline-flex align-middle', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={`Giải thích: ${t.label}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="rounded-full p-0.5 text-slate-400 transition hover:text-brand-600 focus-visible:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            id={id}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: TIP_WIDTH }}
            className="pointer-events-none fixed z-[100] rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-xl animate-fade-in"
          >
            <b className="mb-0.5 block text-[13px]">{t.label}</b>
            {t.def}
          </span>,
          document.body,
        )}
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
