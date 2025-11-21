'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Department {
  id: string;
  name: string;
}

interface WeekProgress {
  weekNumber: number;
  year: number;
  progress: number;
  result: string;
  startDate: string;
}

interface MasterTask {
  id: string;
  name: string;
  department: Department;
  weeklyProgress?: WeekProgress[];
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  estimatedDuration: number | null;
  createdAt: string;
}

interface DepartmentMetrics {
  department: Department;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  avgProgress: number;
  totalWeeks: number;
  completionRate: number;
}

interface MonthlyMetrics {
  month: string;
  tasksStarted: number;
  tasksCompleted: number;
  avgProgress: number;
}

export default function MetricsPage() {
  // Fixed: Added null checks for weeklyProgress to prevent undefined errors
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, deptsRes] = await Promise.all([
        fetch('/api/master-tasks?includeProgress=true'),
        fetch('/api/departments'),
      ]);

      if (tasksRes.ok && deptsRes.ok) {
        const tasksData = await tasksRes.json();
        const deptsData = await deptsRes.json();

        console.log('Metrics - Fetched data:', {
          tasksCount: tasksData.length,
          departmentsCount: deptsData.length,
          tasks: tasksData,
        });

        setTasks(tasksData);
        setDepartments(deptsData);
      } else {
        console.error('Metrics - API error:', {
          tasksStatus: tasksRes.status,
          deptsStatus: deptsRes.status,
        });
      }
    } catch (error) {
      console.error('Metrics - Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks by year
  const filteredTasks = tasks.filter(task => {
    const weeklyProgress = task.weeklyProgress || [];
    const hasProgressInYear = weeklyProgress.some(wp => wp.year === selectedYear);
    const createdInYear = new Date(task.createdAt).getFullYear() === selectedYear;
    return hasProgressInYear || createdInYear || weeklyProgress.length === 0;
  });

  // Department-level metrics
  const departmentMetrics: DepartmentMetrics[] = departments.map(dept => {
    const deptTasks = filteredTasks.filter(t => t.department.id === dept.id);
    const completed = deptTasks.filter(t => t.isCompleted).length;
    const inProgress = deptTasks.filter(t => !t.isCompleted && t.weekCount > 0).length;
    const notStarted = deptTasks.filter(t => t.weekCount === 0).length;

    const totalProgress = deptTasks.reduce((sum, t) => sum + t.latestProgress, 0);
    const avgProgress = deptTasks.length > 0 ? Math.round(totalProgress / deptTasks.length) : 0;

    const totalWeeks = deptTasks.reduce((sum, t) => sum + t.weekCount, 0);
    const completionRate = deptTasks.length > 0 ? Math.round((completed / deptTasks.length) * 100) : 0;

    return {
      department: dept,
      totalTasks: deptTasks.length,
      completedTasks: completed,
      inProgressTasks: inProgress,
      notStartedTasks: notStarted,
      avgProgress,
      totalWeeks,
      completionRate,
    };
  });

  // Filter by selected department
  const displayMetrics = selectedDept === 'all'
    ? departmentMetrics
    : departmentMetrics.filter(m => m.department.id === selectedDept);

  // Overall metrics
  const overallMetrics = {
    totalTasks: filteredTasks.length,
    completedTasks: filteredTasks.filter(t => t.isCompleted).length,
    inProgressTasks: filteredTasks.filter(t => !t.isCompleted && t.weekCount > 0).length,
    notStartedTasks: filteredTasks.filter(t => t.weekCount === 0).length,
    avgProgress: filteredTasks.length > 0
      ? Math.round(filteredTasks.reduce((sum, t) => sum + t.latestProgress, 0) / filteredTasks.length)
      : 0,
    totalWeeks: filteredTasks.reduce((sum, t) => sum + t.weekCount, 0),
    avgWeeksPerTask: filteredTasks.length > 0
      ? Math.round(filteredTasks.reduce((sum, t) => sum + t.weekCount, 0) / filteredTasks.length)
      : 0,
    completionRate: filteredTasks.length > 0
      ? Math.round((filteredTasks.filter(t => t.isCompleted).length / filteredTasks.length) * 100)
      : 0,
  };

  // Monthly breakdown
  const monthlyMetrics: MonthlyMetrics[] = [];
  for (let month = 1; month <= 12; month++) {
    const monthTasks = filteredTasks.filter(task => {
      const weeklyProgress = task.weeklyProgress || [];
      const hasProgressInMonth = weeklyProgress.some(wp => {
        const date = new Date(wp.startDate);
        return date.getFullYear() === selectedYear && date.getMonth() + 1 === month;
      });
      return hasProgressInMonth;
    });

    const completedInMonth = monthTasks.filter(t => {
      const weeklyProgress = t.weeklyProgress || [];
      const lastProgress = weeklyProgress[weeklyProgress.length - 1];
      if (!lastProgress) return false;
      const date = new Date(lastProgress.startDate);
      return date.getFullYear() === selectedYear &&
             date.getMonth() + 1 === month &&
             t.isCompleted;
    }).length;

    const avgProgress = monthTasks.length > 0
      ? Math.round(monthTasks.reduce((sum, t) => {
          const weeklyProgress = t.weeklyProgress || [];
          const monthProgress = weeklyProgress.filter(wp => {
            const date = new Date(wp.startDate);
            return date.getFullYear() === selectedYear && date.getMonth() + 1 === month;
          });
          const avg = monthProgress.length > 0
            ? monthProgress.reduce((s, p) => s + p.progress, 0) / monthProgress.length
            : 0;
          return sum + avg;
        }, 0) / monthTasks.length)
      : 0;

    monthlyMetrics.push({
      month: `T${month}`,
      tasksStarted: monthTasks.length,
      tasksCompleted: completedInMonth,
      avgProgress,
    });
  }

  // Top performers
  const topPerformingDepts = [...departmentMetrics]
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  const topTasksByProgress = [...filteredTasks]
    .filter(t => t.weekCount > 0)
    .sort((a, b) => b.latestProgress - a.latestProgress)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Báo cáo Số liệu</h1>
        <p className="text-gray-600 mt-2">Thống kê và phân tích hiệu suất</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Overall Summary */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Tổng quan năm {selectedYear}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Tổng NV</p>
            <p className="text-2xl font-bold text-blue-600">{overallMetrics.totalTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Hoàn thành</p>
            <p className="text-2xl font-bold text-green-600">{overallMetrics.completedTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Đang làm</p>
            <p className="text-2xl font-bold text-orange-600">{overallMetrics.inProgressTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Chưa bắt đầu</p>
            <p className="text-2xl font-bold text-gray-600">{overallMetrics.notStartedTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">TB Tiến độ</p>
            <p className="text-2xl font-bold text-blue-600">{overallMetrics.avgProgress}%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Tổng tuần</p>
            <p className="text-2xl font-bold text-purple-600">{overallMetrics.totalWeeks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">TB/NV</p>
            <p className="text-2xl font-bold text-indigo-600">{overallMetrics.avgWeeksPerTask} tuần</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Tỉ lệ HT</p>
            <p className="text-2xl font-bold text-green-600">{overallMetrics.completionRate}%</p>
          </div>
        </div>
      </div>

      {/* Department Metrics Table */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Chi tiết theo phòng ban</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phòng ban
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng NV
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hoàn thành
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Đang làm
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chưa bắt đầu
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TB Tiến độ
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng tuần
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tỉ lệ HT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayMetrics.map((metric) => (
                <tr key={metric.department.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {metric.department.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                    {metric.totalTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-semibold">
                    {metric.completedTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-orange-600 font-semibold">
                    {metric.inProgressTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                    {metric.notStartedTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <span className="font-bold text-blue-600">{metric.avgProgress}%</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-purple-600">
                    {metric.totalWeeks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${metric.completionRate}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-green-600">{metric.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {displayMetrics.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              Không có dữ liệu
            </div>
          )}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Phân tích theo tháng</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tháng
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NV có hoạt động
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hoàn thành
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TB Tiến độ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Biểu đồ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyMetrics.map((metric) => (
                <tr key={metric.month} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {metric.month}/{selectedYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                    {metric.tasksStarted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-semibold">
                    {metric.tasksCompleted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                    {metric.avgProgress}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-48 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all"
                          style={{ width: `${metric.avgProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Departments */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Top 5 Phòng ban xuất sắc</h2>
          <div className="space-y-3">
            {topPerformingDepts.map((dept, index) => (
              <div key={dept.department.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' :
                  'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{dept.department.name}</p>
                  <p className="text-sm text-gray-600">
                    {dept.completedTasks}/{dept.totalTasks} nhiệm vụ
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">{dept.completionRate}%</p>
                  <p className="text-xs text-gray-500">hoàn thành</p>
                </div>
              </div>
            ))}
            {topPerformingDepts.length === 0 && (
              <p className="text-center text-gray-500 py-4">Chưa có dữ liệu</p>
            )}
          </div>
        </div>

        {/* Top Tasks by Progress */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Top 5 Nhiệm vụ tiến độ cao</h2>
          <div className="space-y-3">
            {topTasksByProgress.map((task, index) => (
              <div key={task.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-orange-600' :
                  'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{task.name}</p>
                  <p className="text-sm text-gray-600">{task.department.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{task.latestProgress}%</p>
                  <p className="text-xs text-gray-500">{task.weekCount} tuần</p>
                </div>
              </div>
            ))}
            {topTasksByProgress.length === 0 && (
              <p className="text-center text-gray-500 py-4">Chưa có dữ liệu</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
