'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarOff,
  Clock,
  FileSignature,
  FileWarning,
  Globe,
  Handshake,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { Donut, Legend, type Segment } from '@/components/work/dashboard/charts';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { LIFECYCLE_LABELS, type Portfolio } from '@/lib/mou/portfolio';
import { LIFECYCLE_TONE, MOU_TERMS, MouTerm, type MouTermKey } from './terms';

type Tone = 'live' | 'good' | 'warn' | 'danger' | 'info' | 'violet' | 'muted';

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
  live: {
    border: 'border-brand-200/80',
    bgGradient: 'from-brand-50/60 via-white to-white',
    badgeBg: 'bg-brand-100',
    badgeText: 'text-brand-700',
    badgeShadow: 'shadow-brand-200/50',
    titleText: 'text-brand-800',
    unitText: 'text-brand-700',
    divider: 'border-brand-100/80',
  },
  good: {
    border: 'border-emerald-200/80',
    bgGradient: 'from-emerald-50/60 via-white to-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeShadow: 'shadow-emerald-200/50',
    titleText: 'text-emerald-800',
    unitText: 'text-emerald-700',
    divider: 'border-emerald-100/80',
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
  danger: {
    border: 'border-rose-200/80',
    bgGradient: 'from-rose-50/60 via-white to-white',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    badgeShadow: 'shadow-rose-200/50',
    titleText: 'text-rose-800',
    unitText: 'text-rose-700',
    divider: 'border-rose-100/80',
  },
  info: {
    border: 'border-sky-200/80',
    bgGradient: 'from-sky-50/60 via-white to-white',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    badgeShadow: 'shadow-sky-200/50',
    titleText: 'text-sky-800',
    unitText: 'text-sky-700',
    divider: 'border-sky-100/80',
  },
  violet: {
    border: 'border-violet-200/80',
    bgGradient: 'from-violet-50/60 via-white to-white',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    badgeShadow: 'shadow-violet-200/50',
    titleText: 'text-violet-800',
    unitText: 'text-violet-700',
    divider: 'border-violet-100/80',
  },
  muted: {
    border: 'border-slate-200/80',
    bgGradient: 'from-slate-50/60 via-white to-white',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeShadow: 'shadow-slate-200/50',
    titleText: 'text-slate-800',
    unitText: 'text-slate-600',
    divider: 'border-slate-100/80',
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
  term: MouTermKey;
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
            <MouTerm term={term} />
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
      <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title={`Xem danh sách: ${MOU_TERMS[term].label}`}>
        {cardContent}
      </Link>
    );
  }
  return cardContent;
}

/** Vòng đời toàn danh mục bên trái; chín chỉ số lãnh đạo cần nhìn bên phải. */
export function PortfolioKpis({ data, listHref }: { data: Portfolio; listHref: (view: string) => string }) {
  const k = data.kpi;
  const segments: Segment[] = data.lifecycle.map((l) => ({
    key: l.key,
    label: LIFECYCLE_LABELS[l.key],
    value: l.count,
    stroke: LIFECYCLE_TONE[l.key].stroke,
    swatch: LIFECYCLE_TONE[l.key].swatch,
  }));
  const rateTone: Tone = k.implementationRate === null ? 'live' : k.implementationRate >= 70 ? 'good' : k.implementationRate < 40 ? 'danger' : 'warn';
  return (
    <section className={cn(PANEL, 'grid overflow-hidden lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] shadow-sm')} aria-label="Tổng quan danh mục hợp tác">
      <div className="flex flex-col items-center justify-center gap-5 border-b border-slate-100 bg-gradient-to-br from-brand-50/50 via-white to-white p-5 sm:flex-row lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex flex-col items-center">
          <Donut segments={segments} centerValue={String(k.live)} centerLabel="còn hiệu lực" />
          <span className="mt-2 text-xs font-bold uppercase tracking-wider text-brand-800">MOU còn hiệu lực</span>
        </div>
        <div className="w-full min-w-0">
          <p className="mb-2 flex items-center gap-1 text-sm font-bold text-slate-800">
            {k.total} MOU theo vòng đời
            <HintTip label="Vòng đời MOU" def="Tính theo ngày hết hạn so với hôm nay, không theo trạng thái lưu: Hiệu lực → Sắp hết hạn (90 ngày cuối) → Hết hạn. Chờ ký là MOU chưa ký xong; Đã kết thúc là MOU đã đóng." />
          </p>
          <Legend segments={segments} />
        </div>
      </div>
      <div className="p-4 sm:p-5 bg-slate-50/40 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi term="implementationRate" icon={Activity} tone={rateTone} value={k.implementationRate ?? '—'} unit={k.implementationRate === null ? undefined : '%'} hint={`${k.started} / ${k.live} MOU còn hiệu lực có kết quả`} href={listHref('live')} />
        <Kpi term="dormant" icon={AlertTriangle} tone="danger" value={k.dormant} hint="Ký đã lâu, vẫn 0% và chưa có hoạt động" href={listHref('dormant')} />
        <Kpi
          term="decide"
          icon={Clock}
          tone="warn"
          value={k.decide}
          hint={k.expiredOpen ? `${k.expiring} sắp hết hạn · ${k.expiredOpen} đã quá hạn` : `Hết hạn trong 90 ngày tới`}
          href={listHref('decide')}
        />
        <Kpi term="pending" icon={FileSignature} tone="info" value={k.pending} hint={k.pendingSlow ? `${k.pendingSlow} MOU chờ quá 60 ngày` : 'Đang soạn, trình hoặc chờ đối tác ký'} href={listHref('pending')} />
        <Kpi term="international" icon={Globe} tone="violet" value={k.international} hint={k.countries ? `${k.countries} quốc gia, vùng lãnh thổ` : 'Đối tác nước ngoài'} />
        <Kpi term="avgProgress" icon={TrendingUp} tone="live" value={k.avgProgress ?? '—'} unit={k.avgProgress === null ? undefined : '%'} hint="MOU còn hiệu lực có ghi %" />
        <Kpi term="signedThisYear" icon={Handshake} tone="good" value={k.signedThisYear} hint={`Ký mới trong năm ${new Date().getFullYear()}`} />
        <Kpi term="noTerm" icon={CalendarOff} tone="muted" value={k.noTerm} hint="Không rõ hạn đánh giá lại" href={listHref('incomplete')} />
        <Kpi term="incomplete" icon={FileWarning} tone="warn" value={k.incomplete} hint="Thiếu hạn, file, hoặc đầu mối" href={listHref('incomplete')} />
      </div>
    </section>
  );
}
