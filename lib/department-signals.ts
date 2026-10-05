/**
 * Tín hiệu thuần (không chạm DB) dùng chung cho bảng tổng quan phòng ban và
 * hồ sơ từng phòng: tóm tắt công việc chỉ đạo, nhiệm vụ báo cáo tuần (task
 * threads), dải nộp báo cáo và độ mới của số liệu.
 *
 * Quy ước công việc giống phân hệ Quản lý công việc (lib/work/analytics.ts):
 * "Đang thực hiện" = chưa hoàn thành, chưa huỷ; quá hạn / sắp đến hạn / lâu chưa
 * cập nhật theo workHealth.
 */
import type { TaskThreadKind, TaskThreadStatus } from '@prisma/client';
import type { WorkStatusKey } from '@/lib/work/constants';
import { workHealth } from '@/lib/work/status';
import { completedOnTime, isOpen, type AnalyticsItem } from '@/lib/work/analytics';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export interface WorkSignalItem {
  status: WorkStatusKey;
  dueDate: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  directedAt: Date | null;
  createdAt: Date;
}

export interface WorkSignals {
  total: number;
  open: number;
  overdue: number;
  dueSoon: number;
  stale: number;
  done: number;
  cancelled: number;
  /** Hoàn thành ÷ (tổng − huỷ), 0–100. */
  completionRate: number | null;
  /** Hoàn thành đúng hạn ÷ hoàn thành có hạn, 0–100. */
  onTimeRate: number | null;
}

export const EMPTY_WORK: WorkSignals = {
  total: 0, open: 0, overdue: 0, dueSoon: 0, stale: 0, done: 0, cancelled: 0, completionRate: null, onTimeRate: null,
};

/** completedOnTime chỉ đọc status/completedAt/dueDate — các trường còn lại để trống. */
const asAnalyticsItem = (item: WorkSignalItem): AnalyticsItem => ({
  ...item, id: '', departmentId: null, departmentName: null, leadUnit: null, directedBy: null, progressPercent: null, tags: [],
});

/** Tóm tắt công việc chỉ đạo của một phòng. */
export function summarizeWork(items: readonly WorkSignalItem[], now: Date): WorkSignals {
  let open = 0, overdue = 0, dueSoon = 0, stale = 0, done = 0, cancelled = 0, timed = 0, onTime = 0;
  for (const item of items) {
    if (item.status === 'CANCELLED') cancelled += 1;
    if (item.status === 'DONE') {
      done += 1;
      const ok = completedOnTime(asAnalyticsItem(item));
      if (ok !== null) {
        timed += 1;
        if (ok) onTime += 1;
      }
    }
    if (!isOpen(item.status)) continue;
    open += 1;
    const h = workHealth(item, now);
    if (h.isOverdue) overdue += 1;
    if (h.isDueSoon) dueSoon += 1;
    if (h.isStale) stale += 1;
  }
  return {
    total: items.length, open, overdue, dueSoon, stale, done, cancelled,
    completionRate: pct(done, items.length - cancelled),
    onTimeRate: pct(onTime, timed),
  };
}

/** Gom việc theo phòng rồi tóm tắt từng nhóm. */
export function summarizeWorkByDepartment<T extends WorkSignalItem & { departmentId: string | null }>(items: readonly T[], now: Date): Map<string, WorkSignals> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.departmentId) continue;
    const list = groups.get(item.departmentId);
    if (list) list.push(item);
    else groups.set(item.departmentId, [item]);
  }
  return new Map([...groups.entries()].map(([id, list]) => [id, summarizeWork(list, now)]));
}

// ── Nhiệm vụ báo cáo tuần (task threads) ──

export interface ThreadSignalRow {
  kind: TaskThreadKind | null;
  status: TaskThreadStatus | null;
  overrideKind: TaskThreadKind | null;
  overrideStatus: TaskThreadStatus | null;
  needsReview: boolean;
  overriddenAt: Date | null;
  lastWeek: number;
}

export interface ThreadSignals {
  total: number;
  /** Việc có tiến độ (PROJECT/ONE_OFF) đang làm hoặc đứng yên. */
  activeProjects: number;
  /** Việc thường kỳ còn báo cáo. */
  routine: number;
  done: number;
  stalled: number;
  stopped: number;
  /** AI chưa chắc, Phòng HC chưa xác nhận. */
  needsReview: number;
  /** Tuần mới nhất phòng còn báo cáo một việc nào đó; 0 nếu chưa có. */
  latestWeek: number;
}

export const EMPTY_THREADS: ThreadSignals = { total: 0, activeProjects: 0, routine: 0, done: 0, stalled: 0, stopped: 0, needsReview: 0, latestWeek: 0 };

/** Giá trị hiệu lực: Phòng HC sửa tay thắng AI (giống lib/task-tracking/server.ts). */
export function effectiveThread(t: ThreadSignalRow) {
  return {
    kind: t.overrideKind ?? t.kind,
    status: t.overrideStatus ?? t.status,
    needsReview: t.needsReview && !t.overriddenAt,
  };
}

export function summarizeThreads(rows: readonly ThreadSignalRow[]): ThreadSignals {
  const s = { ...EMPTY_THREADS, total: rows.length };
  for (const row of rows) {
    const { kind, status, needsReview } = effectiveThread(row);
    if (needsReview) s.needsReview += 1;
    if (row.lastWeek > s.latestWeek) s.latestWeek = row.lastWeek;
    if (status === 'DONE') s.done += 1;
    else if (status === 'STOPPED') s.stopped += 1;
    if (status === 'STALLED') s.stalled += 1;
    if (kind === 'ROUTINE' && status === 'IN_PROGRESS') s.routine += 1;
    if (kind !== 'ROUTINE' && kind !== null && (status === 'IN_PROGRESS' || status === 'STALLED')) s.activeProjects += 1;
  }
  return s;
}

// ── Nộp báo cáo tuần ──

export interface WeekKey {
  id: string;
  year: number;
  weekNumber: number;
}

export interface SubmissionCell {
  year: number;
  week: number;
  submitted: boolean;
  taskCount: number | null;
}

/**
 * Dải nộp báo cáo, cũ → mới. Một tuần tính là đã nộp nếu phòng có trong file báo
 * cáo chung (snapshot) hoặc — với tuần trước khi có snapshot — có nhiệm vụ của phòng.
 * `weeks` theo thứ tự mới → cũ như truy vấn trả về.
 */
export function buildSubmissionStrip(
  weeks: readonly WeekKey[],
  snapshotTasks: ReadonlyMap<string, number>,
  progressTasks: ReadonlyMap<string, number>,
): SubmissionCell[] {
  return [...weeks].reverse().map((w) => {
    const snap = snapshotTasks.get(`${w.year}-${w.weekNumber}`);
    const tasks = progressTasks.get(w.id) ?? 0;
    return { year: w.year, week: w.weekNumber, submitted: snap !== undefined || tasks > 0, taskCount: snap ?? (tasks || null) };
  });
}

/** Số tuần chênh giữa hai mốc "năm*100 + tuần" (xấp xỉ 52 tuần/năm). Null nếu thiếu mốc. */
export function weeksBetween(fromKey: number | null, toKey: number | null): number | null {
  if (fromKey === null || toKey === null) return null;
  const toIndex = (k: number) => Math.floor(k / 100) * 52 + (k % 100);
  return Math.max(0, toIndex(toKey) - toIndex(fromKey));
}
