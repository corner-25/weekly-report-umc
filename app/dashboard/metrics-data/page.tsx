'use client';

import { useEffect, useState } from 'react';

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
}

interface MetricValue {
  id: string;
  value: number;
  metricId: string;
  week: Week;
}

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
  const [valueMap, setValueMap] = useState<Map<string, number>>(new Map()); // key: `${metricId}:${weekId}`
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, deptsRes, valuesRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/departments'),
        fetch(`/api/weeks?year=${selectedYear}`),
      ]);

      const metricsData: Metric[] = metricsRes.ok ? await metricsRes.json() : [];
      const deptsData: Department[] = deptsRes.ok ? await deptsRes.json() : [];
      const weeksData: Week[] = valuesRes.ok ? await valuesRes.json() : [];

      setMetrics(metricsData);
      setDepartments(deptsData);
      setWeeks(weeksData.sort((a, b) => b.weekNumber - a.weekNumber));

      // Load week-metric values for this year's weeks only
      if (weeksData.length > 0) {
        const weekIds = weeksData.map((w) => w.id);
        // Fetch values for all weeks in parallel (batched by weekId)
        const valueResponses = await Promise.all(
          weekIds.map((wId) => fetch(`/api/week-metrics?weekId=${wId}`))
        );
        const allValues: MetricValue[] = (
          await Promise.all(valueResponses.map((r) => (r.ok ? r.json() : [])))
        ).flat();

        const map = new Map<string, number>();
        allValues.forEach((mv) => {
          map.set(`${mv.metricId}:${mv.week.id}`, mv.value);
        });
        setValueMap(map);
      } else {
        setValueMap(new Map());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMetrics = selectedDept === 'all'
    ? metrics
    : metrics.filter((m) => m.department.id === selectedDept);

  // Group by department — only show depts that have at least 1 value in this year
  const deptOrder: string[] = [];
  const groupedMetrics: Record<string, { dept: Department; metrics: Metric[] }> = {};
  filteredMetrics.forEach((metric) => {
    const hasValue = weeks.some((w) => valueMap.has(`${metric.id}:${w.id}`));
    if (!hasValue) return;
    const deptId = metric.department.id;
    if (!groupedMetrics[deptId]) {
      deptOrder.push(deptId);
      groupedMetrics[deptId] = { dept: metric.department, metrics: [] };
    }
    groupedMetrics[deptId].metrics.push(metric);
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Báo cáo Số liệu</h1>
          <p className="text-slate-600 mt-1">Xem số liệu định lượng theo tuần của các phòng ban</p>
        </div>
        <div className="text-sm text-slate-500">
          {deptOrder.reduce((s, d) => s + groupedMetrics[d].metrics.length, 0)} chỉ số · {weeks.length} tuần
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="all">Tất cả phòng</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {deptOrder.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Chưa có dữ liệu</h3>
          <p className="text-slate-500">Chưa có số liệu nào được nhập trong năm {selectedYear}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="border-collapse text-sm" style={{ minWidth: `${300 + weeks.length * 90}px` }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 bg-slate-50 text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-r-2 border-slate-300"
                  style={{ minWidth: 240, maxWidth: 320 }}
                >
                  Chỉ số
                </th>
                <th className="bg-slate-50 text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 whitespace-nowrap w-16">
                  ĐV
                </th>
                {weeks.map((week, i) => (
                  <th
                    key={week.id}
                    className={`text-center px-3 py-3 text-xs font-medium uppercase tracking-wider border-b border-r border-slate-200 whitespace-nowrap w-24 ${
                      i === 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div>Tuần {week.weekNumber}</div>
                    <div className="font-normal text-slate-400">
                      {new Date(week.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {deptOrder.map((deptId) => {
                const { dept, metrics: deptMetrics } = groupedMetrics[deptId];
                return (
                  <>
                    <tr key={`dept-${deptId}`}>
                      <td
                        colSpan={2 + weeks.length}
                        className="px-4 py-2 bg-blue-50 border-t-2 border-blue-300"
                      >
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">{dept.name}</span>
                      </td>
                    </tr>
                    {deptMetrics.map((metric, rowIdx) => (
                      <tr key={metric.id} className={rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}>
                        <td
                          className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 border-r-2 border-slate-300 bg-inherit"
                          style={{ minWidth: 240, maxWidth: 320 }}
                        >
                          {metric.name}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-slate-400 border-r border-slate-200 whitespace-nowrap">
                          {metric.unit || '—'}
                        </td>
                        {weeks.map((week, wIdx) => {
                          const value = valueMap.get(`${metric.id}:${week.id}`);
                          const isLatest = wIdx === 0;
                          return (
                            <td
                              key={week.id}
                              className={`px-3 py-3 text-center text-sm border-r border-slate-200 ${isLatest ? 'bg-blue-50' : ''}`}
                            >
                              {value !== undefined ? (
                                <span className={`font-semibold tabular-nums ${isLatest ? 'text-blue-700' : 'text-slate-800'}`}>
                                  {formatValue(value)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
