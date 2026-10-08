'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import type { VipEscortStats } from '@/lib/crm/vip-escort-stats';
import { crmFetch } from './api';
import { formatDate } from './format';
import { PANEL } from './ui';
import type { ComboValue } from './EntityCombobox';

function Bars({
  rows,
  onPick,
  active,
  tone,
}: {
  rows: Array<{ name: string; count: number; id?: string }>;
  onPick?: (item: { name: string; id?: string }) => void;
  active?: string;
  tone: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id ?? r.name}>
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(r)}
            aria-pressed={onPick ? Boolean(active === r.name || (r.id && active === r.id)) : undefined}
            className={cn(
              'group w-full rounded-lg px-1.5 py-1 text-left text-xs transition enabled:hover:bg-slate-50',
              (active === r.name || (r.id && active === r.id)) && 'bg-cyan-50 font-semibold text-cyan-900'
            )}
          >
            <span className="flex justify-between gap-2">
              <span className="truncate text-slate-700">{r.name}</span>
              <b className="tabular-nums text-slate-900">{r.count}</b>
            </span>
            <span className="mt-0.5 block h-1.5 rounded-full bg-slate-100">
              <span
                className={cn('block h-full rounded-full transition-all', tone)}
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface VipEscortStatsCardProps {
  year: string;
  onYear: (y: string) => void;
  referrerFilter: ComboValue | null;
  onReferrerFilter: (val: ComboValue | null) => void;
  doctorFilter: ComboValue | null;
  onDoctorFilter: (val: ComboValue | null) => void;
}

export function VipEscortStatsCard({
  year,
  onYear,
  referrerFilter,
  onReferrerFilter,
  doctorFilter,
  onDoctorFilter,
}: VipEscortStatsCardProps) {
  const { data, error } = useSWR<VipEscortStats>(
    '/api/crm/vip-escorts/stats',
    (url: string) => crmFetch<VipEscortStats>(url),
    { revalidateOnFocus: false }
  );

  if (error) return null;
  if (!data) return <div className={cn(PANEL, 'h-64 animate-pulse bg-slate-50')} aria-hidden="true" />;

  const activeRefId = referrerFilter && 'id' in referrerFilter ? referrerFilter.id : '';
  const activeDocId = doctorFilter && 'id' in doctorFilter ? doctorFilter.id : '';

  const totalNew = data.byYear.reduce((s, y) => s + y.newVisit, 0);
  const totalRevisit = data.byYear.reduce((s, y) => s + y.revisit, 0);
  const totalOther = data.byYear.reduce((s, y) => s + y.otherVisit, 0);
  const totalCancelled = data.byYear.reduce((s, y) => s + y.postponedOrCancelled, 0);

  return (
    <section className={cn(PANEL, 'space-y-5 p-4 sm:p-5')} aria-label="Thống kê dẫn khám VIP">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">Sổ dẫn khám VIP</h2>
        <p className="text-xs text-slate-500">
          <b className="text-emerald-700">{data.totals.done}</b> lượt đã khám ·{' '}
          <b className="text-slate-700">{data.totals.patients}</b> khách VIP ·{' '}
          <b className="text-slate-700">{data.totals.referrers}</b> người giới thiệu ·{' '}
          <b className="text-slate-700">{data.totals.doctors}</b> bác sĩ
          {data.totals.planned > 0 && (
            <> · <b className="text-amber-700">{data.totals.planned}</b> lịch hẹn</>
          )}
        </p>
      </div>

      {/* Bảng năm × loại hình khám giống hệt Sổ tiếp đoàn */}
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Số lượt dẫn khám VIP đã thực hiện theo năm và loại khám</caption>
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              <th scope="col" className="px-4 py-2 text-left font-semibold sm:px-5">Năm</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-cyan-800">Khám mới</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-blue-800">Tái khám</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-600">Khác</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-emerald-800">Đã khám</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold text-violet-700 sm:px-5" title="Hoãn hoặc huỷ">Hoãn/Huỷ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.byYear.map((y) => (
              <tr key={y.year} className={cn('hover:bg-slate-50 transition-colors', year === String(y.year) && 'bg-cyan-50/60')}>
                <th scope="row" className="px-4 py-2 text-left sm:px-5">
                  <button
                    type="button"
                    onClick={() => onYear(year === String(y.year) ? '' : String(y.year))}
                    className="font-bold text-slate-900 hover:text-cyan-700 hover:underline"
                    aria-pressed={year === String(y.year)}
                  >
                    {y.year}
                  </button>
                </th>
                <td className={cn('px-3 py-2 text-right tabular-nums', y.newVisit ? 'text-cyan-700 font-medium' : 'text-slate-300')}>
                  {y.newVisit}
                </td>
                <td className={cn('px-3 py-2 text-right tabular-nums', y.revisit ? 'text-blue-700 font-medium' : 'text-slate-300')}>
                  {y.revisit}
                </td>
                <td className={cn('px-3 py-2 text-right tabular-nums', y.otherVisit ? 'text-slate-600' : 'text-slate-300')}>
                  {y.otherVisit}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                  {y.done}
                </td>
                <td className={cn('px-4 py-2 text-right tabular-nums sm:px-5', y.postponedOrCancelled ? 'text-violet-700' : 'text-slate-300')}>
                  {y.postponedOrCancelled}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 font-bold">
              <th scope="row" className="px-4 py-2 text-left sm:px-5">Tổng</th>
              <td className="px-3 py-2 text-right tabular-nums text-cyan-800">{totalNew}</td>
              <td className="px-3 py-2 text-right tabular-nums text-blue-800">{totalRevisit}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{totalOther}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{data.totals.done}</td>
              <td className="px-4 py-2 text-right tabular-nums sm:px-5 text-violet-700">{totalCancelled}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lưới 4 cột phân tích giống hệt phong cách Sổ tiếp đoàn */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Cột 1: Người giới thiệu nhiều nhất */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Người giới thiệu nhiều nhất
          </h3>
          <ol className="space-y-1.5 text-xs">
            {data.topReferrers.map((r) => {
              const isSelected = activeRefId === r.id;
              return (
                <li key={r.id} className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onReferrerFilter(isSelected ? null : { id: r.id, label: r.name })}
                    className={cn(
                      'truncate text-left font-medium transition hover:underline',
                      isSelected ? 'font-bold text-cyan-700' : 'text-slate-700 hover:text-cyan-700'
                    )}
                  >
                    {r.name}
                  </button>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    <b className="text-slate-900">{r.count}</b> · {formatDate(r.last, 'MM/yyyy')}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Cột 2: Bác sĩ khám nhiều nhất */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Bác sĩ khám nhiều nhất · bấm để lọc
          </h3>
          <Bars
            rows={data.topDoctors}
            tone="bg-cyan-500"
            active={activeDocId}
            onPick={(doc) => onDoctorFilter(activeDocId === doc.id ? null : { id: doc.id!, label: doc.name })}
          />
        </div>

        {/* Cột 3: Chuyên khoa khám nhiều nhất */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Chuyên khoa khám nhiều nhất
          </h3>
          <Bars rows={data.topSpecialties} tone="bg-blue-500" />
        </div>

        {/* Cột 4: Dịch vụ hỗ trợ nhiều nhất */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Dịch vụ hỗ trợ nhiều nhất
          </h3>
          <Bars rows={data.topServices} tone="bg-violet-500" />
        </div>
      </div>
    </section>
  );
}
