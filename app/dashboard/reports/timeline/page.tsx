'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, startOfYear, endOfYear, eachWeekOfInterval, getWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TrendingUp, GanttChart, Grid3x3 } from 'lucide-react';
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

type ViewMode = 'gantt' | 'grid';
const VIEW_KEY = 'reports.timeline.viewMode';

function getProgressColor(progress: number) {
  if (progress >= 100) return 'bg-emerald-500';
  if (progress >= 75) return 'bg-blue-500';
  if (progress >= 50) return 'bg-yellow-500';
  if (progress >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function getBarColor(task: MasterTask): string {
  if (task.isCompleted) return 'bg-emerald-500';
  if (task.latestProgress >= 75) return 'bg-blue-500';
  if (task.latestProgress >= 50) return 'bg-yellow-500';
  if (task.latestProgress >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function TimelinePage() {
  const { data: tasksData, isLoading: loadingTasks } = useMasterTasksWithProgress();
  const { data: deptsData, isLoading: loadingDepts } = useDepartments();
  const tasks: MasterTask[] = tasksData || [];
  const departments: Department[] = deptsData || [];

  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [hoverWeek, setHoverWeek] = useState<{ taskId: string; week: WeekProgress } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (saved === 'gantt' || saved === 'grid') setViewMode(saved);
    }
  }, []);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_KEY, mode);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (selectedDept !== 'all' && task.department.id !== selectedDept) return false;
      const wp = task.weeklyProgress || [];
      const hasProgressInYear = wp.some(p => p.year === selectedYear);
      return hasProgressInYear;
    });
  }, [tasks, selectedDept, selectedYear]);

  const groupedByDept = useMemo(() => {
    const map = new Map<string, { department: Department; tasks: MasterTask[] }>();
    for (const task of filteredTasks) {
      const existing = map.get(task.department.id);
      if (existing) existing.tasks.push(task);
      else map.set(task.department.id, { department: task.department, tasks: [task] });
    }
    return Array.from(map.values());
  }, [filteredTasks]);

  // 53 weeks for the year
  const allWeeks = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    const weekStarts = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 });
    return weekStarts.map(d => ({ weekNumber: getWeek(d, { weekStartsOn: 1 }), date: d }));
  }, [selectedYear]);

  const totalWeeks = allWeeks.length;
  const today = new Date();
  const currentWeek = today.getFullYear() === selectedYear ? getWeek(today, { weekStartsOn: 1 }) : -1;

  const loading = loadingTasks || loadingDepts;

  return (
    <div className="max-w-full mx-auto">
      <PageHeader
        icon={TrendingUp}
        title="Timeline Nhiệm vụ"
        description="Theo dõi tiến độ nhiệm vụ qua các tuần trong năm"
        className="mb-6"
        actions={
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => changeView('gantt')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'gantt' ? 'bg-white text-cyan-600 shadow-sm font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GanttChart className="w-4 h-4" /> Gantt
            </button>
            <button
              onClick={() => changeView('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                viewMode === 'grid' ? 'bg-white text-cyan-600 shadow-sm font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid3x3 className="w-4 h-4" /> Lưới tuần
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="all">Tất cả phòng</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Hoàn thành</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 75%+</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 50%+</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 25%+</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> &lt;25%</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : groupedByDept.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-medium text-slate-700 mb-1">Chưa có dữ liệu cho năm {selectedYear}</h3>
          <p className="text-sm text-slate-500 mb-4">Tạo báo cáo tuần để hiển thị timeline</p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/tasks" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-blue-700">
              Tạo nhiệm vụ
            </Link>
            <Link href="/dashboard/weeks/new" className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              Tạo báo cáo tuần
            </Link>
          </div>
        </div>
      ) : viewMode === 'gantt' ? (
        // ─── GANTT VIEW ─────────────────────────────
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* Header: quarters + week markers */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="w-72 flex-shrink-0 px-4 py-3 text-xs font-semibold text-slate-600 border-r border-slate-200">
                  Nhiệm vụ
                </div>
                <div className="flex-1 relative h-12">
                  {/* Quarter labels */}
                  {[
                    { name: 'Q1', startWeek: 1, endWeek: 13 },
                    { name: 'Q2', startWeek: 14, endWeek: 26 },
                    { name: 'Q3', startWeek: 27, endWeek: 39 },
                    { name: 'Q4', startWeek: 40, endWeek: totalWeeks },
                  ].map((q) => {
                    const left = ((q.startWeek - 1) / totalWeeks) * 100;
                    const width = ((q.endWeek - q.startWeek + 1) / totalWeeks) * 100;
                    return (
                      <div
                        key={q.name}
                        className="absolute top-0 h-6 border-l border-slate-200 px-2 text-xs font-medium text-slate-500 flex items-center"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        {q.name}
                      </div>
                    );
                  })}
                  {/* Week numbers */}
                  {allWeeks.filter((_, i) => i % 4 === 0).map((w) => {
                    const left = ((w.weekNumber - 1) / totalWeeks) * 100;
                    return (
                      <div
                        key={w.weekNumber}
                        className="absolute bottom-0 h-6 text-[10px] text-slate-400 px-1 border-l border-slate-100 flex items-end pb-1"
                        style={{ left: `${left}%` }}
                      >
                        T{w.weekNumber}
                      </div>
                    );
                  })}
                  {/* Today line */}
                  {currentWeek > 0 && (
                    <div
                      className="absolute top-0 bottom-0 border-l-2 border-cyan-500 z-10"
                      style={{ left: `${((currentWeek - 0.5) / totalWeeks) * 100}%` }}
                    >
                      <span className="absolute -top-0.5 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-medium bg-cyan-500 text-white rounded whitespace-nowrap">
                        T{currentWeek}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Body: department groups */}
              {groupedByDept.map(({ department, tasks }) => (
                <div key={department.id}>
                  <div className="bg-slate-50/70 border-b border-slate-200">
                    <div className="px-4 py-2 text-sm font-semibold text-slate-700">
                      {department.name} <span className="text-xs font-normal text-slate-500">({tasks.length})</span>
                    </div>
                  </div>
                  {tasks.map((task) => {
                    const wp = (task.weeklyProgress || []).filter(p => p.year === selectedYear);
                    if (wp.length === 0) return null;
                    const minWeek = Math.min(...wp.map(p => p.weekNumber));
                    const maxWeek = Math.max(...wp.map(p => p.weekNumber));
                    const leftPct = ((minWeek - 1) / totalWeeks) * 100;
                    const widthPct = ((maxWeek - minWeek + 1) / totalWeeks) * 100;

                    return (
                      <div key={task.id} className="flex border-b border-slate-100 hover:bg-slate-50/50 group">
                        <div className="w-72 flex-shrink-0 px-4 py-3 border-r border-slate-200">
                          <p className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">{task.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {wp.length} tuần • {task.latestProgress}%
                          </p>
                        </div>
                        <div className="flex-1 relative h-14">
                          {/* Quarter dividers */}
                          {[14, 27, 40].map((w) => (
                            <div key={w} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${((w - 1) / totalWeeks) * 100}%` }} />
                          ))}
                          {currentWeek > 0 && (
                            <div className="absolute top-0 bottom-0 border-l-2 border-cyan-500/40 z-10" style={{ left: `${((currentWeek - 0.5) / totalWeeks) * 100}%` }} />
                          )}
                          {/* Range bar */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-7 ${getBarColor(task)} rounded-md opacity-30 group-hover:opacity-50 transition-opacity`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '8px' }}
                          />
                          {/* Week dots */}
                          {wp.map((p) => {
                            const left = ((p.weekNumber - 0.5) / totalWeeks) * 100;
                            return (
                              <div
                                key={`${p.year}-${p.weekNumber}`}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                                style={{ left: `${left}%` }}
                                onMouseEnter={() => setHoverWeek({ taskId: task.id, week: p })}
                                onMouseLeave={() => setHoverWeek(null)}
                              >
                                <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow ${getProgressColor(p.progress)} cursor-pointer hover:scale-125 transition-transform`} />
                                {hoverWeek?.taskId === task.id && hoverWeek.week.weekNumber === p.weekNumber && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-72 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl">
                                    <p className="font-semibold mb-1">Tuần {p.weekNumber}/{p.year} — {p.progress}%</p>
                                    <p className="whitespace-pre-line line-clamp-6 text-slate-200 leading-relaxed">{p.result || '(không có nội dung)'}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ─── GRID VIEW (cũ, đã polish lại) ──────────
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-x-auto">
          <div className="min-w-max">
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="w-72 flex-shrink-0 px-4 py-3 text-xs font-semibold text-slate-600 border-r border-slate-200">
                Nhiệm vụ / Tuần
              </div>
              {allWeeks.map((week) => {
                const isCurrent = week.weekNumber === currentWeek;
                return (
                  <div
                    key={week.weekNumber}
                    className={`w-14 flex-shrink-0 px-1 py-2 text-center text-[11px] border-r border-slate-200 ${
                      isCurrent ? 'bg-cyan-50 text-cyan-700 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    <div>T{week.weekNumber}</div>
                    <div className="text-[10px] text-slate-400">{format(week.date, 'd/M')}</div>
                  </div>
                );
              })}
            </div>

            {groupedByDept.map(({ department, tasks }) => (
              <div key={department.id}>
                <div className="flex bg-slate-50/70 border-b border-slate-200">
                  <div className="w-72 flex-shrink-0 px-4 py-2 text-sm font-semibold text-slate-700 border-r border-slate-200">
                    {department.name} <span className="text-xs font-normal text-slate-500">({tasks.length})</span>
                  </div>
                </div>
                {tasks.map((task) => (
                  <div key={task.id} className="flex hover:bg-slate-50 border-b border-slate-100">
                    <div className="w-72 flex-shrink-0 px-4 py-2 border-r border-slate-200">
                      <p className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">{task.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{task.latestProgress}%{task.isCompleted && ' • Hoàn thành'}</p>
                    </div>
                    {allWeeks.map((week) => {
                      const wp = (task.weeklyProgress || []).find(p => p.weekNumber === week.weekNumber && p.year === selectedYear);
                      const isCurrent = week.weekNumber === currentWeek;
                      return (
                        <div
                          key={week.weekNumber}
                          className={`w-14 flex-shrink-0 p-1 border-r border-slate-100 relative group ${isCurrent ? 'bg-cyan-50/30' : ''}`}
                        >
                          {wp ? (
                            <>
                              <div className={`w-full h-7 rounded ${getProgressColor(wp.progress)} flex items-center justify-center text-white text-[10px] font-bold cursor-pointer`}>
                                {wp.progress}%
                              </div>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-72">
                                <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl">
                                  <p className="font-semibold mb-1">Tuần {week.weekNumber}/{selectedYear} — {wp.progress}%</p>
                                  <p className="whitespace-pre-line line-clamp-6 text-slate-200 leading-relaxed">{wp.result || '(không có nội dung)'}</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-7 bg-slate-50 rounded" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
