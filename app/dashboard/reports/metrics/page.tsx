'use client';

import { Select } from '@/components/ui/Select';
import type { ProgressMeaning, ProgressType } from '@prisma/client';
import {
  countsTowardProgressStats,
  countsTowardWeeklyCompletion,
  WEEKLY_DONE_THRESHOLD,
} from '@/lib/task-type';
import { useState } from 'react';
import { LineChart } from 'lucide-react';
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
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  estimatedDuration: number | null;
  createdAt: string;
  progressType?: ProgressType;
  progressMeaning?: ProgressMeaning;
  /** Tuần cuối nhiệm vụ này xuất hiện trong báo cáo. */
  lastSeenWeek?: number | null;
}

interface DepartmentMetrics {
  department: Department;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  avgProgress: number;
  /** Số nhiệm vụ thực sự có tiến độ đo được — mẫu số của avgProgress. */
  measurableTasks: number;
  /** % nhiệm vụ thường quy đã xong phần việc của tuần gần nhất. */
  weeklyDoneRate: number;
  /** Mẫu số của weeklyDoneRate. */
  weeklyTasks: number;
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
  const { data: tasksData, isLoading: tasksLoading } = useMasterTasksWithProgress();
  const { data: deptsData, isLoading: deptsLoading } = useDepartments();

  const tasks: MasterTask[] = tasksData || [];
  const departments: Department[] = deptsData || [];
  const loading = tasksLoading || deptsLoading;

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Filter tasks by year
  const filteredTasks = tasks.filter(task => {
    const weeklyProgress = task.weeklyProgress || [];
    const hasProgressInYear = weeklyProgress.some(wp => wp.year === selectedYear);
    const createdInYear = new Date(task.createdAt).getFullYear() === selectedYear;
    return hasProgressInYear || createdInYear || weeklyProgress.length === 0;
  });

  // Chỉ giữ phòng ban thật sự có nhiệm vụ.
  //
  // Hệ thống có 61 phòng ban nhưng chỉ 14 phòng nộp báo cáo tuần dạng này —
  // 47 khoa lâm sàng còn lại không có nhiệm vụ nào. Hiện chúng với toàn số 0
  // làm bảng dài gấp bốn lần mà không thêm thông tin gì.
  const activeDepartments = departments.filter((dept) =>
    filteredTasks.some((t) => t.department.id === dept.id),
  );

  /** Số tuần im ắng thì coi là nhiệm vụ có nguy cơ bị bỏ quên. */
  const STALE_WEEK_THRESHOLD = 6;

  // Tuần gần nhất có dữ liệu — mốc để đo mọi thứ khác.
  const latestWeek = filteredTasks.reduce((max, t) => {
    const last = t.weeklyProgress?.[t.weeklyProgress.length - 1]?.weekNumber ?? 0;
    return Math.max(max, last, t.lastSeenWeek ?? 0);
  }, 0);

  /**
   * Nhiệm vụ im ắng: có lịch sử nhưng đã lâu không xuất hiện trong báo cáo.
   *
   * Đây là thứ người quản lý cần biết — khác hẳn "chưa bắt đầu", vốn chỉ đếm
   * nhiệm vụ chưa có bản ghi nào và trên dữ liệu thật toàn là bản ghi mồ côi do
   * bước phân nhóm AI tạo ra rồi không gắn tiến độ.
   */
  const staleTasks = filteredTasks.filter((t) => {
    if (!t.lastSeenWeek || latestWeek === 0) return false;
    return latestWeek - t.lastSeenWeek >= STALE_WEEK_THRESHOLD;
  });

  /** Nhịp hoàn tất theo từng tuần, để thấy xu hướng thay vì một con số tĩnh. */
  const weeklyTrend = (() => {
    const byWeek = new Map<number, { done: number; total: number }>();
    for (const task of filteredTasks) {
      if (!countsTowardWeeklyCompletion(task.progressMeaning)) continue;
      for (const wp of task.weeklyProgress ?? []) {
        if (wp.year !== selectedYear) continue;
        const slot = byWeek.get(wp.weekNumber) ?? { done: 0, total: 0 };
        slot.total += 1;
        if (wp.progress >= WEEKLY_DONE_THRESHOLD) slot.done += 1;
        byWeek.set(wp.weekNumber, slot);
      }
    }
    return [...byWeek.entries()]
      .map(([weekNumber, v]) => ({
        weekNumber,
        rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
        done: v.done,
        total: v.total,
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber);
  })();

  // Tuần cuối thường đang nạp dở nên tỷ lệ chưa phản ánh đúng; lấy tuần trước đó
  // làm mốc "gần nhất" và so với trung bình 4 tuần trước nữa.
  const settledTrend = weeklyTrend.slice(0, -1);
  const currentRate = settledTrend[settledTrend.length - 1]?.rate ?? 0;
  const priorRates = settledTrend.slice(-5, -1).map((w) => w.rate);
  const priorAvg =
    priorRates.length > 0
      ? Math.round(priorRates.reduce((a, b) => a + b, 0) / priorRates.length)
      : currentRate;
  const rateDelta = currentRate - priorAvg;

  // Department-level metrics
  const departmentMetrics: DepartmentMetrics[] = activeDepartments.map(dept => {
    const deptTasks = filteredTasks.filter(t => t.department.id === dept.id);
    const completed = deptTasks.filter(t => t.isCompleted).length;
    const inProgress = deptTasks.filter(t => !t.isCompleted && t.weekCount > 0).length;
    const notStarted = deptTasks.filter(t => t.weekCount === 0).length;

    // Chỉ nhiệm vụ tích luỹ mới có tiến độ phản ánh mức hoàn thành thật.
    // Gộp cả nhiệm vụ thường quy (luôn 100%) và loại UNRELIABLE (5,5,5 hoặc
    // 2,4,6 = % thời gian trôi qua) làm con số trung bình vô nghĩa.
    const measurable = deptTasks.filter((t) => countsTowardProgressStats(t.progressType, t.progressMeaning));
    const totalProgress = measurable.reduce((sum, t) => sum + t.latestProgress, 0);
    const avgProgress = measurable.length > 0 ? Math.round(totalProgress / measurable.length) : 0;

    // Nhiệm vụ thường quy không có "% hoàn thành" — chúng chỉ xong hoặc chưa
    // xong phần việc của tuần. Đếm tỷ lệ xong thay vì lấy trung bình cộng.
    const weeklyTasksList = deptTasks.filter((t) => countsTowardWeeklyCompletion(t.progressMeaning));
    const weeklyDone = weeklyTasksList.filter((t) => t.latestProgress >= WEEKLY_DONE_THRESHOLD).length;
    const weeklyDoneRate =
      weeklyTasksList.length > 0 ? Math.round((weeklyDone / weeklyTasksList.length) * 100) : 0;

    const totalWeeks = deptTasks.reduce((sum, t) => sum + t.weekCount, 0);
    const completionRate = deptTasks.length > 0 ? Math.round((completed / deptTasks.length) * 100) : 0;

    return {
      department: dept,
      totalTasks: deptTasks.length,
      completedTasks: completed,
      inProgressTasks: inProgress,
      notStartedTasks: notStarted,
      avgProgress,
      measurableTasks: measurable.length,
      weeklyDoneRate,
      weeklyTasks: weeklyTasksList.length,
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
    avgProgress: (() => {
      const measurable = filteredTasks.filter((t) => countsTowardProgressStats(t.progressType, t.progressMeaning));
      return measurable.length > 0
        ? Math.round(measurable.reduce((sum, t) => sum + t.latestProgress, 0) / measurable.length)
        : 0;
    })(),
    measurableTasks: filteredTasks.filter((t) => countsTowardProgressStats(t.progressType, t.progressMeaning)).length,
    weeklyDoneRate: (() => {
      const weekly = filteredTasks.filter((t) => countsTowardWeeklyCompletion(t.progressMeaning));
      if (weekly.length === 0) return 0;
      const done = weekly.filter((t) => t.latestProgress >= WEEKLY_DONE_THRESHOLD).length;
      return Math.round((done / weekly.length) * 100);
    })(),
    weeklyTasks: filteredTasks.filter((t) => countsTowardWeeklyCompletion(t.progressMeaning)).length,
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

    // Chỉ đếm nhiệm vụ thường quy. Gộp cả loại MEANINGLESS (tuần nào cũng ghi
    // 100% dù công việc không "xong" được) sẽ đẩy con số lên ~90% một cách ảo.
    const weeklyTasksInMonth = monthTasks.filter((t) =>
      countsTowardWeeklyCompletion(t.progressMeaning),
    );
    let weekSlots = 0;
    let weekSlotsDone = 0;
    for (const t of weeklyTasksInMonth) {
      for (const wp of t.weeklyProgress || []) {
        const date = new Date(wp.startDate);
        if (date.getFullYear() !== selectedYear || date.getMonth() + 1 !== month) continue;
        weekSlots++;
        if (wp.progress >= WEEKLY_DONE_THRESHOLD) weekSlotsDone++;
      }
    }
    const avgProgress = weekSlots > 0 ? Math.round((weekSlotsDone / weekSlots) * 100) : 0;

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
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader icon={LineChart} title="Báo cáo Số liệu" description="Thống kê và phân tích hiệu suất" className="mb-6" />

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Năm
            </label>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phòng ban
            </label>
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="all">Tất cả phòng</option>
              {activeDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Tổng quan — bốn chỉ số trả lời bốn câu hỏi quản lý */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">Tổng quan năm {selectedYear}</h2>
        <p className="text-sm text-slate-500 mb-4">
          Số liệu tính đến tuần {latestWeek}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Công việc tuần có trôi không? */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <p className="text-sm text-slate-600">Hoàn tất tuần gần nhất</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {currentRate}%
              </span>
              {settledTrend.length > 1 && (
                <span
                  className={`text-sm font-medium ${
                    rateDelta > 2
                      ? 'text-emerald-600'
                      : rateDelta < -2
                        ? 'text-rose-600'
                        : 'text-slate-400'
                  }`}
                >
                  {rateDelta > 0 ? '↑' : rateDelta < 0 ? '↓' : '→'} {Math.abs(rateDelta)}đ
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              so với trung bình 4 tuần trước ({priorAvg}%)
            </p>
          </div>

          {/* 2. Có việc nào bị bỏ quên không? */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <p className="text-sm text-slate-600">Nhiệm vụ im ắng</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-3xl font-bold tabular-nums ${
                  staleTasks.length > 0 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {staleTasks.length}
              </span>
              <span className="text-sm text-slate-400">
                / {filteredTasks.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              không xuất hiện ≥ {STALE_WEEK_THRESHOLD} tuần
            </p>
          </div>

          {/* 3. Quy mô công việc đang theo dõi */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <p className="text-sm text-slate-600">Nhiệm vụ thường quy</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {overallMetrics.weeklyTasks}
              </span>
              <span className="text-sm text-slate-400">
                / {filteredTasks.length} nhiệm vụ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              phần đo được nhịp hoàn tất tuần
            </p>
          </div>

          {/* 4. Bao nhiêu phòng đang báo cáo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <p className="text-sm text-slate-600">Phòng ban báo cáo</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {activeDepartments.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {settledTrend.length} tuần có dữ liệu
            </p>
          </div>
        </div>
      </div>

      {/* Xu hướng hoàn tất tuần — một con số tĩnh không cho thấy đang lên hay xuống */}
      {settledTrend.length > 2 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Nhịp hoàn tất theo tuần
            </h2>
            <span className="text-xs text-slate-400">
              % nhiệm vụ thường quy xong phần việc của tuần
            </span>
          </div>

          <div className="flex items-end gap-1 h-32">
            {settledTrend.slice(-20).map((w) => (
              <div
                key={w.weekNumber}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`Tuần ${w.weekNumber}: ${w.done}/${w.total} nhiệm vụ (${w.rate}%)`}
              >
                <div
                  className={`w-full rounded-t transition-colors ${
                    w.rate >= 75
                      ? 'bg-emerald-400 group-hover:bg-emerald-500'
                      : w.rate >= 60
                        ? 'bg-sky-400 group-hover:bg-sky-500'
                        : 'bg-amber-400 group-hover:bg-amber-500'
                  }`}
                  style={{ height: `${Math.max(w.rate, 3)}%` }}
                />
                <span className="text-[10px] text-slate-400 mt-1 tabular-nums">
                  {w.weekNumber}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nhiệm vụ im ắng — danh sách cụ thể để hành động, không chỉ một con số */}
      {staleTasks.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-amber-200 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Nhiệm vụ lâu không xuất hiện
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Có lịch sử báo cáo nhưng đã im ắng từ {STALE_WEEK_THRESHOLD} tuần trở lên —
            có thể đã dừng, hoặc bị bỏ sót khi làm báo cáo.
          </p>
          <div className="divide-y divide-slate-100">
            {[...staleTasks]
              .sort((a, b) => (a.lastSeenWeek ?? 0) - (b.lastSeenWeek ?? 0))
              .slice(0, 10)
              .map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{task.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {task.department.name}
                    </p>
                  </div>
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap tabular-nums">
                    {latestWeek - (task.lastSeenWeek ?? 0)} tuần
                  </span>
                </div>
              ))}
          </div>
          {staleTasks.length > 10 && (
            <p className="text-xs text-slate-400 mt-3">
              … và {staleTasks.length - 10} nhiệm vụ nữa
            </p>
          )}
        </div>
      )}

      {/* Department Metrics Table */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Chi tiết theo phòng ban</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phòng ban
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tổng NV
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Hoàn thành
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Đang làm
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chưa bắt đầu
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Hoàn tất tuần
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tổng tuần
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tỉ lệ HT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {displayMetrics.map((metric) => (
                <tr key={metric.department.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {metric.department.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-700">
                    {metric.totalTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-emerald-600 font-semibold">
                    {metric.completedTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-orange-600 font-semibold">
                    {metric.inProgressTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-600">
                    {metric.notStartedTasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <span className="font-bold text-blue-600">{metric.weeklyDoneRate}%</span>
                    <span className="block text-xs text-slate-400">
                      /{metric.weeklyTasks} NV
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-purple-600">
                    {metric.totalWeeks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${metric.completionRate}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-emerald-600">{metric.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {displayMetrics.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Không có dữ liệu
            </div>
          )}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Phân tích theo tháng</h2>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tháng
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  NV có hoạt động
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Hoàn thành
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Hoàn tất tuần
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Biểu đồ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {monthlyMetrics.map((metric) => (
                <tr key={metric.month} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {metric.month}/{selectedYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-700">
                    {metric.tasksStarted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-emerald-600 font-semibold">
                    {metric.tasksCompleted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                    {metric.avgProgress}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-48 bg-slate-200 rounded-full h-3">
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
                  <p className="text-sm text-slate-600">
                    {dept.completedTasks}/{dept.totalTasks} nhiệm vụ
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-600">{dept.completionRate}%</p>
                  <p className="text-xs text-slate-500">hoàn thành</p>
                </div>
              </div>
            ))}
            {topPerformingDepts.length === 0 && (
              <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
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
                  <p className="text-sm text-slate-600">{task.department.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{task.latestProgress}%</p>
                  <p className="text-xs text-slate-500">{task.weekCount} tuần</p>
                </div>
              </div>
            ))}
            {topTasksByProgress.length === 0 && (
              <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
