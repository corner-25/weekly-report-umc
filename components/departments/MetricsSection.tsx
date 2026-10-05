'use client';

/** Khối "Số liệu theo dõi": chỉ số chuẩn của phòng theo tuần, kèm xu hướng và độ mới. */
import Link from 'next/link';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/crm/ui';
import { Sparkline } from '@/components/ui/Sparkline';
import type { DepartmentProfile } from '@/lib/department-profile';
import { FOCUS_RING, Freshness } from './bits';

const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/** Thay đổi so với tuần trước: xanh là tăng, đỏ là giảm (chỉ là chiều, không phải tốt/xấu). */
function Delta({ latest, previous }: { latest: number; previous: number | null }) {
  if (previous === null || previous === 0) return null;
  const pct = ((latest - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-slate-400">không đổi</span>;
  return (
    <span className={cn('text-xs font-semibold', pct > 0 ? 'text-emerald-600' : 'text-rose-600')} title="So với tuần có số liệu liền trước">
      {pct > 0 ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
}

export function MetricsSection({ data }: { data: DepartmentProfile }) {
  const c = data.counts;
  const tableUrl = `/dashboard/reports/metrics-data?phong=${encodeURIComponent(data.department.name)}`;
  return (
    <div id="so-lieu" className="scroll-mt-20">
      <SectionCard
        title="Số liệu theo dõi"
        icon={<Gauge className="h-4 w-4 text-brand-600" aria-hidden="true" />}
        action={<Link href={tableUrl} className={cn('rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>Bảng số liệu →</Link>}
      >
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span><b className="tabular-nums text-slate-800">{c.metrics}</b> chỉ số có dữ liệu trong {c.weeksShown} tuần</span>
          <span className="flex items-center gap-1">Mới nhất: <Freshness latestKey={c.metricsLatestKey} weeksBehind={c.metricsWeeksBehind} tracked={c.metrics} /></span>
          {c.flaggedMetrics > 0 && (
            <span className="font-semibold text-amber-700" title="Số liệu AI trích từ báo cáo có cờ cảnh báo, đang chờ rà soát">{c.flaggedMetrics} số liệu cần rà soát</span>
          )}
        </p>
        {data.metricGroups.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có chỉ số chuẩn cho phòng này trong {c.weeksShown} tuần qua.{' '}
            <Link href={`/dashboard/departments/${data.department.id}/metrics`} className="font-semibold text-brand-700 hover:underline">Xem định nghĩa chỉ số →</Link>
          </p>
        ) : (
          <div className="space-y-5">
            {data.metricGroups.map((g) => (
              <div key={g.group}>
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {g.group}
                  {g.total > g.metrics.length && <span className="font-medium normal-case tracking-normal text-slate-400"> · {g.metrics.length}/{g.total} chỉ số</span>}
                </h3>
                <ul className="divide-y divide-slate-100">
                  {g.metrics.map((m) => (
                    <li key={m.path} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-800" title={m.name}>{m.name}</span>
                        <span className="text-[11px] text-slate-400">tuần {m.latest.week} · {m.series.length} tuần dữ liệu</span>
                      </span>
                      <Sparkline values={m.series.map((p) => p.value)} className="hidden sm:block" />
                      <span className="min-w-[5.5rem] text-right">
                        <span className="block text-sm font-bold tabular-nums text-slate-900">
                          {fmt(m.latest.value)}
                          {m.unit && <span className="ml-1 text-xs font-normal text-slate-400">{m.unit}</span>}
                        </span>
                        <Delta latest={m.latest.value} previous={m.previous?.value ?? null} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
