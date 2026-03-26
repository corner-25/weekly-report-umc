'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Table2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

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
        const data: Week[] = await weeksRes.json();
        setWeeks(data.sort((a, b) => b.weekNumber - a.weekNumber));
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
    return true;
  });

  // weekIds sorted newest first
  const weekIds = [...new Set(filteredValues.map((mv) => mv.week.id))].sort((a, b) => {
    const wa = weeks.find((w) => w.id === a);
    const wb = weeks.find((w) => w.id === b);
    if (!wa || !wb) return 0;
    return wb.weekNumber - wa.weekNumber;
  });

  const metricIds = [...new Set(filteredValues.map((mv) => mv.metric.id))];

  // Group by department
  const deptOrder: string[] = [];
  const groupedRows: Record<string, { dept: Department; rows: { metricId: string; metric: Metric; values: Record<string, MetricValue | undefined> }[] }> = {};
  metricIds.forEach((metricId) => {
    const metric = metrics.find((m) => m.id === metricId);
    if (!metric) return;
    const deptId = metric.department.id;
    if (!groupedRows[deptId]) {
      deptOrder.push(deptId);
      groupedRows[deptId] = { dept: metric.department, rows: [] };
    }
    const values: Record<string, MetricValue | undefined> = {};
    weekIds.forEach((wId) => {
      values[wId] = filteredValues.find((mv) => mv.metric.id === metricId && mv.week.id === wId);
    });
    groupedRows[deptId].rows.push({ metricId, metric, values });
  });

  const availableMetrics = selectedDept === 'all'
    ? metrics
    : metrics.filter((m) => m.department.id === selectedDept);

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
      <PageHeader
        icon={Table2}
        title="Báo cáo Số liệu - Dạng Bảng"
        description="Xem dữ liệu định lượng theo tuần và chỉ số"
        className="mb-6"
        actions={
          <span className="text-sm text-slate-500">
            {metricIds.length} chỉ số · {weekIds.length} tuần
          </span>
        }
      />

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
              onChange={(e) => { setSelectedDept(e.target.value); setSelectedMetric('all'); }}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="all">Tất cả phòng</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chỉ số</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="all">Tất cả chỉ số</option>
              {availableMetrics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {metricIds.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Chưa có dữ liệu</h3>
          <p className="text-slate-500">Chưa có số liệu nào được nhập cho {selectedYear}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="border-collapse text-sm" style={{ minWidth: `${300 + weekIds.length * 90}px` }}>
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
                {weekIds.map((weekId, i) => {
                  const week = weeks.find((w) => w.id === weekId);
                  return (
                    <th
                      key={weekId}
                      className={`text-center px-3 py-3 text-xs font-medium uppercase tracking-wider border-b border-r border-slate-200 whitespace-nowrap w-24 ${
                        i === 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      <div>Tuần {week?.weekNumber}</div>
                      <div className="font-normal text-slate-400">
                        {week?.startDate && format(new Date(week.startDate), 'dd/MM', { locale: vi })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {deptOrder.map((deptId) => {
                const { dept, rows } = groupedRows[deptId];
                return (
                  <>
                    {/* Department header row */}
                    <tr key={`dept-${deptId}`}>
                      <td
                        colSpan={2 + weekIds.length}
                        className="px-4 py-2 bg-blue-50 border-t-2 border-blue-300"
                      >
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">{dept.name}</span>
                      </td>
                    </tr>
                    {rows.map(({ metricId, metric, values }, rowIdx) => (
                      <tr key={metricId} className={rowIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}>
                        <td
                          className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 border-r-2 border-slate-300 bg-inherit"
                          style={{ minWidth: 240, maxWidth: 320 }}
                        >
                          <span className="leading-snug">{metric.name}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-slate-400 border-r border-slate-200 whitespace-nowrap">
                          {metric.unit || '—'}
                        </td>
                        {weekIds.map((weekId, wIdx) => {
                          const mv = values[weekId];
                          const isLatest = wIdx === 0;
                          return (
                            <td
                              key={weekId}
                              className={`px-3 py-3 text-center text-sm border-r border-slate-200 ${isLatest ? 'bg-blue-50' : ''}`}
                            >
                              {mv != null ? (
                                <div>
                                  <span className={`font-semibold tabular-nums ${isLatest ? 'text-blue-700' : 'text-slate-800'}`}>
                                    {formatValue(mv.value)}
                                  </span>
                                  {mv.note && (
                                    <div className="text-xs text-slate-400 truncate max-w-[80px]" title={mv.note}>
                                      {mv.note}
                                    </div>
                                  )}
                                </div>
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

      {/* Export hint */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Mẹo:</strong> Bạn có thể sao chép bảng này và dán vào Excel để xuất báo cáo.
          Chọn toàn bộ bảng, sau đó nhấn Ctrl+C (hoặc Cmd+C trên Mac) để sao chép.
        </p>
      </div>
    </div>
  );
}
