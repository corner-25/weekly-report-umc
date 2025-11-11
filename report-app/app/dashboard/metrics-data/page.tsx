'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

interface MetricValue {
  metricId: string;
  weekId: string;
  value: number;
  note?: string;
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

export default function MetricsDataPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
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

        // Extract unique weeks from metric values
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

  // Filter metrics by department
  const filteredMetrics = selectedDept === 'all'
    ? metrics
    : metrics.filter(m => m.department.id === selectedDept);

  // Group metrics by department
  const groupedMetrics = filteredMetrics.reduce((acc, metric) => {
    const deptId = metric.department.id;
    if (!acc[deptId]) {
      acc[deptId] = {
        department: metric.department,
        metrics: [],
      };
    }
    acc[deptId].metrics.push(metric);
    return acc;
  }, {} as Record<string, { department: Department; metrics: Metric[] }>);

  const getValueForWeek = (metric: Metric, weekId: string): number | null => {
    const weekValue = metric.weekValues?.find((wv: any) => wv.week.id === weekId);
    return weekValue ? weekValue.value : null;
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Báo cáo Số liệu</h1>
        <p className="text-gray-600 mt-2">Xem số liệu định lượng theo tuần của các phòng ban</p>
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
              onChange={(e) => setSelectedDept(e.target.value)}
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

          <div className="flex items-end">
            <Link
              href="/dashboard/departments"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-center"
            >
              Quản lý Chỉ số
            </Link>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {Object.keys(groupedMetrics).length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu</h3>
            <p className="text-gray-500 mb-4">
              Thêm chỉ số cho các phòng ban và nhập số liệu hàng tuần
            </p>
            <Link
              href="/dashboard/departments"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Quản lý Chỉ số
            </Link>
          </div>
        ) : (
          <div className="min-w-max">
            {Object.values(groupedMetrics).map(({ department, metrics: deptMetrics }) => (
              <div key={department.id} className="border-b border-gray-200 last:border-b-0">
                {/* Department Header */}
                <div className="bg-blue-50 border-t-2 border-blue-300 px-6 py-3">
                  <h3 className="font-bold text-blue-900">{department.name}</h3>
                </div>

                {/* Metrics Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[250px]">
                          Chỉ số
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          Đơn vị
                        </th>
                        {weeks.map((week) => (
                          <th
                            key={week.id}
                            className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border-l border-gray-200"
                          >
                            <div>T{week.weekNumber}</div>
                            <div className="text-gray-400 font-normal">{week.year}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deptMetrics.map((metric) => (
                        <tr key={metric.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                            {metric.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-500">
                            {metric.unit || '-'}
                          </td>
                          {weeks.map((week) => {
                            const value = getValueForWeek(metric, week.id);
                            return (
                              <td
                                key={week.id}
                                className="px-4 py-4 text-sm text-center border-l border-gray-200"
                              >
                                {value !== null ? (
                                  <span className="font-semibold text-gray-900">
                                    {value.toLocaleString()}
                                  </span>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      {weeks.length === 0 && Object.keys(groupedMetrics).length > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Chưa có dữ liệu số liệu nào được nhập trong năm {selectedYear}.
            Hãy tạo báo cáo tuần và nhập số liệu để xem dữ liệu ở đây.
          </p>
        </div>
      )}
    </div>
  );
}
