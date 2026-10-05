'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import type { WorkAnalyticsDTO } from '../types';
import { Donut, Legend } from './charts';
import { statusSegments } from './tones';
import { TERMS, Term, type TermKey } from './Glossary';
import { DUE_SOON_DAYS, STALE_DAYS } from '@/lib/work/constants';

/** Mỗi chỉ số một màu theo nghĩa của nó — cùng màu với biểu đồ bên dưới. */
type Tone = 'active' | 'done' | 'overdue' | 'dueSoon' | 'stale' | 'time' | 'progress' | 'age' | 'warn';
const TONE_TEXT: Record<Tone, string> = {
  active: 'text-brand-700',
  done: 'text-emerald-600',
  overdue: 'text-rose-600',
  dueSoon: 'text-orange-600',
  stale: 'text-amber-600',
  time: 'text-violet-600',
  progress: 'text-sky-600',
  age: 'text-indigo-600',
  warn: 'text-amber-600',
};
const TONE_RAIL: Record<Tone, string> = {
  active: 'before:bg-brand-500',
  done: 'before:bg-emerald-500',
  overdue: 'before:bg-rose-500',
  dueSoon: 'before:bg-orange-400',
  stale: 'before:bg-amber-400',
  time: 'before:bg-violet-400',
  progress: 'before:bg-sky-400',
  age: 'before:bg-indigo-400',
  warn: 'before:bg-amber-400',
};

function Kpi({ term, value, unit, hint, tone, href }: { term: TermKey; value: ReactNode; unit?: string; hint?: ReactNode; tone: Tone; href?: string }) {
  const cls = cn(
    'relative rounded-xl bg-white px-4 py-3.5 pl-5 before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full',
    TONE_RAIL[tone],
  );
  const number = (
    <span className={cn('mt-1.5 block text-[28px] font-bold leading-none tabular-nums', TONE_TEXT[tone])}>
      {value}
      {unit && <span className="ml-1 text-sm font-semibold opacity-60">{unit}</span>}
    </span>
  );
  return (
    <div className={cn(cls, href && 'transition hover:bg-slate-50')}>
      <p className="flex items-center text-[12px] font-semibold uppercase tracking-wide text-slate-500">
        <Term term={term} align="left" />
      </p>
      {href ? (
        <Link href={href} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title={`Xem danh sách: ${TERMS[term].label}`}>
          {number}
        </Link>
      ) : (
        number
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const rateTone = (rate: number | null, good: number, bad: number): Tone => (rate === null ? 'active' : rate >= good ? 'done' : rate < bad ? 'overdue' : 'warn');

/** Dải số liệu chính: vòng trạng thái bên trái, tám chỉ số điều hành bên phải. */
export function KpiBand({ data, listHref }: { data: WorkAnalyticsDTO; listHref: (view: string) => string }) {
  const k = data.kpi;
  const segments = statusSegments(data.status);
  return (
    <section className={cn(PANEL, 'grid overflow-hidden lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]')} aria-label="Tổng quan">
      <div className="flex flex-col items-center gap-5 border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white p-5 sm:flex-row lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex flex-col items-center">
          <Donut segments={segments} centerValue={k.completionRate === null ? '—' : `${k.completionRate}%`} centerLabel="đã hoàn thành" />
          <span className="mt-1 text-xs font-medium text-slate-500"><Term term="completionRate" /></span>
        </div>
        <div className="w-full min-w-0">
          <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
            <Term term="total">{`${k.total} việc theo trạng thái`}</Term>
          </p>
          <Legend segments={segments} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
        <Kpi term="active" tone="active" value={k.open} hint={`${k.open - k.notStarted - k.paused} đang xử lý · ${k.notStarted} chưa thực hiện · ${k.paused} tạm dừng`} href={listHref('open')} />
        <Kpi term="overdue" tone="overdue" value={k.overdue} hint="Đã qua hạn chót, chưa xong" href={listHref('overdue')} />
        <Kpi term="dueSoon" tone="dueSoon" value={k.dueSoon} hint={`Hạn chót trong ${DUE_SOON_DAYS} ngày tới`} />
        <Kpi term="stale" tone="stale" value={k.stale} hint={`Quá ${STALE_DAYS} ngày không có báo cáo tiến độ`} href={listHref('stale')} />
        <Kpi term="done" tone="done" value={k.done} hint={k.cancelled ? `${k.cancelled} việc đã huỷ` : `Tỷ lệ hoàn thành ${k.completionRate ?? 0}%`} href={listHref('done')} />
        <Kpi
          term="onTime"
          tone={rateTone(k.onTimeRate, 80, 60)}
          value={k.onTimeRate ?? '—'}
          unit={k.onTimeRate === null ? undefined : '%'}
          hint={k.onTimeBase ? `${k.lateDone} trễ / ${k.onTimeBase} việc xong có hạn` : 'Chưa có việc xong nào có hạn'}
        />
        <Kpi term="cycleTime" tone="time" value={k.medianDaysToComplete ?? '—'} unit={k.medianDaysToComplete === null ? undefined : 'ngày'} hint="Trung vị, từ ngày chỉ đạo đến khi xong" />
        <Kpi term="avgProgress" tone="progress" value={k.avgOpenProgress ?? '—'} unit={k.avgOpenProgress === null ? undefined : '%'} hint="Việc đang thực hiện có ghi %" />
        <Kpi term="oldest" tone="age" value={k.oldestOpenDays ?? '—'} unit={k.oldestOpenDays === null ? undefined : 'ngày'} hint="Kể từ ngày chỉ đạo" />
      </div>
    </section>
  );
}
