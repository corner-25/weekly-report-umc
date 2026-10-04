'use client';

/**
 * Số liệu theo dõi — chỉ số chuẩn của từng phòng theo tuần.
 *
 * Mặc định mở theo MỘT phòng (phòng của người dùng, không có thì Phòng Hành
 * chính): chỉ số gom theo nhóm như cây chỉ số của phòng, mỗi dòng có đường xu
 * hướng 12 tuần, số tuần mới nhất và mức đổi so với tuần trước. Bấm một dòng để
 * xem đủ các tuần trong năm. Phòng đang xem nằm trên URL để gửi link cho nhau.
 */

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { AlertTriangle, ChevronDown, Search, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toSearchKey } from '@/lib/crm/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Sparkline } from '@/components/ui/Sparkline';
import { crmFetch } from '@/components/crm/api';
import { ErrorBanner, PANEL } from '@/components/crm/ui';
import type { BoardDepartment, BoardMetric, MetricBoard } from '@/lib/metric-board';

const NOTABLE = 15;
const DEFAULT_DEPARTMENT = 'Phòng Hành chính';
type View = 'all' | 'changed' | 'flagged';

function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function ChangeChip({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-xs text-slate-400">—</span>;
  const notable = Math.abs(percent) >= NOTABLE;
  const up = percent > 0;
  if (Math.abs(percent) < 0.5) return <span className="text-xs text-slate-400">không đổi</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        notable ? (up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'text-slate-500',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      {up ? '+' : ''}
      {Math.abs(percent) >= 1000 ? `${Math.round(percent / 100)}×` : `${percent.toFixed(0)}%`}
    </span>
  );
}

/** Đủ các tuần trong năm: cột cao theo giá trị, tuần mới nhất tô đậm. */
function WeekBars({ metric }: { metric: BoardMetric }) {
  const max = Math.max(...metric.series.map((p) => p.value), 0) || 1;
  return (
    <div className="space-y-2 px-3 pb-4 pt-1 sm:px-4">
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Giá trị ${metric.series.length} tuần`}>
        {metric.series.map((p, i) => (
          <div key={p.week} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              title={`Tuần ${p.week}: ${formatValue(p.value)}${metric.unit ? ` ${metric.unit}` : ''} · ${p.source === 'EXCEL' ? 'file số liệu' : 'báo cáo tuần'}`}
              className={cn('rounded-t-sm transition-colors', i === metric.series.length - 1 ? 'bg-brand-600' : 'bg-brand-200 group-hover:bg-brand-400')}
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-slate-400">
        <span>T{metric.series[0].week}</span>
        <span>Rê chuột lên cột để xem số từng tuần</span>
        <span>T{metric.latest.week}</span>
      </div>
    </div>
  );
}

function MetricRow({ metric, latestWeek }: { metric: BoardMetric; latestWeek: number }) {
  const [open, setOpen] = useState(false);
  const stale = metric.latest.week < latestWeek;
  return (
    <li className="border-t border-slate-100 first:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_104px_120px_84px_16px] sm:px-4"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-800" title={metric.subPath}>{metric.subPath}</span>
            {metric.flaggedWeeks > 0 && (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label={`${metric.flaggedWeeks} tuần cần rà soát`} />
            )}
          </span>
          <span className="block text-[11px] text-slate-400">
            {metric.unit ?? 'không đơn vị'} · {metric.series.length} tuần{stale && ` · lần cuối tuần ${metric.latest.week}`}
          </span>
        </span>
        <Sparkline values={metric.series.slice(-12).map((p) => p.value)} width={104} className="hidden sm:block" />
        <span className="text-right">
          <span className={cn('block text-base font-bold tabular-nums', stale ? 'text-slate-400' : 'text-slate-900')}>{formatValue(metric.latest.value)}</span>
          <span className="block text-[11px] text-slate-400">TB 12 tuần {formatValue(metric.recentAverage)}</span>
        </span>
        <span className="hidden text-right sm:block"><ChangeChip percent={metric.changePercent} /></span>
        <ChevronDown className={cn('hidden h-4 w-4 text-slate-400 transition-transform sm:block', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && <WeekBars metric={metric} />}
    </li>
  );
}

function DepartmentPanel({ dept, view, query }: { dept: BoardDepartment; view: View; query: string }) {
  const q = toSearchKey(query);
  const groups = dept.groups
    .map((g) => ({
      ...g,
      metrics: g.metrics.filter((m) => {
        if (q && !toSearchKey(g.name, m.subPath).includes(q)) return false;
        if (view === 'changed') return m.latest.week === dept.latestWeek && Math.abs(m.changePercent ?? 0) >= NOTABLE;
        if (view === 'flagged') return m.flaggedWeeks > 0;
        return true;
      }),
    }))
    .filter((g) => g.metrics.length > 0);

  if (groups.length === 0) {
    return <p className={cn(PANEL, 'p-10 text-center text-sm text-slate-500')}>Không có chỉ số nào khớp bộ lọc.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.name} className={cn(PANEL, 'overflow-hidden')} aria-label={g.name}>
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4">
            <h3 className="text-sm font-bold text-slate-800">{g.name}</h3>
            <span className="text-xs text-slate-500">{g.metrics.length} chỉ số</span>
          </header>
          <div className="hidden grid-cols-[minmax(0,1fr)_104px_120px_84px_16px] gap-x-4 px-4 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Chỉ số</span><span>12 tuần</span><span className="text-right">Tuần {dept.latestWeek}</span><span className="text-right">So tuần trước</span><span />
          </div>
          <ul>{g.metrics.map((m) => <MetricRow key={m.code} metric={m} latestWeek={dept.latestWeek} />)}</ul>
        </section>
      ))}
    </div>
  );
}

function MetricsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: session } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const { data, error, isLoading } = useSWR<MetricBoard>(`/api/metrics/board?year=${year}`, (url: string) => crmFetch<MetricBoard>(url), {
    revalidateOnFocus: false,
  });

  const departments = useMemo(() => data?.departments ?? [], [data]);
  const userDept = departments.find((d) => d.id && d.id === session?.user?.departmentId);
  const selectedName = params.get('phong') ?? userDept?.name ?? DEFAULT_DEPARTMENT;
  const dept = departments.find((d) => d.name === selectedName) ?? departments[0];

  const choose = (name: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('phong', name);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Table2}
        title="Số liệu theo dõi"
        description="Chỉ số chuẩn của từng phòng theo tuần — số trong file số liệu của phòng được ưu tiên hơn số đọc từ báo cáo"
        actions={
          <div className="w-36">
            <label htmlFor="board-year" className="sr-only">Năm</label>
            <Select id="board-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[0, 1, 2].map((i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>Năm {y}</option>;
              })}
            </Select>
          </div>
        }
      />
      <ErrorBanner message={error ? (error as Error).message : ''} />

      {/* Chọn phòng: mỗi phòng một nút, kèm số chỉ số và số chỉ số đổi mạnh tuần này */}
      <nav aria-label="Chọn phòng" className="flex flex-wrap gap-2">
        {isLoading && !data
          ? Array.from({ length: 8 }, (_, i) => <span key={i} className="h-9 w-40 animate-pulse rounded-xl bg-slate-200/70" />)
          : departments.map((d) => {
              const on = d.name === dept?.name;
              const moved = d.rising + d.falling;
              return (
                <button
                  key={d.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(d.name)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    on ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
                  )}
                >
                  {d.name.replace(/^Phòng /, '')}
                  <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', on ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{d.metricCount}</span>
                  {moved > 0 && !on && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={`${moved} chỉ số đổi mạnh`} />}
                </button>
              );
            })}
      </nav>

      {dept && (
        <>
          <div className={cn(PANEL, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4')}>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{dept.name}</h2>
              <p className="text-sm text-slate-500">
                {dept.metricCount} chỉ số · số mới nhất tuần {dept.latestWeek}/{data?.year}
                {dept.id && <> · <Link href={`/dashboard/departments/${dept.id}`} className="font-medium text-brand-700 hover:underline">Hồ sơ phòng</Link></>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-xl bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">↑ {dept.rising} tăng mạnh</span>
              <span className="rounded-xl bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">↓ {dept.falling} giảm mạnh</span>
              {dept.flagged > 0 && <span className="rounded-xl bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">⚠ {dept.flagged} cần rà soát</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Lọc chỉ số" className="inline-flex rounded-xl bg-slate-100 p-1">
              {([['all', 'Tất cả'], ['changed', `Đổi trên ${NOTABLE}%`], ['flagged', 'Cần rà soát']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Tìm chỉ số</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm chỉ số trong phòng (gõ không dấu được)"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          <DepartmentPanel key={dept.name} dept={dept} view={view} query={query} />
        </>
      )}
      {data && departments.length === 0 && <p className={cn(PANEL, 'p-10 text-center text-sm text-slate-500')}>Năm {year} chưa có chỉ số chuẩn nào.</p>}
    </div>
  );
}

export default function MetricsDataPage() {
  return (
    <Suspense>
      <MetricsBoard />
    </Suspense>
  );
}
