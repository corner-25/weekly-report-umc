'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  History,
  Hourglass,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import type { WorkAnalyticsDTO } from '../types';
import { Donut, Legend } from './charts';
import { statusSegments } from './tones';
import { TERMS, Term, type TermKey } from './Glossary';
import { DUE_SOON_DAYS, STALE_DAYS } from '@/lib/work/constants';

type Tone = 'active' | 'done' | 'overdue' | 'dueSoon' | 'stale' | 'time' | 'progress' | 'age' | 'warn';

interface ToneStyle {
  border: string;
  bgGradient: string;
  badgeBg: string;
  badgeText: string;
  badgeShadow: string;
  titleText: string;
  unitText: string;
  divider: string;
}

const TONE_STYLES: Record<Tone, ToneStyle> = {
  active: {
    border: 'border-sky-200/80',
    bgGradient: 'from-sky-50/60 via-white to-white',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    badgeShadow: 'shadow-sky-200/50',
    titleText: 'text-sky-800',
    unitText: 'text-sky-700',
    divider: 'border-sky-100/80',
  },
  done: {
    border: 'border-emerald-200/80',
    bgGradient: 'from-emerald-50/60 via-white to-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeShadow: 'shadow-emerald-200/50',
    titleText: 'text-emerald-800',
    unitText: 'text-emerald-700',
    divider: 'border-emerald-100/80',
  },
  overdue: {
    border: 'border-rose-200/80',
    bgGradient: 'from-rose-50/60 via-white to-white',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    badgeShadow: 'shadow-rose-200/50',
    titleText: 'text-rose-800',
    unitText: 'text-rose-700',
    divider: 'border-rose-100/80',
  },
  dueSoon: {
    border: 'border-orange-200/80',
    bgGradient: 'from-orange-50/60 via-white to-white',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    badgeShadow: 'shadow-orange-200/50',
    titleText: 'text-orange-800',
    unitText: 'text-orange-700',
    divider: 'border-orange-100/80',
  },
  stale: {
    border: 'border-amber-200/80',
    bgGradient: 'from-amber-50/60 via-white to-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeShadow: 'shadow-amber-200/50',
    titleText: 'text-amber-800',
    unitText: 'text-amber-700',
    divider: 'border-amber-100/80',
  },
  time: {
    border: 'border-violet-200/80',
    bgGradient: 'from-violet-50/60 via-white to-white',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    badgeShadow: 'shadow-violet-200/50',
    titleText: 'text-violet-800',
    unitText: 'text-violet-700',
    divider: 'border-violet-100/80',
  },
  progress: {
    border: 'border-indigo-200/80',
    bgGradient: 'from-indigo-50/60 via-white to-white',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    badgeShadow: 'shadow-indigo-200/50',
    titleText: 'text-indigo-800',
    unitText: 'text-indigo-700',
    divider: 'border-indigo-100/80',
  },
  age: {
    border: 'border-slate-200/80',
    bgGradient: 'from-slate-50/60 via-white to-white',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeShadow: 'shadow-slate-200/50',
    titleText: 'text-slate-800',
    unitText: 'text-slate-600',
    divider: 'border-slate-100/80',
  },
  warn: {
    border: 'border-amber-200/80',
    bgGradient: 'from-amber-50/60 via-white to-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeShadow: 'shadow-amber-200/50',
    titleText: 'text-amber-800',
    unitText: 'text-amber-700',
    divider: 'border-amber-100/80',
  },
};

function Kpi({
  term,
  value,
  unit,
  hint,
  tone,
  href,
  icon: Icon,
}: {
  term: TermKey;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone: Tone;
  href?: string;
  icon: LucideIcon;
}) {
  const st = TONE_STYLES[tone];
  const cardContent = (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200',
        st.border,
        'bg-gradient-to-br',
        st.bgGradient,
        href ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : 'hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', st.titleText)}>
            <Term term={term} align="left" />
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
              {value}
            </span>
            {unit && <span className={cn('text-xs font-bold', st.unitText)}>{unit}</span>}
          </div>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105', st.badgeBg, st.badgeText, st.badgeShadow)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {hint && (
        <div className={cn('mt-3 border-t pt-2 text-[11px] text-slate-500 leading-tight', st.divider)}>
          {hint}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title={`Xem danh sách: ${TERMS[term].label}`}>
        {cardContent}
      </Link>
    );
  }
  return cardContent;
}

const rateTone = (rate: number | null, good: number, bad: number): Tone => (rate === null ? 'active' : rate >= good ? 'done' : rate < bad ? 'overdue' : 'warn');

/** Dải số liệu chính: vòng trạng thái bên trái, chín thẻ chỉ số điều hành hiện đại bên phải. */
export function KpiBand({ data, listHref }: { data: WorkAnalyticsDTO; listHref: (view: string) => string }) {
  const k = data.kpi;
  const segments = statusSegments(data.status);
  return (
    <section className={cn(PANEL, 'grid overflow-hidden lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] shadow-sm')} aria-label="Tổng quan">
      <div className="flex flex-col items-center justify-center gap-5 border-b border-slate-100 bg-gradient-to-br from-brand-50/50 via-white to-white p-5 sm:flex-row lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex flex-col items-center">
          <Donut segments={segments} centerValue={k.completionRate === null ? '—' : `${k.completionRate}%`} centerLabel="đã hoàn thành" />
          <span className="mt-2 text-xs font-bold uppercase tracking-wider text-brand-800"><Term term="completionRate" /></span>
        </div>
        <div className="w-full min-w-0">
          <p className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-800">
            <Term term="total">{`${k.total} việc theo trạng thái`}</Term>
          </p>
          <Legend segments={segments} />
        </div>
      </div>
      <div className="p-4 sm:p-5 bg-slate-50/40 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi term="active" icon={Briefcase} tone="active" value={k.open} hint={`${k.open - k.notStarted - k.paused} đang xử lý · ${k.notStarted} chưa làm`} href={listHref('open')} />
        <Kpi term="overdue" icon={AlertTriangle} tone="overdue" value={k.overdue} hint="Đã qua hạn chót, chưa xong" href={listHref('overdue')} />
        <Kpi term="dueSoon" icon={Clock} tone="dueSoon" value={k.dueSoon} hint={`Hạn chót trong ${DUE_SOON_DAYS} ngày tới`} />
        <Kpi term="stale" icon={AlertCircle} tone="stale" value={k.stale} hint={`Quá ${STALE_DAYS} ngày không có báo cáo`} href={listHref('stale')} />
        <Kpi term="done" icon={CheckCircle2} tone="done" value={k.done} hint={k.cancelled ? `${k.cancelled} việc đã huỷ` : `Tỷ lệ hoàn thành ${k.completionRate ?? 0}%`} href={listHref('done')} />
        <Kpi
          term="onTime"
          icon={Target}
          tone={rateTone(k.onTimeRate, 80, 60)}
          value={k.onTimeRate ?? '—'}
          unit={k.onTimeRate === null ? undefined : '%'}
          hint={k.onTimeBase ? `${k.lateDone} trễ / ${k.onTimeBase} việc có hạn` : 'Chưa có việc có hạn hoàn thành'}
        />
        <Kpi term="cycleTime" icon={Hourglass} tone="time" value={k.medianDaysToComplete ?? '—'} unit={k.medianDaysToComplete === null ? undefined : 'ngày'} hint="Trung vị từ chỉ đạo đến khi xong" />
        <Kpi term="avgProgress" icon={TrendingUp} tone="progress" value={k.avgOpenProgress ?? '—'} unit={k.avgOpenProgress === null ? undefined : '%'} hint="Việc đang thực hiện có ghi %" />
        <Kpi term="oldest" icon={History} tone="age" value={k.oldestOpenDays ?? '—'} unit={k.oldestOpenDays === null ? undefined : 'ngày'} hint="Kể từ ngày chỉ đạo giao việc" />
      </div>
    </section>
  );
}
