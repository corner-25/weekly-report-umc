'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, startOfYear, endOfYear, eachWeekOfInterval, getWeek, getYear } from 'date-fns';
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
  firstWeek?: { weekNumber: number; year: number };
  lastWeek?: { weekNumber: number; year: number };
  latestProgress: number;
  isCompleted: boolean;
}

export default function TimelinePage() {
  // Fixed: Added null checks for weeklyProgress to prevent undefined errors
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'quarters' | 'all'>('quarters');

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

        console.log('Timeline - Fetched data:', {
          tasksCount: tasksData.length,
          departmentsCount: deptsData.length,
          tasks: tasksData,
        });

        setTasks(tasksData);
        setDepartments(deptsData);
      } else {
        console.error('Timeline - API error:', {
          tasksStatus: tasksRes.status,
          deptsStatus: deptsRes.status,
        });
      }
    } catch (error) {
      console.error('Timeline - Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (selectedDept !== 'all' && task.department.id !== selectedDept) return false;

    // Filter by year - show tasks that have progress in selected year
    // Safety check: weeklyProgress might be undefined if task has no progress yet
    const weeklyProgress = task.weeklyProgress || [];
    const hasProgressInYear = weeklyProgress.some(wp => wp.year === selectedYear);
    return hasProgressInYear || weeklyProgress.length === 0;
  });

  // Group by department
  const groupedByDepartment = filteredTasks.reduce((acc, task) => {
    const deptId = task.department.id;
    if (!acc[deptId]) {
      acc[deptId] = {
        department: task.department,
        tasks: [],
      };
    }
    acc[deptId].tasks.push(task);
    return acc;
  }, {} as Record<string, { department: Department; tasks: MasterTask[] }>);

  // Generate weeks for the timeline
  const yearStart = startOfYear(new Date(selectedYear, 0, 1));
  const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
  const allWeeks = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 });

  const weeks = allWeeks.map(weekStart => ({
    weekNumber: getWeek(weekStart, { weekStartsOn: 1 }),
    date: weekStart,
  }));

  // Get quarters
  const quarters = [
    { name: 'Q1', weeks: weeks.filter(w => w.weekNumber >= 1 && w.weekNumber <= 13) },
    { name: 'Q2', weeks: weeks.filter(w => w.weekNumber >= 14 && w.weekNumber <= 26) },
    { name: 'Q3', weeks: weeks.filter(w => w.weekNumber >= 27 && w.weekNumber <= 39) },
    { name: 'Q4', weeks: weeks.filter(w => w.weekNumber >= 40 && w.weekNumber <= 53) },
  ];

  const displayWeeks = viewMode === 'quarters'
    ? weeks.filter(w => w.weekNumber % 4 === 1) // Show every 4th week
    : weeks;

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressForWeek = (task: MasterTask, weekNumber: number): WeekProgress | null => {
    const weeklyProgress = task.weeklyProgress || [];
    return weeklyProgress.find(wp => wp.weekNumber === weekNumber && wp.year === selectedYear) || null;
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
        <h1 className="text-3xl font-bold text-gray-900">Timeline Nhiệm vụ</h1>
        <p className="text-gray-600 mt-2">Xem tiến độ nhiệm vụ theo thời gian</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chế độ xem
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('quarters')}
                className={`flex-1 px-4 py-2 rounded-md ${
                  viewMode === 'quarters'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Theo quý
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 px-4 py-2 rounded-md ${
                  viewMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tất cả tuần
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="font-semibold mb-3">Chú thích màu sắc:</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>100%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>75-99%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>50-74%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>25-49%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>0-24%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 rounded border border-gray-300"></div>
            <span>Chưa có dữ liệu</span>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="min-w-max">
          {/* Header - Week numbers */}
          <div className="flex border-b border-gray-300 bg-gray-50 sticky top-0 z-10">
            <div className="w-80 flex-shrink-0 p-4 font-bold border-r border-gray-300">
              Nhiệm vụ / Tuần
            </div>
            {displayWeeks.map((week, weekIndex) => (
              <div
                key={`header-${week.weekNumber}-${weekIndex}`}
                className="w-16 flex-shrink-0 p-2 text-center text-xs font-semibold border-r border-gray-200"
              >
                <div>T{week.weekNumber}</div>
                <div className="text-gray-500">
                  {format(week.date, 'd/M')}
                </div>
              </div>
            ))}
          </div>

          {/* Body - Tasks by department */}
          {Object.values(groupedByDepartment).length === 0 ? (
            <div className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu timeline</h3>
                <p className="text-gray-500 mb-4">
                  Tạo nhiệm vụ thường kỳ và cập nhật tiến độ qua các tuần để xem timeline
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/dashboard/tasks"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Tạo nhiệm vụ thường kỳ
                  </Link>
                  <Link
                    href="/dashboard/weeks/new"
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                  >
                    Tạo báo cáo tuần
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            Object.values(groupedByDepartment).map(({ department, tasks }) => (
              <div key={department.id} className="border-b border-gray-200">
                {/* Department Header */}
                <div className="flex bg-blue-50 border-t-2 border-blue-300">
                  <div className="w-80 flex-shrink-0 p-3 font-bold text-blue-900 border-r border-gray-300">
                    {department.name}
                  </div>
                  <div className="flex-1"></div>
                </div>

                {/* Tasks in this department */}
                {tasks.map((task) => (
                  <div key={task.id} className="flex hover:bg-gray-50 border-b border-gray-100">
                    {/* Task Name */}
                    <div className="w-80 flex-shrink-0 p-3 border-r border-gray-300">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{task.name}</div>
                        {task.isCompleted && (
                          <span className="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded">
                            Hoàn thành
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Tiến độ: {task.latestProgress}%
                      </div>
                    </div>

                    {/* Timeline cells */}
                    {displayWeeks.map((week, weekIndex) => {
                      const progress = getProgressForWeek(task, week.weekNumber);

                      return (
                        <div
                          key={`${task.id}-week-${week.weekNumber}-${weekIndex}`}
                          className="w-16 flex-shrink-0 p-1 border-r border-gray-200 relative group"
                          title={progress ? `Tuần ${week.weekNumber}: ${progress.progress}% - ${progress.result}` : ''}
                        >
                          {progress ? (
                            <div className="relative h-full flex items-center justify-center">
                              <div
                                className={`w-12 h-8 rounded ${getProgressColor(progress.progress)} flex items-center justify-center text-white text-xs font-bold cursor-pointer`}
                              >
                                {progress.progress}%
                              </div>

                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                                <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 max-w-xs whitespace-normal">
                                  <p className="font-semibold">Tuần {week.weekNumber}/{selectedYear}</p>
                                  <p className="mt-1">Tiến độ: {progress.progress}%</p>
                                  <p className="mt-1 line-clamp-3">{progress.result}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-8 bg-gray-100 rounded"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quarter Summary (only in quarters mode) */}
      {viewMode === 'quarters' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {quarters.map((quarter) => {
            const quarterTasks = filteredTasks.filter(task => {
              const weeklyProgress = task.weeklyProgress || [];
              return weeklyProgress.some(wp =>
                quarter.weeks.some(w => w.weekNumber === wp.weekNumber && wp.year === selectedYear)
              );
            });

            const avgProgress = quarterTasks.length > 0
              ? Math.round(
                  quarterTasks.reduce((sum, task) => {
                    const weeklyProgress = task.weeklyProgress || [];
                    const quarterProgress = weeklyProgress.filter(wp =>
                      quarter.weeks.some(w => w.weekNumber === wp.weekNumber && wp.year === selectedYear)
                    );
                    const avg = quarterProgress.length > 0
                      ? quarterProgress.reduce((s, p) => s + p.progress, 0) / quarterProgress.length
                      : 0;
                    return sum + avg;
                  }, 0) / quarterTasks.length
                )
              : 0;

            return (
              <div key={quarter.name} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold text-lg mb-2">{quarter.name}</h3>
                <p className="text-sm text-gray-600">
                  Tuần {quarter.weeks[0]?.weekNumber} - {quarter.weeks[quarter.weeks.length - 1]?.weekNumber}
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-2">{avgProgress}%</p>
                <p className="text-xs text-gray-500 mt-1">{quarterTasks.length} nhiệm vụ</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
