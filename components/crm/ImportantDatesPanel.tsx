'use client';

import { CalendarHeart, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATE_KIND_LABELS } from '@/lib/crm/constants';
import { dayMonth, daysUntilLabel, formatDate, yearsLabel } from './format';
import type { ImportantDateDTO, UpcomingDTO } from './types';
import { ICON_BTN, SectionCard, SmallAction } from './ui';

const SOON_DAYS = 7;

interface BirthInfo {
  day: number | null;
  month: number | null;
  year: number | null;
  isLunar: boolean;
}

interface ImportantDatesPanelProps {
  dates: ImportantDateDTO[];
  upcoming: UpcomingDTO[];
  birth?: BirthInfo;
  onAdd: () => void;
  onEdit: (date: ImportantDateDTO) => void;
  onDelete: (date: ImportantDateDTO) => void;
}

/** Dịp sắp tới của một ngày — API đặt `key` là `date:<id>`, sinh nhật là `birthday:<contactId>`. */
function upcomingFor(upcoming: UpcomingDTO[], dateId: string) {
  return upcoming.find((u) => u.key === `date:${dateId}`);
}

export function ImportantDatesPanel({ dates, upcoming, birth, onAdd, onEdit, onDelete }: ImportantDatesPanelProps) {
  const birthdayNext = birth?.day
    ? upcoming.find((u) => u.key.startsWith('birthday:'))
    : undefined;
  const isEmpty = !birth?.day && dates.length === 0;

  return (
    <SectionCard
      title="Ngày quan trọng"
      icon={<CalendarHeart className="h-4 w-4 text-orange-500" aria-hidden="true" />}
      action={<SmallAction onClick={onAdd}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Thêm ngày</SmallAction>}
    >
      {isEmpty ? (
        <p className="text-sm text-slate-500">Chưa có ngày nào. Thêm sinh nhật (trong Sửa hồ sơ), ngày nhận chức, kỷ niệm…</p>
      ) : (
        <ul className="divide-y divide-dashed divide-slate-200">
          {birth?.day && birth.month && (
            <DateRow
              title="Sinh nhật"
              when={dayMonth(birth.day, birth.month, birth.year)}
              isLunar={birth.isLunar}
              next={birthdayNext}
              extra="Sửa trong hồ sơ"
            />
          )}
          {dates.map((d) => (
            <DateRow
              key={d.id}
              title={d.label ? `${DATE_KIND_LABELS[d.kind]} · ${d.label}` : DATE_KIND_LABELS[d.kind]}
              when={dayMonth(d.day, d.month, d.year)}
              isLunar={d.isLunar}
              next={upcomingFor(upcoming, d.id)}
              extra={[
                d.repeatsYearly ? null : 'một lần',
                d.remindDaysBefore == null ? 'nhắc theo hạng' : d.remindDaysBefore === 0 ? 'nhắc đúng ngày' : `nhắc trước ${d.remindDaysBefore} ngày`,
              ].filter(Boolean).join(' · ')}
              note={d.note}
              actions={
                <>
                  <button type="button" onClick={() => onEdit(d)} aria-label={`Sửa ${DATE_KIND_LABELS[d.kind]}`} className={ICON_BTN}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => onDelete(d)} aria-label={`Xoá ${DATE_KIND_LABELS[d.kind]}`} className={cn(ICON_BTN, 'hover:bg-red-50 hover:text-red-600')}><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

interface DateRowProps {
  title: string;
  when: string;
  isLunar: boolean;
  next?: UpcomingDTO;
  extra?: string;
  note?: string | null;
  actions?: React.ReactNode;
}

function DateRow({ title, when, isLunar, next, extra, note, actions }: DateRowProps) {
  const soon = next !== undefined && next.daysUntil <= SOON_DAYS;
  const years = next ? yearsLabel(next.kind, next.years) : null;
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-slate-800">
          {title}
          <span className="ml-2 font-normal tabular-nums text-slate-600">{when}</span>
          {isLunar && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">âm lịch</span>}
        </p>
        {next && (
          <p className={cn('mt-0.5 text-xs', soon ? 'font-semibold text-orange-600' : 'text-slate-500')}>
            Lần tới: {formatDate(next.date)}, {daysUntilLabel(next.daysUntil)}
            {years && ` · ${years}`}
          </p>
        )}
        {extra && <p className="mt-0.5 text-xs text-slate-400">{extra}</p>}
        {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      </div>
      {actions && <div className="-mr-1 flex shrink-0">{actions}</div>}
    </li>
  );
}
