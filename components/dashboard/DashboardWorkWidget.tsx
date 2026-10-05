'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ClipboardList, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner } from '@/components/crm/ui';
import { InfoTip, TERMS, Term, type TermKey } from '@/components/work/dashboard/Glossary';
import { WidgetCard } from './widgets';
import type { DashboardWorkSummary } from './types';

const ITEMS_HREF = '/dashboard/work/items';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

type View = 'open' | 'overdue' | 'dueSoon' | 'stale' | 'done';

const itemsHref = (view: View, departmentId?: string) => {
  const query = new URLSearchParams({ view });
  if (departmentId) query.set('departmentId', departmentId);
  return `${ITEMS_HREF}?${query.toString()}`;
};

/** Mỗi chỉ số một màu theo nghĩa — giống bảng điều hành. */
const KPI_TILES: Array<{ term: TermKey; view: View; pick: (k: DashboardWorkSummary['kpi']) => number; tone: string; bar: string }> = [
  { term: 'overdue', view: 'overdue', pick: (k) => k.overdue, tone: 'text-rose-600', bar: 'bg-rose-500' },
  { term: 'dueSoon', view: 'dueSoon', pick: (k) => k.dueSoon, tone: 'text-orange-600', bar: 'bg-orange-500' },
  { term: 'stale', view: 'stale', pick: (k) => k.stale, tone: 'text-amber-600', bar: 'bg-amber-500' },
  { term: 'done', view: 'done', pick: (k) => k.done, tone: 'text-emerald-600', bar: 'bg-emerald-500' },
];

/**
 * Khối Quản lý công việc (việc Ban Giám đốc chỉ đạo) trên trang Tổng quan:
 * tỷ lệ hoàn thành, các chỉ số cần chú ý và đơn vị nhiều việc quá hạn.
 * Tải riêng — phân hệ lỗi không làm hỏng cả Dashboard.
 */
export function DashboardWorkWidget() {
  const { data, error, isLoading, mutate } = useSWR<DashboardWorkSummary>('/api/work/summary', (url: string) => crmFetch<DashboardWorkSummary>(url), {
    revalidateOnFocus: false,
  });

  const subtitle = data
    ? `${data.kpi.open} việc đang thực hiện · ${data.unitsWithOpen} đơn vị`
    : error ? 'Không tải được dữ liệu' : 'Đang tải…';

  return (
    <WidgetCard icon={ClipboardList} tone="bg-brand-50 text-brand-700" title="Công việc BGĐ chỉ đạo" subtitle={subtitle} href="/dashboard/work" linkLabel="Xem bảng điều hành">
      {error && !data ? (
        <div className="space-y-3 px-5 py-4">
          <ErrorBanner message={errorMessage(error, 'Không tải được số liệu công việc.')} />
          <button
            type="button"
            onClick={() => mutate()}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50', FOCUS_RING)}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Thử lại
          </button>
        </div>
      ) : isLoading || !data ? (
        <WorkWidgetSkeleton />
      ) : data.kpi.total === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Chưa có công việc nào. Nhập dữ liệu ở trang Bảng điều hành.</p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          <KpiRow kpi={data.kpi} />
          <UnitList units={data.units} />
        </div>
      )}
    </WidgetCard>
  );
}

function KpiRow({ kpi }: { kpi: DashboardWorkSummary['kpi'] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      <div className="flex items-center gap-4">
        <CompletionRing rate={kpi.completionRate} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            <Term term="active" />
          </p>
          <Link href={itemsHref('open')} className={cn('rounded text-3xl font-bold tabular-nums text-brand-700 hover:underline', FOCUS_RING)}>
            {kpi.open}
            <span className="sr-only"> việc {TERMS.active.label.toLowerCase()} — xem danh sách</span>
          </Link>
          <p className="text-xs text-slate-500">trên tổng {kpi.total} việc</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2" aria-label="Chỉ số công việc">
        {KPI_TILES.map((t) => (
          <li key={t.term} className="relative rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2 transition hover:border-slate-300 hover:bg-white">
            <span className={cn('absolute inset-y-2 left-0 w-1 rounded-r', t.bar)} aria-hidden="true" />
            <div className="flex items-center gap-0.5 text-xs font-medium text-slate-600">
              <Link
                href={itemsHref(t.view)}
                className={cn('rounded leading-tight after:absolute after:inset-0 after:rounded-xl after:content-[""]', FOCUS_RING)}
              >
                {TERMS[t.term].label}
                <span className="sr-only">: {t.pick(kpi)} việc — xem danh sách</span>
              </Link>
              {/* Nút ⓘ nằm trên lớp phủ của liên kết để vẫn rê/Tab tới được. */}
              <InfoTip term={t.term} className="relative z-10" />
            </div>
            <p className={cn('text-xl font-bold tabular-nums', t.tone)} aria-hidden="true">{t.pick(kpi)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RING_SIZE = 76;
const RING_STROKE = 8;

/** Vòng tỷ lệ hoàn thành (xanh lục = phần đã xong). */
function CompletionRing({ rate }: { rate: number | null }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const value = rate ?? 0;
  return (
    <figure className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90" aria-hidden="true">
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} fill="none" strokeWidth={RING_STROKE} className="stroke-slate-100" />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={r}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
            className="stroke-emerald-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-emerald-600">
          {rate === null ? '—' : `${rate}%`}
        </span>
      </div>
      <figcaption className="whitespace-nowrap text-[11px] font-medium text-slate-500">
        <Term term="completionRate" />
      </figcaption>
    </figure>
  );
}

function UnitList({ units }: { units: DashboardWorkSummary['units'] }) {
  if (units.length === 0) return <p className="text-sm text-slate-500">Không đơn vị nào còn việc đang thực hiện.</p>;
  const maxOpen = Math.max(...units.map((u) => u.open));
  return (
    <section aria-labelledby="work-widget-units">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id="work-widget-units" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Đơn vị cần chú ý
        </h3>
        <p className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500" aria-hidden="true" />
            <Term term="overdue" />
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand-500" aria-hidden="true" />
            <Term term="active" />
          </span>
        </p>
      </div>
      <ol className="space-y-1">
        {units.map((u) => (
          <li key={u.key}>
            <UnitRow unit={u} maxOpen={maxOpen} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function UnitRow({ unit: u, maxOpen }: { unit: DashboardWorkSummary['units'][number]; maxOpen: number }) {
  const width = maxOpen > 0 ? (u.open / maxOpen) * 100 : 0;
  const overdueShare = u.open > 0 ? (u.overdue / u.open) * 100 : 0;
  const body = (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="min-w-0 max-w-full truncate text-sm font-medium text-slate-900">{u.unit}</span>
        <span className="shrink-0 text-xs tabular-nums">
          <span className={cn('font-semibold', u.overdue > 0 ? 'text-rose-600' : 'text-slate-400')}>{u.overdue} quá hạn</span>
          <span className="text-slate-300"> · </span>
          <span className="font-semibold text-brand-700">{u.open} đang thực hiện</span>
        </span>
      </span>
      {/* Thanh dài theo số việc đang thực hiện; phần đỏ là việc đã quá hạn. */}
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className="flex h-full overflow-hidden rounded-full bg-brand-400" style={{ width: `${width}%` }}>
          <span className="h-full bg-rose-500" style={{ width: `${overdueShare}%` }} />
        </span>
      </span>
    </>
  );
  const rowClass = 'block rounded-lg px-2 py-1.5';
  if (!u.departmentId) return <div className={rowClass} title="Đơn vị chưa khớp danh mục phòng ban">{body}</div>;
  return (
    <Link href={itemsHref('open', u.departmentId)} className={cn(rowClass, 'transition hover:bg-slate-50', FOCUS_RING)}>
      {body}
    </Link>
  );
}

function WorkWidgetSkeleton() {
  return (
    <div className="space-y-5 px-5 py-4" aria-busy="true" aria-label="Đang tải số liệu công việc">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex items-center gap-4">
          <div className="h-[76px] w-[76px] animate-pulse rounded-full bg-slate-100" />
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-7 w-14 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {KPI_TILES.map((t) => (
            <div key={t.term} className="h-[60px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
