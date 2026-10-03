'use client';

import Link from 'next/link';
import { Gift, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GIFT_TYPE_LABELS } from '@/lib/crm/constants';
import { daysUntilLabel, formatMoney } from './format';
import { CareQuickActions, CareStatusChip, moneyLine } from './CareTasksPanel';
import type { CareBudgetSum, CareDueItem, CareStatus, CareTaskDTO } from './types';
import { ICON_BTN, PRIMARY_BTN, SectionCard, TierBadge } from './ui';

interface CareDueSectionProps {
  items: CareDueItem[];
  budget: { month: CareBudgetSum; year: CareBudgetSum };
  loading: boolean;
  onPlan: (item: CareDueItem) => void;
  onEdit: (task: CareTaskDTO) => void;
  onStatusChange: (task: CareTaskDTO, status: CareStatus) => void;
}

function profileHref(target: CareDueItem['target']) {
  return target.type === 'contact' ? `/dashboard/crm/contacts/${target.id}` : `/dashboard/crm/organizations/${target.id}`;
}

/**
 * Tổng quan CRM: các dịp đã tới hạn chuẩn bị quà/hoa (VIP trước 7 ngày, A 3,
 * B 1, C đúng ngày — hoặc theo ngày tự đặt), kèm ngân sách tháng/năm.
 */
export function CareDueSection({ items, budget, loading, onPlan, onEdit, onStatusChange }: CareDueSectionProps) {
  const unplanned = items.filter((i) => !i.task).length;
  return (
    <SectionCard
      title={unplanned > 0 ? `Cần chuẩn bị quà, hoa (${unplanned} chưa lên kế hoạch)` : 'Cần chuẩn bị quà, hoa'}
      icon={<Gift className="h-4 w-4 text-rose-500" aria-hidden="true" />}
    >
      <dl className="mb-3 grid gap-2 sm:grid-cols-2">
        <BudgetTile label="Tháng này" sum={budget.month} />
        <BudgetTile label="Năm nay" sum={budget.year} />
      </dl>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          {loading ? 'Đang tải...' : 'Chưa có dịp nào tới hạn chuẩn bị. Đối tác VIP được nhắc trước 7 ngày, hạng A 3 ngày, B 1 ngày.'}
        </p>
      ) : (
        <ul className={cn('divide-y divide-slate-100', loading && 'opacity-60')}>
          {items.map((item) => <CareDueRow key={`${item.key}@${item.date}`} item={item} onPlan={onPlan} onEdit={onEdit} onStatusChange={onStatusChange} />)}
        </ul>
      )}
    </SectionCard>
  );
}

function BudgetTile({ label, sum }: { label: string; sum: CareBudgetSum }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm tabular-nums text-slate-700">
        Dự kiến <b className="font-semibold text-slate-900">{formatMoney(sum.budget)}</b>
        <span className="text-slate-300"> · </span>
        thực chi <b className={cn('font-semibold', sum.actualCost > sum.budget && sum.budget > 0 ? 'text-amber-700' : 'text-slate-900')}>{formatMoney(sum.actualCost)}</b>
      </dd>
    </div>
  );
}

interface CareDueRowProps {
  item: CareDueItem;
  onPlan: (item: CareDueItem) => void;
  onEdit: (task: CareTaskDTO) => void;
  onStatusChange: (task: CareTaskDTO, status: CareStatus) => void;
}

function CareDueRow({ item, onPlan, onEdit, onStatusChange }: CareDueRowProps) {
  const [, month, day] = item.date.split('-');
  const task = item.task;
  const money = task ? moneyLine(task) : null;
  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 py-2.5 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center">
      <span className={cn('rounded-xl py-1 text-center leading-tight tabular-nums', item.daysUntil === 0 ? 'bg-rose-50 text-rose-700' : 'bg-orange-50 text-orange-700')}>
        <b className="block text-lg">{day}</b>
        <span className="text-[10px] font-semibold">Th{Number(month)}</span>
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-slate-500">{item.label} ·</span>
          <Link href={profileHref(item.target)} className="truncate font-semibold text-slate-900 hover:text-cyan-700 hover:underline">{item.target.name}</Link>
          <TierBadge tier={item.target.tier} />
          <CareStatusChip status={task?.status ?? null} />
        </p>
        <p className="text-xs text-slate-500">
          <span className={cn(item.daysUntil === 0 && 'font-semibold text-rose-600')}>{daysUntilLabel(item.daysUntil)}</span>
          {item.isLunar && ' · âm lịch'}
          {item.target.subtitle && ` · ${item.target.subtitle}`}
        </p>
        {task && (
          <p className="mt-0.5 text-xs text-slate-600">
            <b className="font-semibold">{GIFT_TYPE_LABELS[task.giftType]}:</b> {task.description}
            {[money, task.assigneeName].filter(Boolean).map((part) => ` · ${part}`).join('')}
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-auto sm:justify-end">
        {task ? (
          <>
            <CareQuickActions task={task} onStatusChange={onStatusChange} />
            <button type="button" onClick={() => onEdit(task)} aria-label={`Sửa kế hoạch quà, hoa cho ${item.target.name}`} className={ICON_BTN}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onPlan(item)} className={cn(PRIMARY_BTN, 'px-3 py-1.5 text-xs')}>Lên kế hoạch</button>
        )}
      </div>
    </li>
  );
}
