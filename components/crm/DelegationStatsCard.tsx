'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import type { DelegationStats } from '@/lib/crm/delegation-stats';
import { crmFetch } from './api';
import { formatDate } from './format';
import { PANEL } from './ui';

const PURPOSE_TONES: Record<string, string> = {
  'Làm việc': 'text-brand-700',
  'Tham quan - Học tập': 'text-emerald-700',
  'Ký kết hợp tác (MOU)': 'text-violet-700',
  'Chúc Tết': 'text-rose-600',
  'Chúc mừng - Tặng quà': 'text-orange-600',
  Khác: 'text-slate-500',
};

function Bars({ rows, onPick, active, tone }: { rows: Array<{ name: string; count: number }>; onPick?: (name: string) => void; active?: string; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name}>
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(active === r.name ? '' : r.name)}
            aria-pressed={onPick ? active === r.name : undefined}
            className={cn('group w-full rounded-lg px-1.5 py-1 text-left text-xs enabled:hover:bg-slate-50', active === r.name && 'bg-brand-50')}
          >
            <span className="flex justify-between gap-2">
              <span className="truncate text-slate-700">{r.name}</span>
              <b className="tabular-nums text-slate-900">{r.count}</b>
            </span>
            <span className="mt-0.5 block h-1.5 rounded-full bg-slate-100">
              <span className={cn('block h-full rounded-full', tone)} style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Thống kê sổ tiếp đoàn (mọi năm): bảng năm × hình thức như sổ chuẩn hoá, tổ chức
 * đến nhiều nhất, khoa/phòng chủ trì, chủ đề — bấm chủ đề/năm để lọc danh sách.
 */
export function DelegationStatsCard({ year, topic, onYear, onTopic }: { year: string; topic: string; onYear: (y: string) => void; onTopic: (t: string) => void }) {
  const { data, error } = useSWR<DelegationStats>('/api/crm/delegations/stats', (url: string) => crmFetch<DelegationStats>(url), { revalidateOnFocus: false });
  if (error) return null;
  if (!data) return <div className={cn(PANEL, 'h-64 animate-pulse bg-slate-50')} aria-hidden="true" />;

  const totalRow = data.purposes.map((p) => data.byYear.reduce((s, y) => s + (y.byPurpose[p] ?? 0), 0));
  return (
    <section className={cn(PANEL, 'space-y-5 p-4 sm:p-5')} aria-label="Thống kê tiếp đoàn">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">Sổ tiếp đoàn</h2>
        <p className="text-xs text-slate-500">
          <b className="text-emerald-700">{data.totals.done}</b> lượt đã tiếp · <b className="text-slate-700">{data.totals.organizations}</b> đơn vị
          {data.totals.cashReceived > 0 && <> · khách tặng <b className="text-slate-700">{data.totals.cashReceived.toLocaleString('vi-VN')} đ</b></>}
          {data.totals.needsReview > 0 && <> · <b className="text-orange-700">{data.totals.needsReview}</b> lượt cần xác minh</>}
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Số lượt tiếp đoàn đã thực hiện theo năm và hình thức</caption>
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              <th scope="col" className="px-4 py-2 text-left font-semibold sm:px-5">Năm</th>
              {data.purposes.map((p) => <th key={p} scope="col" className="px-2 py-2 text-right font-semibold">{p}</th>)}
              <th scope="col" className="px-2 py-2 text-right font-semibold">Đã tiếp</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold sm:px-5" title="Hoãn hoặc huỷ">Hoãn/Huỷ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.byYear.map((y) => (
              <tr key={y.year} className={cn('hover:bg-slate-50', year === String(y.year) && 'bg-brand-50/60')}>
                <th scope="row" className="px-4 py-2 text-left sm:px-5">
                  <button type="button" onClick={() => onYear(year === String(y.year) ? '' : String(y.year))} className="font-bold text-slate-900 hover:text-brand-700 hover:underline" aria-pressed={year === String(y.year)}>
                    {y.year}
                  </button>
                </th>
                {data.purposes.map((p) => (
                  <td key={p} className={cn('px-2 py-2 text-right tabular-nums', y.byPurpose[p] ? PURPOSE_TONES[p] : 'text-slate-300')}>{y.byPurpose[p] ?? 0}</td>
                ))}
                <td className="px-2 py-2 text-right font-bold tabular-nums text-slate-900">{y.done}</td>
                <td className={cn('px-4 py-2 text-right tabular-nums sm:px-5', y.postponedOrCancelled ? 'text-violet-700' : 'text-slate-300')}>{y.postponedOrCancelled}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 font-bold">
              <th scope="row" className="px-4 py-2 text-left sm:px-5">Tổng</th>
              {totalRow.map((n, i) => <td key={data.purposes[i]} className="px-2 py-2 text-right tabular-nums">{n}</td>)}
              <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{data.totals.done}</td>
              <td className="px-4 py-2 text-right tabular-nums sm:px-5">{data.byYear.reduce((s, y) => s + y.postponedOrCancelled, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Đơn vị đến nhiều nhất</h3>
          <ol className="space-y-1.5 text-xs">
            {data.topOrganizations.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/dashboard/crm/organizations/${o.id}`} className="truncate font-medium text-slate-700 hover:text-brand-700 hover:underline">{o.name}</Link>
                <span className="shrink-0 tabular-nums text-slate-500"><b className="text-slate-900">{o.count}</b> · {formatDate(o.last, 'MM/yyyy')}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Loại tổ chức</h3>
          <Bars rows={data.categories} tone="bg-brand-400" />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Khoa/phòng chủ trì</h3>
          <Bars rows={data.hosts} tone="bg-emerald-400" />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Chủ đề · bấm để lọc</h3>
          <Bars rows={data.topics.slice(0, 12)} tone="bg-violet-400" onPick={onTopic} active={topic} />
        </div>
      </div>
    </section>
  );
}
