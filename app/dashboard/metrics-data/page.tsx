'use client';

import { useEffect, useState, useRef } from 'react';

interface Department {
  id: string;
  name: string;
}

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
}

interface Metric {
  id: string;
  name: string;
  unit?: string;
  department: Department;
  weekValues: {
    value: number;
    week: Week;
  }[];
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
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, deptsRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/departments'),
      ]);

      if (metricsRes.ok && deptsRes.ok) {
        const metricsData = await metricsRes.json();
        const deptsData = await deptsRes.json();

        setMetrics(metricsData);
        setDepartments(deptsData);

        const weekMap = new Map<string, Week>();
        metricsData.forEach((metric: Metric) => {
          metric.weekValues?.forEach((wv: any) => {
            if (wv.week.year === selectedYear) {
              weekMap.set(wv.week.id, wv.week);
            }
          });
        });

        const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.weekNumber - b.weekNumber;
        });

        setWeeks(sortedWeeks);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMetrics = metrics.filter((m) => {
    if (selectedDept !== 'all' && m.department.id !== selectedDept) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    // Only show metrics that have at least one value in selected year
    const hasData = m.weekValues?.some((wv: any) => wv.week.year === selectedYear);
    return hasData;
  });

  // Group metrics by department, preserve order
  const deptOrder: string[] = [];
  const groupedMetrics: Record<string, { department: Department; metrics: Metric[]; colorIdx: number }> = {};
  filteredMetrics.forEach((metric) => {
    const deptId = metric.department.id;
    if (!groupedMetrics[deptId]) {
      deptOrder.push(deptId);
      groupedMetrics[deptId] = {
        department: metric.department,
        metrics: [],
        colorIdx: deptOrder.length - 1,
      };
    }
    groupedMetrics[deptId].metrics.push(metric);
  });

  const getValueForWeek = (metric: Metric, weekId: string): number | null => {
    const weekValue = metric.weekValues?.find((wv: any) => wv.week.id === weekId);
    return weekValue != null ? weekValue.value : null;
  };

  const totalRows = filteredMetrics.length;

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
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo Số liệu</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalRows} chỉ số · {weeks.length} tuần · {deptOrder.length} phòng ban
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-center">
        {/* Year */}
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

        {/* Department */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Phòng ban</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Tìm chỉ số</label>
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên..."
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
          ref={tableRef}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto flex-1"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          <table className="border-collapse text-sm" style={{ minWidth: `${320 + weeks.length * 80}px` }}>
            {/* Sticky header */}
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Frozen: Dept + Metric */}
                <th
                  className="sticky left-0 z-30 bg-gray-800 text-white text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide border-r border-gray-600 whitespace-nowrap"
                  style={{ minWidth: 140, maxWidth: 160 }}
                >
                  Phòng ban
                </th>
                <th
                  className="sticky bg-gray-800 text-white text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide border-r-2 border-gray-500 whitespace-nowrap"
                  style={{ left: 140, minWidth: 180, maxWidth: 220 }}
                >
                  Chỉ số
                </th>
                <th
                  className="bg-gray-700 text-gray-300 text-center px-2 py-2.5 font-medium text-xs uppercase tracking-wide border-r border-gray-600 whitespace-nowrap w-14"
                >
                  ĐV
                </th>
                {weeks.map((week, i) => (
                  <th
                    key={week.id}
                    className={`bg-gray-700 text-center px-2 py-2.5 text-xs border-r border-gray-600 w-20 whitespace-nowrap ${
                      i === weeks.length - 1 ? 'text-blue-300 font-bold' : 'text-gray-300 font-medium'
                    }`}
                  >
                    <div className="font-semibold">T{week.weekNumber}</div>
                    <div className="text-gray-400 font-normal text-[10px] leading-tight">
                      {new Date(week.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {deptOrder.map((deptId) => {
                const { department, metrics: deptMetrics, colorIdx } = groupedMetrics[deptId];
                const color = DEPT_COLORS[colorIdx] ?? DEPT_COLORS.default;

                return deptMetrics.map((metric, rowIdx) => {
                  const isFirst = rowIdx === 0;
                  const isLast = rowIdx === deptMetrics.length - 1;

                  return (
                    <tr
                      key={metric.id}
                      className="group hover:brightness-95 transition-all"
                    >
                      {/* Dept cell — only show on first row, span all rows */}
                      <td
                        className={`sticky left-0 z-10 px-3 text-xs font-bold border-r border-gray-200 align-middle border-b border-gray-100
                          ${color.bg} ${color.text}
                          ${isFirst ? `border-t-2 ${color.border}` : ''}
                        `}
                        style={{ minWidth: 140, maxWidth: 160 }}
                      >
                        {isFirst && (
                          <div className="flex items-center gap-1.5 py-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${color.badge} flex-shrink-0`} />
                            <span className="leading-tight">{department.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Metric name */}
                      <td
                        className={`sticky px-3 py-2 text-gray-800 font-medium border-r-2 border-gray-300 border-b border-gray-100 align-middle bg-white
                          ${isFirst ? `border-t-2 ${color.border}` : ''}
                          group-hover:bg-gray-50
                        `}
                        style={{ left: 140, minWidth: 180, maxWidth: 220 }}
                      >
                        <span className="block truncate text-xs leading-snug" title={metric.name}>
                          {metric.name}
                        </span>
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
                      {weeks.map((week, wIdx) => {
                        const value = getValueForWeek(metric, week.id);
                        const isLatest = wIdx === weeks.length - 1;

                        return (
                          <td
                            key={week.id}
                            className={`px-2 py-2 text-center border-r border-gray-100 border-b border-gray-100 align-middle
                              ${isFirst ? `border-t-2 ${color.border}` : ''}
                              ${isLatest ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-white group-hover:bg-gray-50'}
                            `}
                          >
                            {value !== null ? (
                              <span className={`font-semibold tabular-nums text-xs ${isLatest ? 'text-blue-700' : 'text-gray-700'}`}>
                                {formatValue(value)}
                              </span>
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
            const { department, colorIdx } = groupedMetrics[deptId];
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
                {department.name}
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
