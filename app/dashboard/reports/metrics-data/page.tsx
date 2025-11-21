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

export default function MetricsDataPage() {
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      const [valuesRes, deptsRes, metricsRes, weeksRes] = await Promise.all([
        fetch('/api/week-metrics'),
        fetch('/api/departments'),
        fetch('/api/metrics'),
        fetch(`/api/weeks?year=${selectedYear}`),
      ]);

      if (valuesRes.ok) {
        const valuesData = await valuesRes.json();
        setMetricValues(valuesData);
      }

      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(deptsData);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (weeksRes.ok) {
        const weeksData = await weeksRes.json();
        setWeeks(weeksData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data
  const filteredValues = metricValues.filter((mv) => {
    if (mv.week.year !== selectedYear) return false;
    if (selectedDept !== 'all' && mv.metric.department.id !== selectedDept) return false;
    if (selectedMetric !== 'all' && mv.metric.id !== selectedMetric) return false;
    return true;
  });

  // Group data by metric and week
  const metricIds = [...new Set(filteredValues.map((mv) => mv.metric.id))];
  const weekIds = [...new Set(filteredValues.map((mv) => mv.week.id))].sort((a, b) => {
    const weekA = weeks.find((w) => w.id === a);
    const weekB = weeks.find((w) => w.id === b);
    if (!weekA || !weekB) return 0;
    return weekA.weekNumber - weekB.weekNumber;
  });

  const tableData = metricIds.map((metricId) => {
    const metric = metrics.find((m) => m.id === metricId);
    if (!metric) return null;

    const rowData: any = {
      metric,
      values: {},
    };

    weekIds.forEach((weekId) => {
      const value = filteredValues.find(
        (mv) => mv.metric.id === metricId && mv.week.id === weekId
      );
      rowData.values[weekId] = value;
    });

    return rowData;
  }).filter(Boolean);

  // Filter metrics by selected department
  const availableMetrics = selectedDept === 'all'
    ? metrics
    : metrics.filter((m) => m.department.id === selectedDept);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Báo cáo Số liệu - Dạng Bảng</h1>
        <p className="text-gray-600 mt-2">Xem dữ liệu định lượng theo tuần và chỉ số</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Năm
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phòng ban
            </label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedMetric('all'); // Reset metric filter
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả phòng</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chỉ số
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả chỉ số</option>
              {availableMetrics.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.name} {metric.unit && `(${metric.unit})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Số tuần có dữ liệu</p>
            <p className="text-2xl font-bold text-blue-600">{weekIds.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Số chỉ số</p>
            <p className="text-2xl font-bold text-green-600">{metricIds.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tổng điểm dữ liệu</p>
            <p className="text-2xl font-bold text-purple-600">{filteredValues.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phòng ban</p>
            <p className="text-2xl font-bold text-orange-600">
              {selectedDept === 'all' ? departments.length : 1}
            </p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {tableData.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu</h3>
          <p className="text-gray-500">
            Chưa có số liệu nào được nhập cho {selectedYear}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  Chỉ số
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phòng ban
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Đơn vị
                </th>
                {weekIds.map((weekId) => {
                  const week = weeks.find((w) => w.id === weekId);
                  return (
                    <th
                      key={weekId}
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      Tuần {week?.weekNumber}
                      <br />
                      <span className="text-xs font-normal text-gray-400">
                        {week?.startDate && format(new Date(week.startDate), 'dd/MM', { locale: vi })}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row: any, index) => (
                <tr key={row.metric.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-inherit">
                    {row.metric.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.metric.department.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.metric.unit || '-'}
                  </td>
                  {weekIds.map((weekId) => {
                    const value = row.values[weekId];
                    return (
                      <td
                        key={weekId}
                        className="px-6 py-4 whitespace-nowrap text-sm text-center"
                      >
                        {value ? (
                          <div>
                            <div className="font-semibold text-blue-600">{value.value}</div>
                            {value.note && (
                              <div className="text-xs text-gray-500 truncate max-w-[100px]" title={value.note}>
                                {value.note}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Export hint */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Mẹo:</strong> Bạn có thể sao chép bảng này và dán vào Excel để xuất báo cáo.
          Chọn toàn bộ bảng (bấm vào góc trái trên của bảng), sau đó nhấn Ctrl+C (hoặc Cmd+C trên Mac) để sao chép.
        </p>
      </div>
    </div>
  );
}
