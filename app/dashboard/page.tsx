'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'COMPLETED';
  reportFileUrl: string | null;
  departmentCount: number;
  taskCount: number;
}

interface Department {
  id: string;
  name: string;
  _count?: {
    masterTasks: number;
  };
}

interface MasterTask {
  id: string;
  name: string;
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  department: {
    name: string;
  };
}

interface Stats {
  totalDepartments: number;
  totalMasterTasks: number;
  tasksInProgress: number;
  tasksCompleted: number;
  recentWeeks: Week[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [importantTasks, setImportantTasks] = useState<MasterTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [deptRes, tasksRes, weeksRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/master-tasks'),
        fetch('/api/weeks'),
      ]);

      if (deptRes.ok && tasksRes.ok && weeksRes.ok) {
        const departments: Department[] = await deptRes.json();
        const masterTasks: MasterTask[] = await tasksRes.json();
        const weeks: Week[] = await weeksRes.json();

        const tasksInProgress = masterTasks.filter(
          (t) => !t.isCompleted && t.weekCount > 0
        ).length;
        const tasksCompleted = masterTasks.filter((t) => t.isCompleted).length;

        setStats({
          totalDepartments: departments.length,
          totalMasterTasks: masterTasks.length,
          tasksInProgress,
          tasksCompleted,
          recentWeeks: weeks.slice(0, 6),
        });

        // Get important ongoing tasks
        const important = masterTasks
          .filter((t) => !t.isCompleted && t.weekCount > 0)
          .sort((a, b) => b.latestProgress - a.latestProgress)
          .slice(0, 5);
        setImportantTasks(important);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Tổng quan</h1>
        <p className="text-gray-600 mt-2">Theo dõi tiến độ công việc toàn bộ hệ thống</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Tổng số phòng</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalDepartments}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">NV Thường kỳ</p>
              <p className="text-3xl font-bold text-purple-600">{stats.totalMasterTasks}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Đang thực hiện</p>
              <p className="text-3xl font-bold text-orange-600">{stats.tasksInProgress}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Đã hoàn thành</p>
              <p className="text-3xl font-bold text-green-600">{stats.tasksCompleted}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Important Tasks */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Nhiệm vụ đang thực hiện</h2>
            <Link
              href="/dashboard/tasks"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Xem tất cả →
            </Link>
          </div>

          {importantTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Chưa có nhiệm vụ nào đang thực hiện
            </p>
          ) : (
            <div className="space-y-3">
              {importantTasks.map((task) => (
                <div
                  key={task.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{task.name}</h3>
                      <p className="text-sm text-gray-600">{task.department.name}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {task.latestProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${task.latestProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {task.weekCount} tuần đã làm
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Thao tác nhanh</h2>
          <div className="space-y-3">
            <Link
              href="/dashboard/weeks/new"
              className="block w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center font-medium"
            >
              + Tạo báo cáo tuần mới
            </Link>
            <Link
              href="/dashboard/tasks"
              className="block w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-center font-medium"
            >
              Quản lý nhiệm vụ
            </Link>
            <Link
              href="/dashboard/departments"
              className="block w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 text-center font-medium"
            >
              Quản lý phòng ban
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Tiến độ tổng quan</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Hoàn thành</span>
                <span className="font-semibold text-green-600">
                  {stats.totalMasterTasks > 0
                    ? Math.round((stats.tasksCompleted / stats.totalMasterTasks) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${
                      stats.totalMasterTasks > 0
                        ? (stats.tasksCompleted / stats.totalMasterTasks) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Weeks */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Báo cáo tuần gần đây</h2>
          <Link
            href="/dashboard/weeks"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Xem tất cả →
          </Link>
        </div>

        {stats.recentWeeks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Chưa có báo cáo nào</p>
            <Link
              href="/dashboard/weeks/new"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Tạo báo cáo đầu tiên
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.recentWeeks.map((week) => (
              <Link
                key={week.id}
                href={`/dashboard/weeks/${week.id}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:border-blue-300 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">
                    Tuần {week.weekNumber}/{week.year}
                  </h3>
                  {week.status === 'COMPLETED' ? (
                    <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                      Hoàn thành
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded">
                      Nháp
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {format(new Date(week.startDate), 'd/M', { locale: vi })} -{' '}
                  {format(new Date(week.endDate), 'd/M/yyyy', { locale: vi })}
                </p>
                <div className="flex gap-4 text-sm text-gray-700">
                  <span>{week.departmentCount} phòng</span>
                  <span>{week.taskCount} nhiệm vụ</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
