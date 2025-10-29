'use client';

import { useEffect, useState } from 'react';

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

interface MetricValue {
  metricId: string;
  value: number;
  note?: string;
}

interface Props {
  weekId?: string; // Optional - nếu đang edit week có sẵn
  departmentId?: string; // Optional - chỉ hiển thị metrics của phòng này
  onChange: (values: MetricValue[]) => void;
}

export default function MetricsInput({ weekId, departmentId, onChange }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [values, setValues] = useState<Record<string, MetricValue>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [weekId, departmentId]);

  const fetchData = async () => {
    try {
      const [metricsRes, deptsRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/departments'),
      ]);

      if (metricsRes.ok && deptsRes.ok) {
        const metricsData = await metricsRes.json();
        const deptsData = await deptsRes.json();

        console.log('MetricsInput - Fetched metrics:', metricsData);
        console.log('MetricsInput - Fetched departments:', deptsData);

        // Filter metrics by department if departmentId is provided
        const filteredMetrics = departmentId
          ? metricsData.filter((m: Metric) => m.department.id === departmentId)
          : metricsData;

        setMetrics(filteredMetrics);
        setDepartments(deptsData);

        // Auto expand ALL departments that have metrics
        const deptsWithMetrics = new Set<string>(filteredMetrics.map((m: Metric) => m.department.id));
        console.log('MetricsInput - Auto-expanding departments:', Array.from(deptsWithMetrics));
        setExpandedDepts(deptsWithMetrics);

        // If editing, load existing values
        if (weekId) {
          const valuesRes = await fetch(`/api/week-metrics?weekId=${weekId}`);
          if (valuesRes.ok) {
            const valuesData = await valuesRes.json();
            const valuesMap: Record<string, MetricValue> = {};
            valuesData.forEach((v: any) => {
              valuesMap[v.metricId] = {
                metricId: v.metricId,
                value: v.value,
                note: v.note,
              };
            });
            setValues(valuesMap);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (metricId: string, value: number) => {
    const newValues = {
      ...values,
      [metricId]: {
        metricId,
        value,
        note: values[metricId]?.note,
      },
    };
    setValues(newValues);
    onChange(Object.values(newValues).filter(v => v.value !== undefined && v.value !== null));
  };

  const handleNoteChange = (metricId: string, note: string) => {
    const newValues = {
      ...values,
      [metricId]: {
        ...values[metricId],
        metricId,
        value: values[metricId]?.value || 0,
        note,
      },
    };
    setValues(newValues);
    onChange(Object.values(newValues).filter(v => v.value !== undefined && v.value !== null));
  };

  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepts(newExpanded);
  };

  // Group metrics by department
  const metricsByDept = metrics.reduce((acc, metric) => {
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

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Đang tải chỉ số...</p>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600 mb-2">
          Chưa có chỉ số nào được thiết lập
        </p>
        <p className="text-xs text-gray-500">
          Vào trang Phòng ban để thiết lập chỉ số báo cáo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Số liệu định lượng</h3>
        <p className="text-sm text-gray-500">
          {Object.keys(values).length} / {metrics.length} chỉ số đã nhập
        </p>
      </div>

      {Object.values(metricsByDept).map(({ department, metrics: deptMetrics }) => (
        <div key={department.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Department Header */}
          <button
            type="button"
            onClick={() => toggleDepartment(department.id)}
            className="w-full bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  expandedDepts.has(department.id) ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-gray-900">{department.name}</span>
              <span className="text-sm text-gray-500">({deptMetrics.length} chỉ số)</span>
            </div>
            {expandedDepts.has(department.id) && (
              <span className="text-xs text-blue-600 font-medium">
                {deptMetrics.filter(m => values[m.id]?.value).length} đã nhập
              </span>
            )}
          </button>

          {/* Metrics List */}
          {expandedDepts.has(department.id) && (
            <div className="bg-white divide-y divide-gray-200">
              {deptMetrics.map((metric) => (
                <div key={metric.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Metric Name */}
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {metric.name}
                        {metric.unit && (
                          <span className="text-gray-500 font-normal ml-1">({metric.unit})</span>
                        )}
                      </label>
                    </div>

                    {/* Value Input */}
                    <div className="md:col-span-1">
                      <input
                        type="number"
                        step="0.01"
                        value={values[metric.id]?.value || ''}
                        onChange={(e) => handleValueChange(metric.id, parseFloat(e.target.value) || 0)}
                        placeholder="Nhập giá trị"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Note Input */}
                    <div className="md:col-span-1">
                      <input
                        type="text"
                        value={values[metric.id]?.note || ''}
                        onChange={(e) => handleNoteChange(metric.id, e.target.value)}
                        placeholder="Ghi chú (tùy chọn)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Số liệu này sẽ được hiển thị trong báo cáo "Báo cáo Số liệu".
          Bạn có thể bỏ qua các chỉ số không có dữ liệu trong tuần này.
        </p>
      </div>
    </div>
  );
}
