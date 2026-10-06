'use client';

/**
 * Phương tiện: bảng đoàn xe gọn, nhìn một lượt thấy xe nào sắp hết hạn kiểm định,
 * bảo hiểm, niên hạn và xe nào chạy nhiều. Xe có việc cần làm xếp lên đầu.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Search, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { PANEL } from '@/components/crm/ui';
import {
  CATEGORY_META,
  LIFETIME_WARN_YEARS,
  SOON_DAYS,
  STATUS_META,
  daysUntil,
  lifetimeLeft,
  urgencyOf,
  vehicleUrgency,
  type VehicleCategory,
  type VehicleRow,
} from '@/components/vehicles/fleet';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

/** Biển số in như biển thật: nền trắng, viền đậm, chữ đều — nhìn là nhận ra xe. */
function Plate({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-md border-2 border-slate-800 bg-white px-2 py-0.5 font-mono text-[13px] font-bold tracking-wider text-slate-900 shadow-[inset_0_-2px_0_rgba(15,23,42,0.08)]">
      {value}
    </span>
  );
}

function DocCell({ iso }: { iso: string | null }) {
  const days = daysUntil(iso);
  const u = urgencyOf(days);
  if (u === 'none') return <span className="text-slate-300">Chưa ghi</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className="tabular-nums text-slate-700">{fmtDate(iso)}</span>
      <span
        className={cn(
          'mt-0.5 w-fit whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
          u === 'expired' && 'bg-rose-100 text-rose-700',
          u === 'soon' && 'bg-amber-100 text-amber-800',
          u === 'ok' && 'text-slate-400',
        )}
      >
        {u === 'expired' ? `quá hạn ${-days!} ngày` : `còn ${days} ngày`}
      </span>
    </span>
  );
}

function LifetimeCell({ v }: { v: VehicleRow }) {
  const left = lifetimeLeft(v.expiryYear);
  if (left === null) return <span className="text-slate-500">{v.expiryYear ?? '—'}</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className="tabular-nums text-slate-700">{v.expiryYear}</span>
      <span className={cn('text-[11px] font-semibold', left < 0 ? 'text-rose-600' : left <= LIFETIME_WARN_YEARS ? 'text-amber-700' : 'text-slate-400')}>
        {left < 0 ? `quá niên hạn ${-left} năm` : `còn ${left} năm`}
      </span>
    </span>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number | string; tone: string; hint: string }) {
  return (
    <div className="bg-white px-4 py-3" title={hint}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VehicleCategory | 'ALL'>('ALL');
  const [onlyAttention, setOnlyAttention] = useState(false);

  useEffect(() => {
    fetch('/api/vehicles')
      .then((r) => r.json())
      .then((d) => setVehicles(Array.isArray(d) ? d : []))
      .catch(() => setVehicles([]));
  }, []);

  const all = vehicles ?? [];
  const counts = useMemo(() => all.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v.category]: (acc[v.category] ?? 0) + 1 }), {}), [all]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/[\s.-]/g, '');
    return all
      .filter((v) => category === 'ALL' || v.category === category)
      .filter((v) => !onlyAttention || vehicleUrgency(v) > 0)
      .filter((v) => !q || [v.licensePlate, v.brand, v.model, v.manager].join(' ').toLowerCase().replace(/[\s.-]/g, '').includes(q))
      .sort((a, b) => vehicleUrgency(b) - vehicleUrgency(a) || a.licensePlate.localeCompare(b.licensePlate));
  }, [all, search, category, onlyAttention]);

  const docs = all.flatMap((v) => [urgencyOf(daysUntil(v.inspectionExpiry)), urgencyOf(daysUntil(v.insuranceExpiry))]);
  const expired = docs.filter((u) => u === 'expired').length;
  const soon = docs.filter((u) => u === 'soon').length;
  const lifetimeWarn = all.filter((v) => {
    const l = lifetimeLeft(v.expiryYear);
    return l !== null && l <= LIFETIME_WARN_YEARS;
  }).length;
  const trips = all.reduce((s, v) => s + v.trips30, 0);
  const attention = all.filter((v) => vehicleUrgency(v) > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader icon={Truck} title="Phương tiện" description="Đoàn xe Bệnh viện: hạn giấy tờ, niên hạn, hoạt động 30 ngày qua — bấm vào xe để xem hồ sơ, bảo dưỡng, nhật ký chuyến" />

      <section className={cn(PANEL, 'grid grid-cols-2 gap-px overflow-hidden bg-slate-100 sm:grid-cols-3 lg:grid-cols-5')} aria-label="Tổng quan đoàn xe">
        <Kpi label="Đang sử dụng" value={all.filter((v) => v.status === 'IN_USE').length} tone="text-slate-900" hint={`trên ${all.length} xe`} />
        <Kpi label="Giấy tờ quá hạn" value={expired} tone={expired ? 'text-rose-600' : 'text-slate-300'} hint="Kiểm định, bảo hiểm đã hết hạn" />
        <Kpi label="Sắp hết hạn" value={soon} tone={soon ? 'text-amber-600' : 'text-slate-300'} hint={`Trong ${SOON_DAYS} ngày tới`} />
        <Kpi label="Gần hết niên hạn" value={lifetimeWarn} tone={lifetimeWarn ? 'text-amber-600' : 'text-slate-300'} hint={`Còn ≤ ${LIFETIME_WARN_YEARS} năm`} />
        <Kpi label="Chuyến 30 ngày" value={trips.toLocaleString('vi-VN')} tone="text-brand-700" hint="Theo nhật ký tài xế nhập" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Loại xe" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {(['ALL', 'AMBULANCE', 'ADMIN_CAR', 'BUS', 'PICKUP', 'TRUCK', 'OTHER'] as const)
            .filter((c) => c === 'ALL' || counts[c])
            .map((c) => {
              const on = category === c;
              const meta = c === 'ALL' ? null : CATEGORY_META[c];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                >
                  {meta && <meta.Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {meta?.label ?? 'Tất cả'}
                  <span className="tabular-nums text-slate-400">{c === 'ALL' ? all.length : counts[c]}</span>
                </button>
              );
            })}
        </div>
        {attention > 0 && (
          <button
            type="button"
            aria-pressed={onlyAttention}
            onClick={() => setOnlyAttention((v) => !v)}
            className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ring-1 ring-inset transition', onlyAttention ? 'bg-amber-500 text-white ring-amber-500' : 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100')}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {attention} xe cần xử lý
          </button>
        )}
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Tìm xe</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Biển số, nhãn hiệu, người quản lý…" className="input pl-9" />
        </label>
      </div>

      <section className={cn(PANEL, 'overflow-hidden')} aria-label="Danh sách xe">
        {!vehicles ? (
          <div className="space-y-px" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 animate-pulse bg-slate-50" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-500">Không có xe nào khớp.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Xe</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Loại · đời xe</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Kiểm định</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Bảo hiểm</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Niên hạn</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold" title="Số chuyến 30 ngày qua">Chuyến 30 ngày</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Quản lý</th>
                    <th scope="col" className="w-8 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((v) => {
                    const meta = CATEGORY_META[v.category];
                    const urgent = vehicleUrgency(v);
                    return (
                      <tr key={v.id} onClick={() => router.push(`/dashboard/vehicles/${v.id}`)} className={cn('group cursor-pointer hover:bg-brand-50/40', urgent === 3 && 'bg-rose-50/40', urgent === 2 && 'bg-amber-50/30')}>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/vehicles/${v.id}`} onClick={(e) => e.stopPropagation()} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            <Plate value={v.licensePlate} />
                          </Link>
                          <span className="mt-1 block text-xs text-slate-500">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', meta.tone)}>
                            <meta.Icon className="h-3 w-3" aria-hidden="true" />{meta.label}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {v.manufactureYear ? `${v.manufactureYear} · ${new Date().getFullYear() - v.manufactureYear} năm` : '—'}
                            {v.seatCount && ` · ${v.seatCount}`}
                          </span>
                        </td>
                        <td className="px-3 py-3"><DocCell iso={v.inspectionExpiry} /></td>
                        <td className="px-3 py-3"><DocCell iso={v.insuranceExpiry} /></td>
                        <td className="px-3 py-3"><LifetimeCell v={v} /></td>
                        <td className="px-3 py-3 text-right">
                          <span className={cn('font-semibold tabular-nums', v.trips30 ? 'text-brand-700' : 'text-slate-300')}>{v.trips30}</span>
                          {v.lastTripAt && <span className="block text-[11px] text-slate-400">gần nhất {fmtDate(v.lastTripAt)}</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {v.manager ?? '—'}
                          {v.status !== 'IN_USE' && <span className={cn('mt-1 block w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[v.status].tone)}>{STATUS_META[v.status].label}</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-300 group-hover:text-brand-600"><ChevronRight className="h-4 w-4" aria-hidden="true" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((v) => {
                const meta = CATEGORY_META[v.category];
                return (
                  <li key={v.id}>
                    <Link href={`/dashboard/vehicles/${v.id}`} className="block space-y-2 px-4 py-3 active:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <Plate value={v.licensePlate} />
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', meta.tone)}>
                          <meta.Icon className="h-3 w-3" aria-hidden="true" />{meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{[v.brand, v.model, v.manufactureYear].filter(Boolean).join(' · ')}{v.manager && ` · ${v.manager}`}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-[10px] uppercase text-slate-400">Kiểm định</p><DocCell iso={v.inspectionExpiry} /></div>
                        <div><p className="text-[10px] uppercase text-slate-400">Bảo hiểm</p><DocCell iso={v.insuranceExpiry} /></div>
                        <div><p className="text-[10px] uppercase text-slate-400">Niên hạn</p><LifetimeCell v={v} /></div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
