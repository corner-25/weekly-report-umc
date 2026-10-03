'use client';

import { Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARE_STATUS_LABELS, GIFT_TYPE_LABELS } from '@/lib/crm/constants';
import { formatDate, formatMoney } from './format';
import type { CareStatus, CareTaskDTO } from './types';
import { ICON_BTN, SectionCard, SmallAction } from './ui';

const STATUS_TONES: Record<CareStatus, string> = {
  TODO: 'bg-slate-100 text-slate-600 ring-slate-200',
  ORDERED: 'bg-blue-50 text-blue-700 ring-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-slate-50 text-slate-400 ring-slate-200 line-through',
};

const CHIP = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset';

/** Trạng thái việc quà/hoa; chưa có việc thì là "Chưa chuẩn bị" (màu cảnh báo). */
export function CareStatusChip({ status }: { status: CareStatus | null }) {
  if (!status) return <span className={cn(CHIP, 'bg-amber-50 text-amber-800 ring-amber-200')}>Chưa chuẩn bị</span>;
  return <span className={cn(CHIP, STATUS_TONES[status])}>{CARE_STATUS_LABELS[status]}</span>;
}

/** Bước tiếp theo theo trạng thái hiện tại — đã trao thì hết việc. */
const NEXT_STEPS: Record<CareStatus, Array<{ status: CareStatus; label: string }>> = {
  TODO: [{ status: 'ORDERED', label: 'Đã đặt' }, { status: 'DELIVERED', label: 'Đã trao' }, { status: 'CANCELLED', label: 'Huỷ' }],
  ORDERED: [{ status: 'DELIVERED', label: 'Đã trao' }, { status: 'CANCELLED', label: 'Huỷ' }],
  DELIVERED: [],
  CANCELLED: [{ status: 'TODO', label: 'Mở lại' }],
};

interface CareQuickActionsProps {
  task: CareTaskDTO;
  onStatusChange: (task: CareTaskDTO, status: CareStatus) => void;
  className?: string;
}

export function CareQuickActions({ task, onStatusChange, className }: CareQuickActionsProps) {
  const steps = NEXT_STEPS[task.status];
  if (steps.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {steps.map((step) => (
        <button
          key={step.status}
          type="button"
          onClick={() => onStatusChange(task, step.status)}
          className={cn(
            'rounded-lg border px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
            step.status === 'DELIVERED'
              ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
              : step.status === 'CANCELLED'
                ? 'border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'
                : 'border-slate-300 text-slate-700 hover:border-cyan-400 hover:text-cyan-700',
          )}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}

/** "Dự kiến 1.500.000 đ · thực chi 1.200.000 đ" — bỏ phần chưa ghi. */
export function moneyLine(task: Pick<CareTaskDTO, 'budget' | 'actualCost'>): string | null {
  const parts = [
    task.budget != null ? `dự kiến ${formatMoney(task.budget)}` : null,
    task.actualCost != null ? `thực chi ${formatMoney(task.actualCost)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

interface CareTasksPanelProps {
  tasks: CareTaskDTO[];
  onAdd: () => void;
  onEdit: (task: CareTaskDTO) => void;
  onDelete: (task: CareTaskDTO) => void;
  onStatusChange: (task: CareTaskDTO, status: CareStatus) => void;
}

/** Hồ sơ đối tác: quà, hoa đã và sắp tặng theo từng dịp, mới nhất trước. */
export function CareTasksPanel({ tasks, onAdd, onEdit, onDelete, onStatusChange }: CareTasksPanelProps) {
  const spent = tasks.reduce((sum, t) => sum + (t.status === 'DELIVERED' ? t.actualCost ?? 0 : 0), 0);
  return (
    <SectionCard
      title="Quà, hoa đã tặng"
      icon={<Gift className="h-4 w-4 text-rose-500" aria-hidden="true" />}
      action={<SmallAction onClick={onAdd}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Lên kế hoạch</SmallAction>}
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có. Các dịp tới hạn nhắc cũng hiện ở trang Tổng quan CRM.</p>
      ) : (
        <>
          <ul className="divide-y divide-dashed divide-slate-200">
            {tasks.map((t) => {
              const money = moneyLine(t);
              return (
                <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold tabular-nums text-slate-800">{formatDate(t.occasionDate)}</span>
                        <span className="text-slate-500">{t.occasionLabel}</span>
                        <CareStatusChip status={t.status} />
                      </p>
                      <p className={cn('mt-0.5', t.status === 'CANCELLED' ? 'text-slate-400' : 'text-slate-700')}>
                        <b className="font-semibold">{GIFT_TYPE_LABELS[t.giftType]}:</b> {t.description}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[money, t.assigneeName, t.deliveredAt ? `trao ${formatDate(t.deliveredAt)}` : null].filter(Boolean).join(' · ')}
                      </p>
                      {t.note && <p className="mt-0.5 whitespace-pre-line text-xs text-slate-500">{t.note}</p>}
                    </div>
                    <div className="-mr-1 flex shrink-0">
                      <button type="button" onClick={() => onEdit(t)} aria-label="Sửa kế hoạch quà, hoa" className={ICON_BTN}><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => onDelete(t)} aria-label="Xoá kế hoạch quà, hoa" className={cn(ICON_BTN, 'hover:bg-red-50 hover:text-red-600')}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <CareQuickActions task={t} onStatusChange={onStatusChange} className="mt-1.5" />
                </li>
              );
            })}
          </ul>
          {spent > 0 && <p className="mt-3 border-t border-slate-100 pt-2 text-right text-xs text-slate-500">Tổng thực chi đã trao: <b className="font-semibold text-slate-700">{formatMoney(spent)}</b></p>}
        </>
      )}
    </SectionCard>
  );
}
