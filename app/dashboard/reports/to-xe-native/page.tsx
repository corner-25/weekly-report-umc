'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { FleetTrip, FleetTab, VehicleTypeFilter } from '@/lib/fleet/types';
import {
  processRawData,
  filterByDateRange,
  filterByVehicleType,
  getDateRange,
  computeOverview,
  computeVehicleStats,
  computeDriverStats,
  computeDailyStats,
  formatVND,
  formatVNDFull,
  formatKm,
  formatHours,
  formatPercent,
} from '@/lib/fleet/data-processing';
import { FUEL_STANDARDS } from '@/lib/fleet/types';
import { StatCard, BarChart, TrendLine, DataTable, ProgressBar } from '@/components/fleet/FleetCharts';

// ─── TAB CONFIG ─────────────────────────────────────────────

const TABS: { key: FleetTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Tổng quan', icon: '📊' },
  { key: 'revenue', label: 'Doanh thu', icon: '💰' },
  { key: 'vehicles', label: 'Hiệu suất xe', icon: '🚗' },
  { key: 'distance', label: 'Quãng đường', icon: '🛣️' },
  { key: 'fuel', label: 'Nhiên liệu', icon: '⛽' },
  { key: 'report', label: 'Báo cáo', icon: '📋' },
];

// ─── PAGE ───────────────────────────────────────────────────

export default function FleetDashboardPage() {
  const [allData, setAllData] = useState<FleetTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState('');

  const [activeTab, setActiveTab] = useState<FleetTab>('overview');
  const [vehicleType, setVehicleType] = useState<VehicleTypeFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/fleet-data', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Lỗi ${res.status}: ${res.statusText}`);
      const pkg = await res.json();
      if (pkg.error) throw new Error(pkg.error);

      const processed = processRawData(pkg.data);
      setAllData(processed);
      setFetchedAt(pkg.fetchedAt ?? '');

      const range = getDateRange(processed);
      setStartDate(range.min);
      setEndDate(range.max);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Filtered data
  const filteredData = useMemo(() => {
    let d = allData;
    if (startDate && endDate) d = filterByDateRange(d, startDate, endDate);
    d = filterByVehicleType(d, vehicleType);
    return d;
  }, [allData, startDate, endDate, vehicleType]);

  // Computed stats (memoized)
  const overview = useMemo(() => computeOverview(filteredData), [filteredData]);
  const vehicleStats = useMemo(() => computeVehicleStats(filteredData), [filteredData]);
  const driverStats = useMemo(() => computeDriverStats(filteredData), [filteredData]);
  const dailyStats = useMemo(() => computeDailyStats(filteredData), [filteredData]);
  const dateRange = useMemo(() => getDateRange(allData), [allData]);

  // Quick filters
  const setQuickFilter = useCallback((type: string) => {
    const today = new Date();
    const range = getDateRange(allData);
    switch (type) {
      case 'this_month': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        setStartDate(first);
        setEndDate(range.max);
        break;
      }
      case 'prev_month': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
        const last = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        setStartDate(first);
        setEndDate(last);
        break;
      }
      case 'this_week': {
        const day = today.getDay();
        const mon = new Date(today);
        mon.setDate(today.getDate() - ((day + 6) % 7));
        setStartDate(mon.toISOString().split('T')[0]);
        setEndDate(range.max);
        break;
      }
      case 'all':
        setStartDate(range.min);
        setEndDate(range.max);
        break;
    }
  }, [allData]);

  // ── Loading / Error ───────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Đang tải dữ liệu tổ xe...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-red-600 font-semibold mb-2">Lỗi tải dữ liệu</p>
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button onClick={fetchData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Quản lý Tổ Xe</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredData.length.toLocaleString()} chuyến
            {fetchedAt && ` — cập nhật ${new Date(fetchedAt).toLocaleString('vi-VN')}`}
          </p>
        </div>
        <button onClick={fetchData}
          className="px-3 py-1.5 text-xs bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 transition-colors flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-500">Từ</span>
          <input type="date" value={startDate} min={dateRange.min} max={dateRange.max}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs" />
          <span className="text-gray-500">đến</span>
          <input type="date" value={endDate} min={dateRange.min} max={dateRange.max}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs" />
        </div>

        {/* Quick filters */}
        <div className="flex gap-1">
          {[
            { key: 'this_week', label: 'Tuần này' },
            { key: 'this_month', label: 'Tháng này' },
            { key: 'prev_month', label: 'Tháng trước' },
            { key: 'all', label: 'Tất cả' },
          ].map((f) => (
            <button key={f.key} onClick={() => setQuickFilter(f.key)}
              className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-cyan-100 text-gray-600 hover:text-cyan-700 transition-colors">
              {f.label}
            </button>
          ))}
        </div>

        {/* Vehicle type */}
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleTypeFilter)}
          className="border border-gray-200 rounded px-2 py-1 text-xs ml-auto">
          <option value="all">Tất cả xe</option>
          <option value="Hành chính">Hành chính</option>
          <option value="Cứu thương">Cứu thương</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-white text-cyan-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <OverviewTab overview={overview} vehicleStats={vehicleStats} driverStats={driverStats} dailyStats={dailyStats} data={filteredData} />
        )}
        {activeTab === 'revenue' && (
          <RevenueTab data={filteredData} dailyStats={dailyStats} vehicleStats={vehicleStats} driverStats={driverStats} />
        )}
        {activeTab === 'vehicles' && (
          <VehiclesTab vehicleStats={vehicleStats} dailyStats={dailyStats} data={filteredData} />
        )}
        {activeTab === 'distance' && (
          <DistanceTab data={filteredData} vehicleStats={vehicleStats} dailyStats={dailyStats} />
        )}
        {activeTab === 'fuel' && (
          <FuelTab vehicleStats={vehicleStats} />
        )}
        {activeTab === 'report' && (
          <ReportTab data={filteredData} startDate={startDate} endDate={endDate} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════

function OverviewTab({ overview, vehicleStats, driverStats, dailyStats, data }: {
  overview: ReturnType<typeof computeOverview>;
  vehicleStats: ReturnType<typeof computeVehicleStats>;
  driverStats: ReturnType<typeof computeDriverStats>;
  dailyStats: ReturnType<typeof computeDailyStats>;
  data: FleetTrip[];
}) {
  // Vehicle utilization
  const totalVehicles = overview.totalVehicles;
  const avgActivePerDay = dailyStats.length > 0
    ? dailyStats.reduce((s, d) => s + d.activeVehicles, 0) / dailyStats.length
    : 0;

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🚗" label="Tổng chuyến" value={overview.totalTrips.toLocaleString()} />
        <StatCard icon="🏥" label="Xe hoạt động" value={String(overview.totalVehicles)} accent="border-blue-500" />
        <StatCard icon="👨‍💼" label="Tài xế" value={String(overview.totalDrivers)} accent="border-green-500" />
        <StatCard icon="💰" label="Tổng doanh thu" value={`${formatVNDFull(overview.totalRevenue)} đ`} accent="border-amber-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="⏱️" label="Tổng giờ chạy" value={`${formatHours(overview.totalHours)} giờ`} accent="border-purple-500" />
        <StatCard icon="🛣️" label="Tổng quãng đường" value={`${formatKm(overview.totalDistance)} km`} accent="border-teal-500" />
        <StatCard icon="💵" label="TB doanh thu/chuyến" value={`${formatVNDFull(overview.avgRevenuePerTrip)} đ`} accent="border-orange-500" />
        <StatCard icon="⏰" label="TB giờ/chuyến" value={`${formatHours(overview.avgHoursPerTrip)} giờ`} accent="border-pink-500" />
      </div>

      {/* Activity metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📈" label="Chuyến TB/ngày" value={overview.avgTripsPerDay.toFixed(1)}
          sub={`${overview.activeDays} ngày hoạt động`} />
        <StatCard icon="🚗" label="Tỷ lệ sử dụng xe TB" value={formatPercent(totalVehicles > 0 ? (avgActivePerDay / totalVehicles) * 100 : 0)}
          sub={`${totalVehicles} xe tổng`} accent="border-indigo-500" />
        <StatCard icon="⬆️" label="Ngày cao điểm" value={`${overview.peakDayTrips} chuyến`}
          sub={overview.peakDate} accent="border-red-500" />
        <StatCard icon="📅" label="Ngày hoạt động" value={`${overview.activeDays}`}
          accent="border-emerald-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendLine
            data={dailyStats.slice(-30).map((d) => ({ label: d.date, value: d.totalTrips }))}
            title="Số chuyến theo ngày (30 ngày gần nhất)"
            color="#06b6d4"
          />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <BarChart
            data={vehicleStats.slice(0, 10).map((v) => ({
              label: v.vehicle_id, value: v.totalRevenue
            }))}
            title="Top 10 xe doanh thu cao nhất"
            formatValue={(v) => formatVND(v)}
          />
        </div>
      </div>

      {/* Vehicle performance table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          title="Hiệu suất chi tiết từng xe"
          columns={[
            { key: 'vehicle_id', label: 'Mã xe' },
            { key: 'totalTrips', label: 'Chuyến', align: 'right', format: (r) => (r.totalTrips as number).toLocaleString() },
            { key: 'totalRevenue', label: 'Doanh thu', align: 'right', format: (r) => formatVNDFull(r.totalRevenue as number) },
            { key: 'totalHours', label: 'Giờ', align: 'right', format: (r) => formatHours(r.totalHours as number) },
            { key: 'activeDays', label: 'Ngày HĐ', align: 'right' },
            { key: 'tripsPerDay', label: 'Chuyến/ngày', align: 'right' },
            { key: 'performance', label: 'Hiệu suất', align: 'center',
              className: (r) => r.performance === 'Cao' ? 'text-emerald-600 font-semibold' : r.performance === 'Thấp' ? 'text-red-500' : 'text-amber-600' },
          ]}
          data={vehicleStats as unknown as Record<string, unknown>[]}
          maxRows={20}
        />
      </div>

      {/* Driver table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          title="Hiệu suất tài xế"
          columns={[
            { key: 'driver_name', label: 'Tài xế' },
            { key: 'totalTrips', label: 'Chuyến', align: 'right' },
            { key: 'totalRevenue', label: 'Doanh thu', align: 'right', format: (r) => formatVNDFull(r.totalRevenue as number) },
            { key: 'totalHours', label: 'Giờ lái', align: 'right' },
            { key: 'activeDays', label: 'Ngày LV', align: 'right' },
            { key: 'tripsPerDay', label: 'Chuyến/ngày', align: 'right' },
            { key: 'hoursPerDay', label: 'Giờ/ngày', align: 'right' },
          ]}
          data={driverStats as unknown as Record<string, unknown>[]}
          maxRows={20}
        />
      </div>
    </>
  );
}

// ─── REVENUE TAB ────────────────────────────────────────────

function RevenueTab({ data, dailyStats, vehicleStats, driverStats }: {
  data: FleetTrip[];
  dailyStats: ReturnType<typeof computeDailyStats>;
  vehicleStats: ReturnType<typeof computeVehicleStats>;
  driverStats: ReturnType<typeof computeDriverStats>;
}) {
  const revenueTrips = data.filter((t) => t.revenue_vnd > 0);
  const totalRevenue = revenueTrips.reduce((s, t) => s + t.revenue_vnd, 0);
  const avgPerTrip = revenueTrips.length > 0 ? totalRevenue / revenueTrips.length : 0;
  const maxRevenue = revenueTrips.length > 0 ? Math.max(...revenueTrips.map((t) => t.revenue_vnd)) : 0;
  const medianRevenue = revenueTrips.length > 0
    ? [...revenueTrips.map((t) => t.revenue_vnd)].sort((a, b) => a - b)[Math.floor(revenueTrips.length / 2)]
    : 0;

  // Daily revenue for trend
  const dailyRevenue = dailyStats.filter((d) => d.totalRevenue > 0);

  // Revenue by vehicle type
  const revenueByType: Record<string, { total: number; count: number }> = {};
  for (const t of revenueTrips) {
    const type = t.vehicle_type || 'Khác';
    if (!revenueByType[type]) revenueByType[type] = { total: 0, count: 0 };
    revenueByType[type].total += t.revenue_vnd;
    revenueByType[type].count++;
  }

  // Growth analysis (last 7 days vs overall)
  const last7 = dailyRevenue.slice(-7);
  const recentAvg = last7.length > 0 ? last7.reduce((s, d) => s + d.totalRevenue, 0) / last7.length : 0;
  const overallAvg = dailyRevenue.length > 0 ? dailyRevenue.reduce((s, d) => s + d.totalRevenue, 0) / dailyRevenue.length : 0;
  const trendDir = recentAvg > overallAvg ? 'up' : 'down';
  const trendPct = overallAvg > 0 ? ((recentAvg - overallAvg) / overallAvg) * 100 : 0;

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="💰" label="Tổng doanh thu" value={`${formatVNDFull(totalRevenue)} đ`} accent="border-amber-500" />
        <StatCard icon="📊" label="TB/chuyến" value={`${formatVNDFull(avgPerTrip)} đ`} accent="border-cyan-500" />
        <StatCard icon="🚗" label="Chuyến có DT" value={revenueTrips.length.toLocaleString()} accent="border-green-500" />
        <StatCard icon="🚙" label="Xe tham gia" value={String(new Set(revenueTrips.map((t) => t.vehicle_id)).size)} accent="border-blue-500" />
      </div>

      {/* Trend insight */}
      <div className={`p-3 rounded-lg text-sm ${trendDir === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        <span className="font-semibold">{trendDir === 'up' ? '📈 Xu hướng tăng' : '📉 Xu hướng giảm'}</span>
        {' — '}DT TB 7 ngày: {formatVNDFull(recentAvg)} đ | TB tổng: {formatVNDFull(overallAvg)} đ | Chênh: {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(1)}%
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <BarChart
            data={vehicleStats.filter((v) => v.totalRevenue > 0).slice(0, 10).map((v) => ({
              label: v.vehicle_id, value: v.totalRevenue,
              color: v.vehicle_type === 'Cứu thương' ? '#ef4444' : '#06b6d4'
            }))}
            title="Top 10 xe doanh thu"
            formatValue={(v) => formatVND(v)}
          />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendLine
            data={dailyRevenue.slice(-30).map((d) => ({ label: d.date, value: d.totalRevenue }))}
            title="Xu hướng doanh thu (30 ngày gần nhất)"
            color="#f59e0b"
            formatValue={(v) => formatVND(v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <BarChart
            data={driverStats.filter((d) => d.totalRevenue > 0).slice(0, 10).map((d) => ({
              label: d.driver_name, value: d.totalRevenue
            }))}
            title="Top 10 tài xế doanh thu"
            formatValue={(v) => formatVND(v)}
          />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Doanh thu theo loại xe</h4>
          {Object.entries(revenueByType).map(([type, stats]) => (
            <div key={type} className="mb-3">
              <ProgressBar
                label={`${type === 'Cứu thương' ? '🚑' : '🏢'} ${type}`}
                value={stats.total}
                max={totalRevenue}
                color={type === 'Cứu thương' ? '#ef4444' : '#06b6d4'}
                showPercent
              />
              <p className="text-xs text-gray-400 ml-1">{formatVNDFull(stats.total)} đ — {stats.count} chuyến</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Thống kê tổng hợp</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-gray-500">Tổng doanh thu:</span> <span className="font-semibold">{formatVNDFull(totalRevenue)} đ</span></div>
          <div><span className="text-gray-500">DT TB/chuyến:</span> <span className="font-semibold">{formatVNDFull(avgPerTrip)} đ</span></div>
          <div><span className="text-gray-500">DT cao nhất:</span> <span className="font-semibold">{formatVNDFull(maxRevenue)} đ</span></div>
          <div><span className="text-gray-500">Trung vị DT:</span> <span className="font-semibold">{formatVNDFull(medianRevenue)} đ</span></div>
        </div>
      </div>
    </>
  );
}

// ─── VEHICLES TAB ───────────────────────────────────────────

function VehiclesTab({ vehicleStats, dailyStats, data }: {
  vehicleStats: ReturnType<typeof computeVehicleStats>;
  dailyStats: ReturnType<typeof computeDailyStats>;
  data: FleetTrip[];
}) {
  // Utilization over time
  const totalVehicles = vehicleStats.length;
  const hcCount = vehicleStats.filter((v) => v.vehicle_type === 'Hành chính').length;
  const ctCount = vehicleStats.filter((v) => v.vehicle_type === 'Cứu thương').length;

  const avgHcPerDay = dailyStats.length > 0 ? dailyStats.reduce((s, d) => s + d.hcVehicles, 0) / dailyStats.length : 0;
  const avgCtPerDay = dailyStats.length > 0 ? dailyStats.reduce((s, d) => s + d.ctVehicles, 0) / dailyStats.length : 0;

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🚗" label="Tổng xe" value={String(totalVehicles)}
          sub={`${hcCount} HC + ${ctCount} CT`} />
        <StatCard icon="🏢" label="TB xe HC/ngày" value={avgHcPerDay.toFixed(1)}
          sub={`/${hcCount} xe`} accent="border-blue-500" />
        <StatCard icon="🚑" label="TB xe CT/ngày" value={avgCtPerDay.toFixed(1)}
          sub={`/${ctCount} xe`} accent="border-red-500" />
        <StatCard icon="📊" label="TB xe HĐ/ngày" value={(avgHcPerDay + avgCtPerDay).toFixed(1)}
          sub={`${totalVehicles > 0 ? formatPercent(((avgHcPerDay + avgCtPerDay) / totalVehicles) * 100) : '0%'} sử dụng`}
          accent="border-emerald-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <BarChart
            data={vehicleStats.sort((a, b) => b.tripsPerDay - a.tripsPerDay).slice(0, 15).map((v) => ({
              label: v.vehicle_id, value: v.tripsPerDay,
              color: v.vehicle_type === 'Cứu thương' ? '#ef4444' : '#06b6d4'
            }))}
            title="Chuyến/ngày theo xe"
            formatValue={(v) => v.toFixed(1)}
          />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendLine
            data={dailyStats.slice(-30).map((d) => ({ label: d.date, value: d.activeVehicles }))}
            title="Xe hoạt động/ngày (30 ngày gần nhất)"
            color="#8b5cf6"
          />
        </div>
      </div>

      {/* Utilization by type */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tỷ lệ sử dụng xe</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="text-xs font-semibold text-blue-600 mb-2">🏢 XE HÀNH CHÍNH</h5>
            <ProgressBar label="Sử dụng TB" value={avgHcPerDay} max={hcCount} color="#3b82f6" />
          </div>
          <div>
            <h5 className="text-xs font-semibold text-red-600 mb-2">🚑 XE CỨU THƯƠNG</h5>
            <ProgressBar label="Sử dụng TB" value={avgCtPerDay} max={ctCount} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* Full vehicle table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          title="Chi tiết hiệu suất xe"
          columns={[
            { key: 'vehicle_id', label: 'Mã xe' },
            { key: 'vehicle_type', label: 'Loại', format: (r) => r.vehicle_type === 'Cứu thương' ? '🚑 CT' : '🏢 HC' },
            { key: 'totalTrips', label: 'Chuyến', align: 'right' },
            { key: 'activeDays', label: 'Ngày HĐ', align: 'right' },
            { key: 'tripsPerDay', label: 'Chuyến/ngày', align: 'right' },
            { key: 'hoursPerTrip', label: 'Giờ/chuyến', align: 'right' },
            { key: 'distancePerTrip', label: 'Km/chuyến', align: 'right' },
            { key: 'totalRevenue', label: 'Doanh thu', align: 'right', format: (r) => formatVND(r.totalRevenue as number) },
            { key: 'performance', label: 'Hiệu suất', align: 'center',
              className: (r) => r.performance === 'Cao' ? 'text-emerald-600 font-semibold' : r.performance === 'Thấp' ? 'text-red-500' : 'text-amber-600' },
          ]}
          data={vehicleStats as unknown as Record<string, unknown>[]}
          maxRows={30}
        />
      </div>
    </>
  );
}

// ─── DISTANCE TAB ───────────────────────────────────────────

function DistanceTab({ data, vehicleStats, dailyStats }: {
  data: FleetTrip[];
  vehicleStats: ReturnType<typeof computeVehicleStats>;
  dailyStats: ReturnType<typeof computeDailyStats>;
}) {
  const distData = data.filter((t) => t.distance_km > 0);
  const totalDist = distData.reduce((s, t) => s + t.distance_km, 0);
  const avgDist = distData.length > 0 ? totalDist / distData.length : 0;
  const maxDist = distData.length > 0 ? Math.max(...distData.map((t) => t.distance_km)) : 0;

  // By area type
  const byArea: Record<string, { total: number; count: number }> = {};
  for (const t of distData) {
    const area = t.area_type || 'Khác';
    if (!byArea[area]) byArea[area] = { total: 0, count: 0 };
    byArea[area].total += t.distance_km;
    byArea[area].count++;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🛣️" label="Tổng quãng đường" value={`${formatKm(totalDist)} km`} accent="border-teal-500" />
        <StatCard icon="📊" label="TB/chuyến" value={`${avgDist.toFixed(1)} km`} accent="border-cyan-500" />
        <StatCard icon="⬆️" label="Xa nhất" value={`${maxDist.toFixed(1)} km`} accent="border-amber-500" />
        <StatCard icon="🚗" label="Chuyến có dữ liệu" value={distData.length.toLocaleString()} accent="border-blue-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <BarChart
            data={vehicleStats.filter((v) => v.totalDistance > 0)
              .sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 15)
              .map((v) => ({ label: v.vehicle_id, value: v.totalDistance }))}
            title="Top 15 xe chạy xa nhất"
            formatValue={(v) => `${formatKm(v)} km`}
          />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendLine
            data={dailyStats.filter((d) => d.totalDistance > 0).slice(-30).map((d) => ({
              label: d.date, value: d.totalDistance
            }))}
            title="Quãng đường theo ngày (30 ngày gần nhất)"
            color="#14b8a6"
            formatValue={(v) => `${v.toFixed(0)}km`}
          />
        </div>
      </div>

      {/* By area */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Phân tích theo khu vực</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(byArea).map(([area, stats]) => (
            <div key={area}>
              <ProgressBar
                label={`${area === 'Nội thành' ? '🏙️' : '🌆'} ${area}`}
                value={stats.total}
                max={totalDist}
                color={area === 'Nội thành' ? '#06b6d4' : '#f59e0b'}
              />
              <p className="text-xs text-gray-400 ml-1">{formatKm(stats.total)} km — {stats.count} chuyến — TB {(stats.total / stats.count).toFixed(1)} km/chuyến</p>
            </div>
          ))}
        </div>
      </div>

      {/* Distance table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          title="Quãng đường chi tiết theo xe"
          columns={[
            { key: 'vehicle_id', label: 'Mã xe' },
            { key: 'totalDistance', label: 'Tổng km', align: 'right', format: (r) => formatKm(r.totalDistance as number) },
            { key: 'totalTrips', label: 'Chuyến', align: 'right' },
            { key: 'distancePerTrip', label: 'Km/chuyến', align: 'right' },
            { key: 'totalHours', label: 'Giờ', align: 'right', format: (r) => formatHours(r.totalHours as number) },
          ]}
          data={vehicleStats.filter((v) => v.totalDistance > 0).sort((a, b) => b.totalDistance - a.totalDistance) as unknown as Record<string, unknown>[]}
          maxRows={20}
        />
      </div>
    </>
  );
}

// ─── FUEL TAB ───────────────────────────────────────────────

function FuelTab({ vehicleStats }: {
  vehicleStats: ReturnType<typeof computeVehicleStats>;
}) {
  const withData = vehicleStats.filter((v) => v.totalFuel > 0 && v.totalDistance > 0);
  const totalFuel = withData.reduce((s, v) => s + v.totalFuel, 0);
  const totalDist = withData.reduce((s, v) => s + v.totalDistance, 0);
  const avgConsumption = totalDist > 0 ? (totalFuel / totalDist) * 100 : 0;
  const overStandard = vehicleStats.filter((v) => v.fuelStatus === 'over').length;
  const efficient = vehicleStats.filter((v) => v.fuelStatus === 'efficient').length;
  const noData = vehicleStats.filter((v) => v.fuelStatus === 'no_data').length;

  const fuelPrice = 25000; // VNĐ/L
  const totalCost = totalFuel * fuelPrice;
  const costPer100km = totalDist > 0 ? (totalCost / totalDist) * 100 : 0;

  // Potential savings
  let potentialSavings = 0;
  for (const v of withData) {
    if (v.fuelStandard && v.fuelDeviation > 0) {
      potentialSavings += (v.fuelDeviation / 100) * v.totalDistance * fuelPrice;
    }
  }

  const withStandard = vehicleStats.filter((v) => v.fuelStandard !== null && v.fuelPer100km > 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="⛽" label="Tổng nhiên liệu" value={`${formatKm(totalFuel)} L`} accent="border-amber-500" />
        <StatCard icon="📊" label="TB tiêu thụ" value={`${avgConsumption.toFixed(1)} L/100km`} accent="border-cyan-500" />
        <StatCard icon="🔴" label="Vượt định mức" value={String(overStandard)} accent="border-red-500" />
        <StatCard icon="⚫" label="Thiếu dữ liệu" value={String(noData)} accent="border-gray-400" />
      </div>

      {/* Cost estimation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon="💰" label="Tổng chi phí NL" value={`${formatVNDFull(totalCost)} đ`}
          sub={`${formatKm(totalFuel)} L × ${fuelPrice.toLocaleString()} đ/L`} accent="border-orange-500" />
        <StatCard icon="📊" label="Chi phí/100km" value={`${formatVNDFull(costPer100km)} đ`} accent="border-blue-500" />
        <StatCard icon="💸" label="Tiết kiệm tiềm năng" value={`${formatVNDFull(potentialSavings)} đ`}
          sub="Nếu xe vượt định mức về đúng mức" accent="border-emerald-500" />
      </div>

      {/* Comparison chart */}
      {withStandard.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">So sánh tiêu thụ vs định mức</h4>
          <div className="space-y-2">
            {withStandard.map((v) => (
              <div key={v.vehicle_id} className="flex items-center gap-2 text-xs">
                <span className="w-28 text-gray-600 truncate">{v.vehicle_id}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div className="flex-1 h-4 bg-gray-100 rounded relative overflow-hidden">
                    {/* Standard bar */}
                    <div className="absolute h-full bg-blue-200 rounded"
                      style={{ width: `${Math.min((v.fuelStandard! / 35) * 100, 100)}%` }} />
                    {/* Actual bar */}
                    <div className={`absolute h-full rounded ${
                      v.fuelStatus === 'over' ? 'bg-red-400' : v.fuelStatus === 'efficient' ? 'bg-green-400' : 'bg-amber-400'
                    }`}
                      style={{ width: `${Math.min((v.fuelPer100km / 35) * 100, 100)}%`, opacity: 0.7 }} />
                  </div>
                </div>
                <span className="w-20 text-right tabular-nums">
                  {v.fuelPer100km.toFixed(1)}/{v.fuelStandard}
                </span>
                <span className={`w-5 text-center ${
                  v.fuelStatus === 'over' ? 'text-red-500' : v.fuelStatus === 'efficient' ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                  {v.fuelStatus === 'over' ? '🔴' : v.fuelStatus === 'efficient' ? '🟢' : '🟡'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            <span>🔵 Định mức</span>
            <span>🔴 Vượt (&gt;+2L)</span>
            <span>🟡 Trong mức</span>
            <span>🟢 Tiết kiệm (&lt;-1L)</span>
          </div>
        </div>
      )}

      {/* Alert vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-red-600 mb-2">🔴 Xe vượt định mức</h4>
          {vehicleStats.filter((v) => v.fuelStatus === 'over').length === 0 ? (
            <p className="text-xs text-emerald-600">Không có xe nào vượt định mức</p>
          ) : (
            vehicleStats.filter((v) => v.fuelStatus === 'over')
              .sort((a, b) => b.fuelDeviation - a.fuelDeviation)
              .map((v) => (
                <div key={v.vehicle_id} className="text-xs text-red-600 py-1 border-b border-red-100 last:border-0">
                  <span className="font-semibold">{v.vehicle_id}</span>: {v.fuelPer100km} L/100km
                  (định mức: {v.fuelStandard} L, vượt: +{v.fuelDeviation} L)
                </div>
              ))
          )}
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-emerald-600 mb-2">🟢 Xe tiết kiệm</h4>
          {vehicleStats.filter((v) => v.fuelStatus === 'efficient').length === 0 ? (
            <p className="text-xs text-gray-400">Không có xe nào tiết kiệm nổi bật</p>
          ) : (
            vehicleStats.filter((v) => v.fuelStatus === 'efficient')
              .sort((a, b) => a.fuelDeviation - b.fuelDeviation)
              .map((v) => (
                <div key={v.vehicle_id} className="text-xs text-emerald-600 py-1 border-b border-emerald-100 last:border-0">
                  <span className="font-semibold">{v.vehicle_id}</span>: {v.fuelPer100km} L/100km
                  (định mức: {v.fuelStandard} L, tiết kiệm: {Math.abs(v.fuelDeviation)} L)
                </div>
              ))
          )}
        </div>
      </div>

      {/* Full fuel table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          title="Chi tiết nhiên liệu tất cả xe"
          columns={[
            { key: 'vehicle_id', label: 'Mã xe' },
            { key: 'totalTrips', label: 'Chuyến', align: 'right' },
            { key: 'totalFuel', label: 'NL (L)', align: 'right', format: (r) => (r.totalFuel as number).toFixed(1) },
            { key: 'totalDistance', label: 'Km', align: 'right', format: (r) => formatKm(r.totalDistance as number) },
            { key: 'fuelPer100km', label: 'L/100km', align: 'right' },
            { key: 'fuelStandard', label: 'Định mức', align: 'right', format: (r) => r.fuelStandard ? String(r.fuelStandard) : '—' },
            { key: 'fuelDeviation', label: 'Chênh lệch', align: 'right',
              className: (r) => (r.fuelDeviation as number) > 2 ? 'text-red-500 font-semibold' : (r.fuelDeviation as number) < -1 ? 'text-emerald-600' : '' },
            { key: 'fuelStatus', label: 'Trạng thái', align: 'center',
              format: (r) => r.fuelStatus === 'over' ? '🔴' : r.fuelStatus === 'efficient' ? '🟢' : r.fuelStatus === 'ok' ? '🟡' : r.fuelStatus === 'no_standard' ? '⚪' : '⚫' },
          ]}
          data={vehicleStats as unknown as Record<string, unknown>[]}
          maxRows={30}
        />
      </div>
    </>
  );
}

// ─── REPORT TAB ─────────────────────────────────────────────

function ReportTab({ data, startDate, endDate }: {
  data: FleetTrip[];
  startDate: string;
  endDate: string;
}) {
  // Group by vehicle for report
  const report = useMemo(() => {
    const grouped: Record<string, FleetTrip[]> = {};
    for (const t of data) {
      (grouped[t.vehicle_id] ??= []).push(t);
    }

    return Object.entries(grouped).map(([vehicleId, trips]) => {
      const noiThanh = trips.filter((t) => t.area_type === 'Nội thành');
      const ngoaiThanh = trips.filter((t) => t.area_type === 'Ngoại thành');

      return {
        bsx: vehicleId,
        totalKm: Math.round(trips.reduce((s, t) => s + t.distance_km, 0) * 10) / 10,
        noiThanhKoThu: noiThanh.filter((t) => t.revenue_vnd === 0).length,
        noiThanhCoThu: noiThanh.filter((t) => t.revenue_vnd > 0).length,
        ngoaiThanhKoThu: ngoaiThanh.filter((t) => t.revenue_vnd === 0).length,
        ngoaiThanhCoThu: ngoaiThanh.filter((t) => t.revenue_vnd > 0).length,
        tienNoiThanh: Math.round(noiThanh.reduce((s, t) => s + t.revenue_vnd, 0)),
        tienNgoaiThanh: Math.round(ngoaiThanh.reduce((s, t) => s + t.revenue_vnd, 0)),
        tongTien: Math.round(trips.reduce((s, t) => s + t.revenue_vnd, 0)),
        tongNhienLieu: Math.round(trips.reduce((s, t) => s + t.fuel_liters, 0) * 10) / 10,
      };
    }).sort((a, b) => a.bsx.localeCompare(b.bsx));
  }, [data]);

  const totalKm = report.reduce((s, r) => s + r.totalKm, 0);
  const totalRevenue = report.reduce((s, r) => s + r.tongTien, 0);
  const totalFuel = report.reduce((s, r) => s + r.tongNhienLieu, 0);

  // CSV export
  const exportCSV = () => {
    const headers = ['BSX', 'Tổng km', 'NT ko thu', 'NT có thu', 'NGT ko thu', 'NGT có thu', 'Tiền NT', 'Tiền NGT', 'Tổng tiền', 'Nhiên liệu (L)'];
    const rows = report.map((r) => [
      r.bsx, r.totalKm, r.noiThanhKoThu, r.noiThanhCoThu, r.ngoaiThanhKoThu, r.ngoaiThanhCoThu,
      r.tienNoiThanh, r.tienNgoaiThanh, r.tongTien, r.tongNhienLieu
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao_cao_xe_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Báo cáo theo từng xe</h3>
          <p className="text-xs text-gray-400">{startDate} — {endDate}</p>
        </div>
        <button onClick={exportCSV}
          className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Xuất CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🚗" label="Tổng xe" value={String(report.length)} />
        <StatCard icon="🛣️" label="Tổng km" value={`${formatKm(totalKm)} km`} accent="border-teal-500" />
        <StatCard icon="💰" label="Tổng doanh thu" value={`${formatVNDFull(totalRevenue)} đ`} accent="border-amber-500" />
        <StatCard icon="⛽" label="Tổng nhiên liệu" value={`${formatKm(totalFuel)} L`} accent="border-orange-500" />
      </div>

      {/* Report table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <DataTable
          columns={[
            { key: 'bsx', label: 'BSX' },
            { key: 'totalKm', label: 'Tổng km', align: 'right', format: (r) => formatKm(r.totalKm as number) },
            { key: 'noiThanhKoThu', label: 'NT ko thu', align: 'right' },
            { key: 'noiThanhCoThu', label: 'NT có thu', align: 'right' },
            { key: 'ngoaiThanhKoThu', label: 'NGT ko thu', align: 'right' },
            { key: 'ngoaiThanhCoThu', label: 'NGT có thu', align: 'right' },
            { key: 'tienNoiThanh', label: 'Tiền NT', align: 'right', format: (r) => formatVNDFull(r.tienNoiThanh as number) },
            { key: 'tienNgoaiThanh', label: 'Tiền NGT', align: 'right', format: (r) => formatVNDFull(r.tienNgoaiThanh as number) },
            { key: 'tongTien', label: 'Tổng tiền', align: 'right', format: (r) => formatVNDFull(r.tongTien as number) },
            { key: 'tongNhienLieu', label: 'NL (L)', align: 'right' },
          ]}
          data={report as unknown as Record<string, unknown>[]}
          maxRows={50}
        />
      </div>

      {/* Area breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">🏙️ Thống kê nội thành</h4>
          <div className="text-xs space-y-1">
            <p>Chuyến ko thu tiền: <span className="font-semibold">{report.reduce((s, r) => s + r.noiThanhKoThu, 0).toLocaleString()}</span></p>
            <p>Chuyến có thu tiền: <span className="font-semibold">{report.reduce((s, r) => s + r.noiThanhCoThu, 0).toLocaleString()}</span></p>
            <p>Tổng doanh thu: <span className="font-semibold">{formatVNDFull(report.reduce((s, r) => s + r.tienNoiThanh, 0))} đ</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">🌆 Thống kê ngoại thành</h4>
          <div className="text-xs space-y-1">
            <p>Chuyến ko thu tiền: <span className="font-semibold">{report.reduce((s, r) => s + r.ngoaiThanhKoThu, 0).toLocaleString()}</span></p>
            <p>Chuyến có thu tiền: <span className="font-semibold">{report.reduce((s, r) => s + r.ngoaiThanhCoThu, 0).toLocaleString()}</span></p>
            <p>Tổng doanh thu: <span className="font-semibold">{formatVNDFull(report.reduce((s, r) => s + r.tienNgoaiThanh, 0))} đ</span></p>
          </div>
        </div>
      </div>
    </>
  );
}
