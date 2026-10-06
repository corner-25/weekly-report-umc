'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { Donut, Legend, type Segment } from '@/components/work/dashboard/charts';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { LIFECYCLE_LABELS, type Portfolio } from '@/lib/mou/portfolio';
import { LIFECYCLE_TONE, MOU_TERMS, MouTerm, type MouTermKey } from './terms';

type Tone = 'live' | 'good' | 'warn' | 'danger' | 'info' | 'violet' | 'muted';
const TEXT: Record<Tone, string> = {
  live: 'text-brand-700',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-sky-600',
  violet: 'text-violet-600',
  muted: 'text-slate-700',
};
const RAIL: Record<Tone, string> = {
  live: 'before:bg-brand-500',
  good: 'before:bg-emerald-500',
  warn: 'before:bg-amber-400',
  danger: 'before:bg-rose-500',
  info: 'before:bg-sky-400',
  violet: 'before:bg-violet-400',
  muted: 'before:bg-slate-300',
};

function Kpi({ term, value, unit, hint, tone, href }: { term: MouTermKey; value: ReactNode; unit?: string; hint?: ReactNode; tone: Tone; href?: string }) {
  const number = (
    <span className={cn('mt-1.5 block text-[28px] font-bold leading-none tabular-nums', TEXT[tone])}>
      {value}
      {unit && <span className="ml-1 text-sm font-semibold opacity-60">{unit}</span>}
    </span>
  );
  return (
    <div className={cn('relative bg-white px-4 py-3.5 pl-5 before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full', RAIL[tone], href && 'transition hover:bg-slate-50')}>
      <p className="flex items-center text-[12px] font-semibold uppercase tracking-wide text-slate-500">
        <MouTerm term={term} />
      </p>
      {href ? (
        <Link href={href} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" title={`Xem danh sách: ${MOU_TERMS[term].label}`}>
          {number}
        </Link>
      ) : (
        number
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
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
    <section className={cn(PANEL, 'grid overflow-hidden lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]')} aria-label="Tổng quan danh mục hợp tác">
      <div className="flex flex-col items-center gap-5 border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white p-5 sm:flex-row lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex flex-col items-center">
          <Donut segments={segments} centerValue={String(k.live)} centerLabel="còn hiệu lực" />
        </div>
        <div className="w-full min-w-0">
          <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
            {k.total} MOU theo vòng đời
            <HintTip label="Vòng đời MOU" def="Tính theo ngày hết hạn so với hôm nay, không theo trạng thái lưu: Hiệu lực → Sắp hết hạn (90 ngày cuối) → Hết hạn. Chờ ký là MOU chưa ký xong; Đã kết thúc là MOU đã đóng." />
          </p>
          <Legend segments={segments} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
        <Kpi term="implementationRate" tone={rateTone} value={k.implementationRate ?? '—'} unit={k.implementationRate === null ? undefined : '%'} hint={`${k.started} / ${k.live} MOU còn hiệu lực đã có kết quả`} href={listHref('live')} />
        <Kpi term="dormant" tone="danger" value={k.dormant} hint="Ký đã lâu, vẫn 0% và chưa có hoạt động" href={listHref('dormant')} />
        <Kpi
          term="decide"
          tone="warn"
          value={k.decide}
          hint={k.expiredOpen ? `${k.expiring} sắp hết hạn · ${k.expiredOpen} đã quá hạn` : `Hết hạn trong 90 ngày tới`}
          href={listHref('decide')}
        />
        <Kpi term="pending" tone="info" value={k.pending} hint={k.pendingSlow ? `${k.pendingSlow} MOU chờ quá 60 ngày` : 'Đang soạn, trình hoặc chờ đối tác ký'} href={listHref('pending')} />
        <Kpi term="international" tone="violet" value={k.international} hint={k.countries ? `${k.countries} quốc gia, vùng lãnh thổ` : 'Đối tác nước ngoài'} />
        <Kpi term="avgProgress" tone="live" value={k.avgProgress ?? '—'} unit={k.avgProgress === null ? undefined : '%'} hint="MOU còn hiệu lực có ghi %" />
        <Kpi term="signedThisYear" tone="good" value={k.signedThisYear} hint={`Năm ${new Date().getFullYear()}`} />
        <Kpi term="noTerm" tone="muted" value={k.noTerm} hint="Không biết khi nào cần đánh giá lại" href={listHref('incomplete')} />
        <Kpi term="incomplete" tone="warn" value={k.incomplete} hint="Thiếu hạn, văn bản, phòng hoặc người phụ trách" href={listHref('incomplete')} />
      </div>
    </section>
  );
}
