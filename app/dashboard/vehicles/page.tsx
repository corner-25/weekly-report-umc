'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Truck, Search, Ambulance, Car, Bus, Package, HelpCircle, AlertTriangle, Calendar, Wrench } from 'lucide-react';

interface VehicleRow {
  id: string;
  licensePlate: string;
  brand: string | null;
  model: string | null;
  category: 'AMBULANCE' | 'ADMIN_CAR' | 'BUS' | 'TRUCK' | 'PICKUP' | 'OTHER';
  color: string | null;
  manufactureYear: number | null;
  seatCount: string | null;
  status: 'IN_USE' | 'RETIRED' | 'SOLD' | 'TRANSFERRED';
  manager: string | null;
  inspectionExpiry: string | null;
  insuranceExpiry: string | null;
  registrationNumber: string | null;
}

const CATEGORY_META: Record<string, { label: string; Icon: typeof Ambulance; color: string; bg: string; ring: string }> = {
  AMBULANCE: { label: 'Cứu thương', Icon: Ambulance, color: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200' },
  ADMIN_CAR: { label: 'Hành chính', Icon: Car, color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  BUS: { label: 'Xe khách', Icon: Bus, color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200' },
  TRUCK: { label: 'Xe tải', Icon: Truck, color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  PICKUP: { label: 'Pickup', Icon: Package, color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  OTHER: { label: 'Khác', Icon: HelpCircle, color: 'text-slate-700', bg: 'bg-slate-100', ring: 'ring-slate-200' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  IN_USE: { label: 'Đang sử dụng', color: 'bg-emerald-100 text-emerald-700' },
  RETIRED: { label: 'Ngừng hoạt động', color: 'bg-slate-100 text-slate-700' },
  SOLD: { label: 'Đã thanh lý', color: 'bg-amber-100 text-amber-700' },
  TRANSFERRED: { label: 'Đã chuyển giao', color: 'bg-violet-100 text-violet-700' },
};

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const fetchVehicles = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      const res = await fetch(`/api/vehicles?${params}`);
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  const countByCategory = vehicles.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});

  const expiringSoon = vehicles.filter((v) => {
    const insp = daysUntil(v.inspectionExpiry);
    const ins = daysUntil(v.insuranceExpiry);
    return (insp !== null && insp <= 60) || (ins !== null && ins <= 60);
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Phương tiện vận chuyển"
        description="Quản lý đoàn xe Bệnh viện: cứu thương, hành chính, xe khách và lịch sử bảo dưỡng"
      />

      {/* Stats by category */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Tổng xe" value={vehicles.length} icon={Truck} accent="from-slate-500 to-slate-700" active={categoryFilter === 'ALL'} onClick={() => setCategoryFilter('ALL')} />
        {(['AMBULANCE', 'ADMIN_CAR', 'BUS', 'PICKUP', 'TRUCK', 'OTHER'] as const).map((c) => {
          const meta = CATEGORY_META[c];
          if ((countByCategory[c] ?? 0) === 0 && categoryFilter !== c) return null;
          return (
            <StatCard
              key={c}
              label={meta.label}
              value={countByCategory[c] ?? 0}
              icon={meta.Icon}
              accent={meta.color.replace('text-', 'from-').replace('-700', '-500') + ' to-' + meta.color.replace('text-', '').replace('-700', '-700')}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(categoryFilter === c ? 'ALL' : c)}
            />
          );
        })}
      </div>

      {expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{expiringSoon}</strong> xe có giấy tờ (kiểm định/bảo hiểm) sắp hết hạn trong 60 ngày tới.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo biển số, nhãn hiệu, số máy, số khung..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Đang tải...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Không có xe nào phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const meta = CATEGORY_META[v.category];
            const stat = STATUS_META[v.status];
            const Icon = meta.Icon;
            const inspDays = daysUntil(v.inspectionExpiry);
            const insDays = daysUntil(v.insuranceExpiry);
            return (
              <Link
                key={v.id}
                href={`/dashboard/vehicles/${v.id}`}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-12 h-12 rounded-xl ${meta.bg} ${meta.color} ring-1 ring-inset ${meta.ring} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">{v.licensePlate}</h3>
                    <p className="text-xs text-slate-600 truncate mt-0.5">
                      {[v.brand, v.model].filter(Boolean).join(' ')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${meta.bg} ${meta.color} ring-1 ring-inset ${meta.ring}`}>
                        {meta.label}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${stat.color}`}>
                        {stat.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">Năm SX</div>
                    <div className="font-semibold text-slate-800">{v.manufactureYear ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Số chỗ</div>
                    <div className="font-semibold text-slate-800 truncate">{v.seatCount ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Màu</div>
                    <div className="font-semibold text-slate-800 truncate">{v.color ?? '—'}</div>
                  </div>
                </div>

                {(inspDays !== null || insDays !== null) && (
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    {inspDays !== null && (
                      <ExpiryRow label="Kiểm định" days={inspDays} icon={Wrench} />
                    )}
                    {insDays !== null && (
                      <ExpiryRow label="Bảo hiểm" days={insDays} icon={Calendar} />
                    )}
                  </div>
                )}

                {v.manager && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                    <span className="text-[10px] uppercase tracking-wide">Người quản lý:</span> <span className="text-slate-700">{v.manager}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent, active, onClick,
}: {
  label: string; value: number; icon: typeof Truck; accent: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm p-3 transition-all ${
        active ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accent} text-white flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-xl font-semibold text-slate-900 tabular-nums">{value}</div>
    </button>
  );
}

function ExpiryRow({ label, days, icon: Icon }: { label: string; days: number; icon: typeof Calendar }) {
  let color = 'text-slate-600';
  let badge = '';
  if (days < 0) { color = 'text-red-700'; badge = `Đã hết hạn ${Math.abs(days)} ngày`; }
  else if (days <= 30) { color = 'text-red-700'; badge = `Còn ${days} ngày`; }
  else if (days <= 60) { color = 'text-amber-700'; badge = `Còn ${days} ngày`; }
  else { color = 'text-slate-600'; badge = `Còn ${days} ngày`; }
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-1 text-slate-500">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className={`font-medium ${color}`}>{badge}</span>
    </div>
  );
}
