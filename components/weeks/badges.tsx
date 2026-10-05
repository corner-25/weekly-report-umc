import { AlertOctagon, AlertTriangle, CheckCircle2, Info, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IssueSeverity, WeekIssue, WeekStatus } from '@/lib/weeks/audit';

/** Định nghĩa trạng thái — dùng chung cho badge, chú thích và bộ lọc. */
export const STATUS_META: Record<WeekStatus, { label: string; hint: string; className: string; dot: string }> = {
  DRAFT: {
    label: 'Nháp',
    hint: 'Đã có dữ liệu nhưng chưa chốt. Vào "Sửa" và bấm "Hoàn thành & Lưu" để chốt.',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-400',
  },
  COMPLETED: {
    label: 'Đã chốt',
    hint: 'Báo cáo đã được chốt bằng nút "Hoàn thành & Lưu".',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export function WeekStatusBadge({ status, className }: { status: WeekStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = status === 'COMPLETED' ? CheckCircle2 : PenLine;
  return (
    <span
      title={meta.hint}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        meta.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export const SEVERITY_META: Record<IssueSeverity, { label: string; chip: string; accent: string; dot: string }> = {
  danger: {
    label: 'Lỗi dữ liệu',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
    accent: 'border-l-rose-500',
    dot: 'bg-rose-500',
  },
  warning: {
    label: 'Cần kiểm tra',
    chip: 'bg-orange-50 text-orange-800 ring-orange-200',
    accent: 'border-l-orange-400',
    dot: 'bg-orange-400',
  },
  info: {
    label: 'Thông tin',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    accent: 'border-l-slate-300',
    dot: 'bg-slate-400',
  },
};

const SEVERITY_ICON = { danger: AlertOctagon, warning: AlertTriangle, info: Info } as const;

export function IssueChip({ issue }: { issue: WeekIssue }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = SEVERITY_ICON[issue.severity];
  return (
    <span
      title={`${meta.label}: ${issue.detail}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        meta.chip,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{issue.label}</span>
    </span>
  );
}
