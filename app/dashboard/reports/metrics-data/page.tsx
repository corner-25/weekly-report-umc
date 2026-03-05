'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Department {
  id: string;
  name: string;
}

interface Metric {
  id: string;
  name: string;
  unit?: string;
  department: Department;
}

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
}

interface MetricValue {
  id: string;
  value: number;
  note?: string;
  metric: Metric;
  week: Week;
}

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  default: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-400', badge: 'bg-slate-500' },
  0: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-400', badge: 'bg-blue-600' },
  1: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-400', badge: 'bg-emerald-600' },
  2: { bg: 'bg-violet-50', text: 'text-violet-900', border: 'border-violet-400', badge: 'bg-violet-600' },
  3: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-400', badge: 'bg-amber-600' },
  4: { bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-400', badge: 'bg-rose-600' },
  5: { bg: 'bg-cyan-50', text: 'text-cyan-900', border: 'border-cyan-400', badge: 'bg-cyan-600' },
  6: { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-400', badge: 'bg-orange-600' },
  7: { bg: 'bg-teal-50', text: 'text-teal-900', border: 'border-teal-400', badge: 'bg-teal-600' },
  8: { bg: 'bg-indigo-50', text: 'text-indigo-900', border: 'border-indigo-400', badge: 'bg-indigo-600' },
  9: { bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-400', badge: 'bg-pink-600' },
  10: { bg: 'bg-lime-50', text: 'text-lime-900', border: 'border-lime-400', badge: 'bg-lime-600' },
  11: { bg: 'bg-sky-50', text: 'text-sky-900', border: 'border-sky-400', badge: 'bg-sky-600' },
  12: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-900', border: 'border-fuchsia-400', badge: 'bg-fuchsia-600' },
  13: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-400', badge: 'bg-red-600' },
};

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 10_000) return value.toLocaleString('vi-VN');
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export default function MetricsDataPage() {
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [valuesRes, deptsRes, metricsRes, weeksRes] = await Promise.all([
        fetch('/api/week-metrics'),
        fetch('/api/departments'),
        fetch('/api/metrics'),
        fetch(`/api/weeks?year=${selectedYear}`),
      ]);

      if (valuesRes.ok) setMetricValues(await valuesRes.json());
      if (deptsRes.ok) setDepartments(await deptsRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (weeksRes.ok) {
        const weeksData: Week[] = await weeksRes.json();
        // Sort newest first
        setWeeks(weeksData.sort((a, b) => b.weekNumber - a.weekNumber));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredValues = metricValues.filter((mv) => {
    if (mv.week.year !== selectedYear) return false;
    if (selectedDept !== 'all' && mv.metric.department.id !== selectedDept) return false;
    if (selectedMetric !== 'all' && mv.metric.id !== selectedMetric) return false;
    if (search && !mv.metric.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // weekIds sorted newest first
  const weekIds = [...new Set(filteredValues.map((mv) => mv.week.id))].sort((a, b) => {
    const weekA = weeks.find((w) => w.id === a);
    const weekB = weeks.find((w) => w.id === b);
    if (!weekA || !weekB) return 0;
    return weekB.weekNumber - weekA.weekNumber;
  });

  // Group rows by department
  const deptOrder: string[] = [];
  const groupedRows: Record<string, { dept: Department; colorIdx: number; rows: { metricId: string; metric: Metric; values: Record<string, MetricValue | undefined> }[] }> = {};

  const metricIds = [...new Set(filteredValues.map((mv) => mv.metric.id))];
  metricIds.forEach((metricId) => {
    const metric = metrics.find((m) => m.id === metricId);
    if (!metric) return;
    const deptId = metric.department.id;
    if (!groupedRows[deptId]) {
      deptOrder.push(deptId);
      groupedRows[deptId] = { dept: metric.department, colorIdx: deptOrder.length - 1, rows: [] };
    }
    const values: Record<string, MetricValue | undefined> = {};
    weekIds.forEach((weekId) => {
      values[weekId] = filteredValues.find((mv) => mv.metric.id === metricId && mv.week.id === weekId);
    });
    groupedRows[deptId].rows.push({ metricId, metric, values });
  });

  const availableMetrics = selectedDept === 'all'
    ? metrics
    : metrics.filter((m) => m.department.id === selectedDept);

  const totalRows = metricIds.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-full">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo Số liệu - Dạng Bảng</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalRows} chỉ số · {weekIds.length} tuần · {deptOrder.length} phòng ban
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Năm</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Phòng ban</label>
          <select
            value={selectedDept}
            onChange={(e) => { setSelectedDept(e.target.value); setSelectedMetric('all'); }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Chỉ số</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả</option>
            {availableMetrics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Tìm</label>
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm chỉ số..."
              className="w-full text-sm border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {totalRows === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 font-medium">Chưa có dữ liệu cho năm {selectedYear}</p>
          <p className="text-gray-400 text-sm mt-1">Nhập số liệu trong các báo cáo tuần để xem ở đây</p>
        </div>
      ) : (
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto flex-1"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          <table className="border-collapse text-sm" style={{ minWidth: `${200 + weekIds.length * 80}px` }}>
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Frozen: Chỉ số */}
                <th
                  className="sticky left-0 z-30 bg-gray-800 text-white text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide border-r-2 border-gray-500"
                  style={{ width: '30%', minWidth: 200, maxWidth: 320 }}
                >
                  Chỉ số
                </th>
                <th className="bg-gray-700 text-gray-300 text-center px-2 py-2.5 font-medium text-xs uppercase tracking-wide border-r border-gray-600 whitespace-nowrap w-14">
                  ĐV
                </th>
                {weekIds.map((weekId, i) => {
                  const week = weeks.find((w) => w.id === weekId);
                  return (
                    <th
                      key={weekId}
                      className={`bg-gray-700 text-center px-2 py-2.5 text-xs border-r border-gray-600 w-20 whitespace-nowrap ${
                        i === 0 ? 'text-blue-300 font-bold' : 'text-gray-300 font-medium'
                      }`}
                    >
                      <div className="font-semibold">T{week?.weekNumber}</div>
                      <div className="text-gray-400 font-normal text-[10px] leading-tight">
                        {week?.startDate && format(new Date(week.startDate), 'dd/MM', { locale: vi })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {deptOrder.map((deptId) => {
                const { dept, colorIdx, rows } = groupedRows[deptId];
                const color = DEPT_COLORS[colorIdx] ?? DEPT_COLORS.default;

                return rows.map(({ metricId, metric, values }, rowIdx) => {
                  const isFirst = rowIdx === 0;

                  return (
                    <tr key={metricId} className="group hover:brightness-95 transition-all">
                      {/* Metric name — frozen */}
                      <td
                        className={`sticky left-0 z-10 px-3 py-2 text-gray-800 font-medium border-r-2 border-gray-300 border-b border-gray-100 align-middle bg-white group-hover:bg-gray-50
                          ${isFirst ? `border-t-2 ${color.border}` : ''}
                        `}
                        style={{ width: '30%', minWidth: 200, maxWidth: 320 }}
                      >
                        <div className="flex items-start gap-1.5">
                          {isFirst
                            ? <span className={`inline-block w-1.5 h-1.5 rounded-full ${color.badge} flex-shrink-0 mt-1`} title={dept.name} />
                            : <span className="inline-block w-1.5 flex-shrink-0" />
                          }
                          <span className="text-xs leading-snug break-words">{metric.name}</span>
                        </div>
                      </td>

                      {/* Unit */}
                      <td
                        className={`px-2 py-2 text-center text-gray-400 text-xs border-r border-gray-100 border-b border-gray-100 align-middle whitespace-nowrap bg-gray-50
                          ${isFirst ? `border-t-2 ${color.border}` : ''}
                        `}
                      >
                        {metric.unit || ''}
                      </td>

                      {/* Week values */}
                      {weekIds.map((weekId, wIdx) => {
                        const mv = values[weekId];
                        const isLatest = wIdx === 0;
                        return (
                          <td
                            key={weekId}
                            className={`px-2 py-2 text-center border-r border-gray-100 border-b border-gray-100 align-middle
                              ${isFirst ? `border-t-2 ${color.border}` : ''}
                              ${isLatest ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-white group-hover:bg-gray-50'}
                            `}
                          >
                            {mv != null ? (
                              <div>
                                <span className={`font-semibold tabular-nums text-xs ${isLatest ? 'text-blue-700' : 'text-gray-700'}`}>
                                  {formatValue(mv.value)}
                                </span>
                                {mv.note && (
                                  <div className="text-[10px] text-gray-400 truncate max-w-[70px]" title={mv.note}>
                                    {mv.note}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {deptOrder.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {deptOrder.map((deptId) => {
            const { dept, colorIdx } = groupedRows[deptId];
            const color = DEPT_COLORS[colorIdx] ?? DEPT_COLORS.default;
            return (
              <button
                key={deptId}
                onClick={() => setSelectedDept(selectedDept === deptId ? 'all' : deptId)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                  ${selectedDept === deptId
                    ? `${color.bg} ${color.text} border-current shadow-sm`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${color.badge}`} />
                {dept.name}
              </button>
            );
          })}
          {selectedDept !== 'all' && (
            <button
              onClick={() => setSelectedDept('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              ✕ Bỏ lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}
