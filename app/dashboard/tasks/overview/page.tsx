'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { BarChart3, LayoutList, LayoutGrid, Search, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMasterTasksWithProgress, useDepartments } from '@/lib/swr';

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

interface TaskDetail {
  id: string;
  name: string;
  description: string | null;
  department: Department;
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  estimatedDuration: number | null;
  createdAt: string;
  weeklyProgress: WeekProgress[];
  firstWeek?: { weekNumber: number; year: number };
  lastWeek?: { weekNumber: number; year: number };
}

type ViewMode = 'list' | 'kanban';
type StatusFilter = 'all' | 'in_progress' | 'completed' | 'not_started';
const VIEW_KEY = 'tasks.overview.viewMode';

function getStatus(t: TaskDetail): 'completed' | 'in_progress' | 'not_started' {
  if (t.isCompleted) return 'completed';
  if (t.weekCount > 0) return 'in_progress';
  return 'not_started';
}

function getProgressColor(progress: number) {
  if (progress >= 100) return 'bg-emerald-500';
  if (progress >= 75) return 'bg-blue-500';
  if (progress >= 50) return 'bg-yellow-500';
  if (progress >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function StatusBadge({ status }: { status: 'completed' | 'in_progress' | 'not_started' }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> Hoàn thành
    </span>
  );
  if (status === 'in_progress') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      <Clock className="w-3 h-3" /> Đang làm
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Circle className="w-3 h-3" /> Chưa bắt đầu
    </span>
  );
}

function TaskRow({ task, expanded, onToggle }: { task: TaskDetail; expanded: boolean; onToggle: () => void }) {
  const status = getStatus(task);
  const hasHistory = task.weeklyProgress && task.weeklyProgress.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap mb-1.5">
              <h3 className="font-semibold text-slate-900 text-sm leading-snug">{task.name}</h3>
              <StatusBadge status={status} />
            </div>
            {task.description && (
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span className="font-medium text-slate-600">{task.department.name}</span>
              {task.weekCount > 0 && task.firstWeek && task.lastWeek && (
                <>
                  <span>•</span>
                  <span>Tuần {task.firstWeek.weekNumber}/{task.firstWeek.year} → {task.lastWeek.weekNumber}/{task.lastWeek.year}</span>
                </>
              )}
              {task.estimatedDuration && (
                <>
                  <span>•</span>
                  <span>Dự kiến {task.estimatedDuration} tuần</span>
                </>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className={`text-2xl font-bold ${task.isCompleted ? 'text-emerald-600' : task.latestProgress > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
              {task.latestProgress}%
            </div>
            <div className="text-[10px] text-slate-500">{task.weekCount} tuần</div>
          </div>
        </div>

        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getProgressColor(task.latestProgress)}`}
            style={{ width: `${task.latestProgress}%` }}
          />
        </div>

        {hasHistory && (
          <button
            onClick={onToggle}
            className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? 'Thu gọn' : `Xem ${task.weeklyProgress.length} tuần đã cập nhật`}
          </button>
        )}
      </div>

      {expanded && hasHistory && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-2 max-h-96 overflow-y-auto">
          {[...task.weeklyProgress].reverse().map((week, idx) => (
            <div key={`${week.year}-${week.weekNumber}-${idx}`} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-slate-900">
                    Tuần {week.weekNumber}/{week.year}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {format(new Date(week.startDate), 'dd/MM/yyyy', { locale: vi })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getProgressColor(week.progress)}`}
                      style={{ width: `${week.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">{week.progress}%</span>
                </div>
              </div>
              {week.result && (
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{week.result}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanCard({ task, onClick }: { task: TaskDetail; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md hover:border-cyan-300 transition-all"
    >
      <h4 className="font-medium text-sm text-slate-900 line-clamp-2 leading-snug mb-2">{task.name}</h4>
      <p className="text-[11px] text-slate-500 mb-2 line-clamp-1">{task.department.name}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${getProgressColor(task.latestProgress)}`}
            style={{ width: `${task.latestProgress}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-700">{task.latestProgress}%</span>
      </div>
      {task.weekCount > 0 && (
        <p className="text-[10px] text-slate-400 mt-1.5">{task.weekCount} tuần đã cập nhật</p>
      )}
    </button>
  );
}

export default function TasksOverview() {
  const { data: tasksData, isLoading: loadingTasks } = useMasterTasksWithProgress();
  const { data: deptsData, isLoading: loadingDepts } = useDepartments();
  const tasks: TaskDetail[] = tasksData || [];
  const departments: Department[] = deptsData || [];

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupByDept, setGroupByDept] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<TaskDetail | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (saved === 'list' || saved === 'kanban') setViewMode(saved);
    }
  }, []);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_KEY, mode);
  };

  const toggleExpand = (taskId: string) => {
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
    setExpandedTasks(next);
  };

  const toggleDept = (deptId: string) => {
    const next = new Set(collapsedDepts);
    if (next.has(deptId)) next.delete(deptId); else next.add(deptId);
    setCollapsedDepts(next);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedDept !== 'all' && t.department.id !== selectedDept) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      const status = getStatus(t);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [tasks, selectedDept, search, statusFilter]);

  const stats = useMemo(() => ({
    total: filteredTasks.length,
    inProgress: filteredTasks.filter(t => !t.isCompleted && t.weekCount > 0).length,
    completed: filteredTasks.filter(t => t.isCompleted).length,
    notStarted: filteredTasks.filter(t => t.weekCount === 0).length,
  }), [filteredTasks]);

  const grouped = useMemo(() => {
    if (!groupByDept) return [{ key: 'all', name: '', items: filteredTasks }];
    const map = new Map<string, TaskDetail[]>();
    for (const t of filteredTasks) {
      const arr = map.get(t.department.id) || [];
      arr.push(t);
      map.set(t.department.id, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      name: items[0].department.name,
      items,
    }));
  }, [filteredTasks, groupByDept]);

  const kanbanCols = useMemo(() => {
    const cols = {
      not_started: filteredTasks.filter(t => getStatus(t) === 'not_started'),
      in_progress: filteredTasks.filter(t => getStatus(t) === 'in_progress'),
      completed: filteredTasks.filter(t => getStatus(t) === 'completed'),
    };
    cols.in_progress.sort((a, b) => b.latestProgress - a.latestProgress);
    return cols;
  }, [filteredTasks]);

  const loading = loadingTasks || loadingDepts;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Tổng hợp Nhiệm vụ"
        description="Theo dõi tiến độ tất cả nhiệm vụ thường kỳ qua các tuần"
        className="mb-6"
        actions={
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => changeView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white text-cyan-600 shadow-sm font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-4 h-4" /> Danh sách
            </button>
            <button
              onClick={() => changeView('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'kanban' ? 'bg-white text-cyan-600 shadow-sm font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
          <div className="text-xs text-slate-500 mb-1">Tổng nhiệm vụ</div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 border-l-blue-500 p-4">
          <div className="text-xs text-slate-500 mb-1">Đang làm</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 border-l-emerald-500 p-4">
          <div className="text-xs text-slate-500 mb-1">Hoàn thành</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 border-l-slate-400 p-4">
          <div className="text-xs text-slate-500 mb-1">Chưa bắt đầu</div>
          <div className="text-2xl font-bold text-slate-600">{stats.notStarted}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên nhiệm vụ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
          </div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="all">Tất cả phòng</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="in_progress">Đang làm</option>
            <option value="completed">Hoàn thành</option>
            <option value="not_started">Chưa bắt đầu</option>
          </select>
          {viewMode === 'list' && (
            <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={groupByDept}
                onChange={(e) => setGroupByDept(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              Nhóm theo phòng
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-base font-medium text-slate-700 mb-1">Không có nhiệm vụ nào</h3>
          <p className="text-sm text-slate-500 mb-4">Thử bỏ bộ lọc, hoặc tạo nhiệm vụ mới</p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/tasks" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-blue-700">
              Tạo nhiệm vụ
            </Link>
            <Link href="/dashboard/weeks/new" className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Tạo báo cáo tuần
            </Link>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { key: 'not_started' as const, title: 'Chưa bắt đầu', headerClass: 'bg-slate-100 text-slate-700' },
            { key: 'in_progress' as const, title: 'Đang làm', headerClass: 'bg-blue-50 text-blue-700' },
            { key: 'completed' as const, title: 'Hoàn thành', headerClass: 'bg-emerald-50 text-emerald-700' },
          ]).map((col) => (
            <div key={col.key} className="bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col">
              <div className={`flex items-center justify-between px-4 py-3 ${col.headerClass} rounded-t-xl border-b border-slate-200`}>
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-white/70 rounded-full">{kanbanCols[col.key].length}</span>
              </div>
              <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-380px)]">
                {kanbanCols[col.key].length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">Trống</div>
                ) : (
                  kanbanCols[col.key].map((t) => (
                    <KanbanCard key={t.id} task={t} onClick={() => setDetailTask(t)} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            const collapsed = groupByDept && collapsedDepts.has(group.key);
            return (
              <div key={group.key}>
                {groupByDept && (
                  <button
                    onClick={() => toggleDept(group.key)}
                    className="w-full flex items-center justify-between mb-2 px-1"
                  >
                    <div className="flex items-center gap-2">
                      {collapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      <h2 className="text-sm font-semibold text-slate-700">{group.name}</h2>
                      <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{group.items.length}</span>
                    </div>
                  </button>
                )}
                {!collapsed && (
                  <div className="space-y-2">
                    {group.items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        expanded={expandedTasks.has(task.id)}
                        onToggle={() => toggleExpand(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban detail modal */}
      {detailTask && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailTask(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={getStatus(detailTask)} />
                    <span className="text-xs text-slate-500">{detailTask.department.name}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{detailTask.name}</h2>
                </div>
                <button
                  onClick={() => setDetailTask(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(detailTask.latestProgress)}`}
                    style={{ width: `${detailTask.latestProgress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-700">{detailTask.latestProgress}%</span>
              </div>
            </div>
            <div className="p-5 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Lịch sử {detailTask.weeklyProgress.length} tuần</h3>
              {detailTask.weeklyProgress.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Chưa có cập nhật tuần nào</p>
              ) : (
                [...detailTask.weeklyProgress].reverse().map((week, idx) => (
                  <div key={`${week.year}-${week.weekNumber}-${idx}`} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">Tuần {week.weekNumber}/{week.year}</p>
                        <p className="text-[11px] text-slate-500">
                          {format(new Date(week.startDate), 'dd/MM/yyyy', { locale: vi })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${getProgressColor(week.progress)}`}
                            style={{ width: `${week.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700 w-10 text-right">{week.progress}%</span>
                      </div>
                    </div>
                    {week.result && (
                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{week.result}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
