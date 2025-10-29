'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Link from 'next/link';

interface Task {
  id: string;
  orderNumber: number;
  taskName?: string; // From old Task model (backward compatible)
  masterTask?: {
    name: string;
    description: string | null;
  };
  result: string;
  timePeriod: string;
  progress: number;
  nextWeekPlan: string;
  isImportant: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface TasksByDepartment {
  department: Department;
  tasks: Task[];
}

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: string;
  reportFileUrl: string | null;
  createdAt: string;
  tasksByDepartment: TasksByDepartment[];
}

export default function WeekDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [week, setWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWeek();
  }, [resolvedParams.id]);

  const fetchWeek = async () => {
    try {
      const response = await fetch(`/api/weeks/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setWeek(data);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching week:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy báo cáo</p>
      </div>
    );
  }

  const totalDepartments = week.tasksByDepartment.length;
  const totalTasks = week.tasksByDepartment.reduce((acc, dt) => acc + dt.tasks.length, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Quay lại
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Báo cáo Tuần {week.weekNumber}/{week.year}
            </h1>
            <p className="text-gray-600 mt-2">
              {format(new Date(week.startDate), 'dd/MM/yyyy', { locale: vi })} -{' '}
              {format(new Date(week.endDate), 'dd/MM/yyyy', { locale: vi })}
            </p>
          </div>
          <Link
            href={`/dashboard/weeks/${week.id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ✏️ Sửa
          </Link>
        </div>
      </div>

      {/* File biên bản */}
      {week.reportFileUrl && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">📄 File biên bản</h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
            <span className="text-gray-700">📎 {week.reportFileUrl.split('/').pop()}</span>
            <div className="flex gap-2">
              <a
                href={week.reportFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                👁️ Xem
              </a>
              <a
                href={week.reportFileUrl}
                download
                className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
              >
                ⬇️ Tải về
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tổng quan */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">📊 Tổng quan</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600 text-sm">Tổng số phòng</p>
            <p className="text-2xl font-bold text-blue-600">{totalDepartments}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Tổng số nhiệm vụ</p>
            <p className="text-2xl font-bold text-green-600">{totalTasks}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Ngày tạo</p>
            <p className="text-lg font-semibold">
              {format(new Date(week.createdAt), 'dd/MM/yyyy', { locale: vi })}
            </p>
          </div>
        </div>
      </div>

      {/* Danh sách phòng */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">🏢 Danh sách phòng & nhiệm vụ</h2>

        {week.tasksByDepartment.map((deptTask) => {
          const isExpanded = expandedDepts.has(deptTask.department.id);
          const importantTasks = deptTask.tasks.filter((t) => t.isImportant);

          return (
            <div key={deptTask.department.id} className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">📁 {deptTask.department.name}</h3>
                  <span className="text-sm text-gray-600">
                    📌 {deptTask.tasks.length} nhiệm vụ
                  </span>
                </div>

                {/* Important tasks preview */}
                {importantTasks.length > 0 && !isExpanded && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      ⭐ THÔNG TIN QUAN TRỌNG:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {importantTasks.slice(0, 3).map((task) => (
                        <li key={task.id}>{task.masterTask?.name || task.taskName}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Expanded tasks */}
                {isExpanded && (
                  <div className="space-y-4 mb-4">
                    {deptTask.tasks.map((task) => {
                      const isMasterTask = task.masterTask !== undefined && task.masterTask !== null;
                      const isAdHoc = task.taskName !== undefined && !isMasterTask;

                      return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-lg border-2 ${
                          task.isImportant
                            ? 'bg-yellow-50 border-yellow-200'
                            : isMasterTask
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {task.isImportant && <span className="text-xl">⭐</span>}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900">
                                {task.orderNumber}. {task.masterTask?.name || task.taskName}
                              </p>
                              {isMasterTask && (
                                <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded">
                                  Dài hạn
                                </span>
                              )}
                              {isAdHoc && (
                                <span className="px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-100 rounded">
                                  Ngắn hạn
                                </span>
                              )}
                            </div>
                            {task.masterTask?.description && (
                              <p className="text-xs text-gray-500 mt-1">{task.masterTask.description}</p>
                            )}
                            <div className="mt-2 space-y-2 text-sm text-gray-700">
                              <div>
                                <span className="font-semibold">Kết quả:</span> {task.result}
                              </div>
                              <div>
                                <span className="font-semibold">Thời gian:</span> {task.timePeriod}
                              </div>
                              <div>
                                <span className="font-semibold">Tiến độ:</span>
                                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${task.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs">{task.progress}%</span>
                              </div>
                              <div>
                                <span className="font-semibold">Kế hoạch tuần sau:</span>{' '}
                                {task.nextWeekPlan}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Toggle button */}
                <button
                  onClick={() => toggleDepartment(deptTask.department.id)}
                  className="w-full py-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isExpanded ? '▲ Thu gọn' : `▼ Xem tất cả ${deptTask.tasks.length} nhiệm vụ`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
