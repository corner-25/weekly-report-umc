'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Department {
  id: string;
  name: string;
}

interface MasterTask {
  id: string;
  name: string;
  description: string | null;
  department: Department;
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  estimatedDuration: number | null;
  createdAt: string;
}

interface WeekProgress {
  weekNumber: number;
  year: number;
  progress: number;
  result: string;
  startDate: string;
}

interface TaskDetail extends MasterTask {
  weeklyProgress: WeekProgress[];
  firstWeek?: { weekNumber: number; year: number };
  lastWeek?: { weekNumber: number; year: number };
}

type GroupBy = 'task' | 'department';

export default function TasksOverview() {
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('task');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

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

        console.log('Tasks Overview - Fetched data:', {
          tasksCount: tasksData.length,
          departmentsCount: deptsData.length,
          tasks: tasksData,
        });

        setTasks(tasksData);
        setDepartments(deptsData);
      } else {
        console.error('API error:', {
          tasksStatus: tasksRes.status,
          deptsStatus: deptsRes.status,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const filteredTasks = selectedDept === 'all'
    ? tasks
    : tasks.filter(t => t.department.id === selectedDept);

  const groupedData = () => {
    if (groupBy === 'task') {
      return filteredTasks.map(task => ({
        key: task.id,
        name: task.name,
        items: [task],
      }));
    } else {
      // Group by department
      const grouped: { [key: string]: TaskDetail[] } = {};
      filteredTasks.forEach(task => {
        const deptId = task.department.id;
        if (!grouped[deptId]) {
          grouped[deptId] = [];
        }
        grouped[deptId].push(task);
      });

      return Object.entries(grouped).map(([deptId, items]) => ({
        key: deptId,
        name: items[0].department.name,
        items,
      }));
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Tổng hợp Nhiệm vụ</h1>
        <p className="text-gray-600 mt-2">Xem tiến độ tất cả nhiệm vụ theo thời gian</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nhóm theo
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setGroupBy('task')}
                className={`px-4 py-2 rounded-md ${
                  groupBy === 'task'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Nhiệm vụ
              </button>
              <button
                onClick={() => setGroupBy('department')}
                className={`px-4 py-2 rounded-md ${
                  groupBy === 'department'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Phòng ban
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lọc theo phòng
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Tổng nhiệm vụ</p>
          <p className="text-2xl font-bold text-blue-600">{filteredTasks.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Đang thực hiện</p>
          <p className="text-2xl font-bold text-orange-600">
            {filteredTasks.filter(t => !t.isCompleted && t.weekCount > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Hoàn thành</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredTasks.filter(t => t.isCompleted).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Chưa bắt đầu</p>
          <p className="text-2xl font-bold text-gray-600">
            {filteredTasks.filter(t => t.weekCount === 0).length}
          </p>
        </div>
      </div>

      {/* Grouped Tasks */}
      <div className="space-y-4">
        {groupedData().map((group) => (
          <div key={group.key} className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{group.name}</h2>

              <div className="space-y-4">
                {group.items.map((task) => {
                  const isExpanded = expandedTasks.has(task.id);

                  return (
                    <div key={task.id} className="border-2 border-gray-200 rounded-lg p-4">
                      {/* Task Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg">{task.name}</h3>
                            {task.isCompleted ? (
                              <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                                Hoàn thành
                              </span>
                            ) : task.weekCount > 0 ? (
                              <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded">
                                Đang thực hiện
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 rounded">
                                Chưa bắt đầu
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            Phòng: {task.department.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600">
                            {task.latestProgress}%
                          </div>
                          <p className="text-xs text-gray-500">{task.weekCount} tuần</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${getProgressColor(task.latestProgress)}`}
                            style={{ width: `${task.latestProgress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Timeline Info */}
                      {task.weekCount > 0 && task.firstWeek && task.lastWeek && (
                        <div className="flex gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-semibold">Bắt đầu:</span> Tuần {task.firstWeek.weekNumber}/{task.firstWeek.year}
                          </div>
                          <div>
                            <span className="font-semibold">Cập nhật gần nhất:</span> Tuần {task.lastWeek.weekNumber}/{task.lastWeek.year}
                          </div>
                          {task.estimatedDuration && (
                            <div>
                              <span className="font-semibold">Dự kiến:</span> {task.estimatedDuration} tuần
                            </div>
                          )}
                        </div>
                      )}

                      {/* Weekly Progress Details */}
                      {task.weeklyProgress && task.weeklyProgress.length > 0 && (
                        <>
                          <button
                            onClick={() => toggleExpand(task.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {isExpanded ? '▲ Thu gọn' : '▼ Xem chi tiết tiến độ từng tuần'}
                          </button>

                          {isExpanded && (
                            <div className="mt-4 border-t pt-4">
                              <h4 className="font-semibold mb-3">Lịch sử tiến độ:</h4>
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {task.weeklyProgress.map((week, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                                  >
                                    <div className="w-32 flex-shrink-0">
                                      <p className="font-semibold text-sm">
                                        Tuần {week.weekNumber}/{week.year}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {format(new Date(week.startDate), 'dd/MM/yyyy', { locale: vi })}
                                      </p>
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${getProgressColor(week.progress)}`}
                                            style={{ width: `${week.progress}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-sm font-semibold w-12 text-right">
                                          {week.progress}%
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 line-clamp-2">{week.result}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có nhiệm vụ nào</h3>
              <p className="text-gray-500 mb-4">
                Hãy tạo nhiệm vụ thường kỳ và báo cáo tuần để xem tổng hợp ở đây
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
        )}
      </div>
    </div>
  );
}
