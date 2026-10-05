/**
 * Số liệu bảng điều hành phân hệ Quản lý công việc — tính thuần trên danh sách
 * việc (vài nghìn dòng là nhiều), không chạm DB. Route chỉ việc nạp dữ liệu.
 *
 * Quy ước:
 * - "Ngày giao" là ngày chỉ đạo, không có thì ngày tạo việc trong hệ thống.
 * - "Đang thực hiện" là chưa hoàn thành/chưa huỷ; việc tạm dừng vẫn tính vào.
 * - Đúng hạn: hoàn thành không muộn hơn hạn (chỉ xét việc có hạn).
 */
import { CLOSED_STATUSES, type WorkStatusKey } from './constants';
import { workHealth, type WorkHealth } from './status';

const MS_PER_DAY = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

export interface AnalyticsItem {
  id: string;
  status: WorkStatusKey;
  departmentId: string | null;
  departmentName: string | null;
  leadUnit: string | null;
  directedBy: string | null;
  directedAt: Date | null;
  createdAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  progressPercent: number | null;
  tags: string[];
}

export interface UnitStats {
  key: string;
  departmentId: string | null;
  unit: string;
  total: number;
  done: number;
  open: number;
  overdue: number;
  stale: number;
  staleOnly: number;
  notStarted: number;
  /** Hoàn thành / (tổng − huỷ), 0–100. */
  completionRate: number | null;
  /** Hoàn thành đúng hạn / hoàn thành có hạn, 0–100. */
  onTimeRate: number | null;
  medianDaysToComplete: number | null;
  avgOpenProgress: number | null;
  /** Số ngày việc đang mở lâu nhất đã tồn. */
  oldestOpenDays: number | null;
}

export interface MonthPoint {
  month: string;
  assigned: number;
  completed: number;
  /** Việc còn tồn cuối tháng. */
  backlog: number;
}

export const AGE_BUCKETS = [
  { label: 'Dưới 1 tháng', maxDays: 30 },
  { label: '1–3 tháng', maxDays: 90 },
  { label: '3–6 tháng', maxDays: 180 },
  { label: '6–12 tháng', maxDays: 365 },
  { label: 'Trên 1 năm', maxDays: Infinity },
] as const;

export const PROGRESS_BUCKETS = [
  { label: 'Chưa ghi %', min: null, max: null },
  { label: '0%', min: 0, max: 0 },
  { label: '1–25%', min: 1, max: 25 },
  { label: '26–50%', min: 26, max: 50 },
  { label: '51–75%', min: 51, max: 75 },
  { label: '76–99%', min: 76, max: 99 },
] as const;

const vnDayNumber = (d: Date) => Math.floor((d.getTime() + VN_OFFSET_MS) / MS_PER_DAY);
/** Cột DATE lưu nửa đêm UTC — số ngày lấy thẳng. */
const dateDayNumber = (d: Date) => Math.floor(d.getTime() / MS_PER_DAY);
const vnMonth = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);

export const assignedAt = (i: Pick<AnalyticsItem, 'directedAt' | 'createdAt'>) => i.directedAt ?? i.createdAt;
export const isOpen = (status: WorkStatusKey) => !CLOSED_STATUSES.includes(status);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** "A00-045 Nguyễn Hoàng Bắc (BGĐ)" → "Nguyễn Hoàng Bắc". */
export function personName(raw: string | null): string | null {
  const name = raw?.replace(/^[A-Z]\d{2}-\d{3,}\s+/, '').replace(/\s*\([^()]*\)\s*$/, '').trim();
  return name || null;
}

export const daysToComplete = (i: AnalyticsItem) =>
  i.completedAt ? Math.max(0, vnDayNumber(i.completedAt) - dateDayNumber(assignedAt(i))) : null;

/** true đúng hạn, false trễ, null nếu chưa xong hoặc không có hạn. */
export function completedOnTime(i: AnalyticsItem): boolean | null {
  if (i.status !== 'DONE' || !i.completedAt || !i.dueDate) return null;
  return vnDayNumber(i.completedAt) <= dateDayNumber(i.dueDate);
}

interface Enriched {
  item: AnalyticsItem;
  health: WorkHealth;
  open: boolean;
  ageDays: number;
}

function enrich(items: AnalyticsItem[], now: Date): Enriched[] {
  const today = vnDayNumber(now);
  return items.map((item) => ({
    item,
    health: workHealth(item, now),
    open: isOpen(item.status),
    ageDays: Math.max(0, today - dateDayNumber(assignedAt(item))),
  }));
}

function summarize(rows: Enriched[]) {
  const done = rows.filter((r) => r.item.status === 'DONE');
  const open = rows.filter((r) => r.open);
  const cancelled = rows.filter((r) => r.item.status === 'CANCELLED').length;
  const timed = done.map((r) => completedOnTime(r.item)).filter((v): v is boolean => v !== null);
  const openProgress = open.map((r) => r.item.progressPercent).filter((v): v is number => v !== null);
  return {
    total: rows.length,
    done: done.length,
    open: open.length,
    overdue: open.filter((r) => r.health.isOverdue).length,
    stale: open.filter((r) => r.health.isStale).length,
    /** Lâu chưa cập nhật nhưng chưa quá hạn — để thanh chồng không đếm một việc hai lần. */
    staleOnly: open.filter((r) => r.health.isStale && !r.health.isOverdue).length,
    dueSoon: open.filter((r) => r.health.isDueSoon).length,
    notStarted: open.filter((r) => r.item.status === 'NOT_STARTED').length,
    paused: open.filter((r) => r.item.status === 'PAUSED').length,
    cancelled,
    completionRate: pct(done.length, rows.length - cancelled),
    onTimeRate: pct(timed.filter(Boolean).length, timed.length),
    onTimeBase: timed.length,
    lateDone: timed.filter((v) => !v).length,
    medianDaysToComplete: median(done.map((r) => daysToComplete(r.item)).filter((v): v is number => v !== null)),
    avgOpenProgress: openProgress.length ? Math.round(openProgress.reduce((a, b) => a + b, 0) / openProgress.length) : null,
    oldestOpenDays: open.length ? Math.max(...open.map((r) => r.ageDays)) : null,
  };
}

export type WorkKpi = ReturnType<typeof summarize>;

function unitOf(i: AnalyticsItem) {
  const unit = i.departmentName ?? i.leadUnit ?? 'Chưa rõ đơn vị';
  return { key: i.departmentId ?? `raw:${unit}`, departmentId: i.departmentId, unit };
}

function groupBy<K>(rows: Enriched[], keyOf: (r: Enriched) => K | null): Map<K, Enriched[]> {
  const groups = new Map<K, Enriched[]>();
  for (const r of rows) {
    const key = keyOf(r);
    if (key === null) continue;
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

function unitStats(rows: Enriched[]): UnitStats[] {
  const groups = groupBy(rows, (r) => unitOf(r.item).key);
  return [...groups.values()]
    .map((g) => {
      const s = summarize(g);
      const { key, departmentId, unit } = unitOf(g[0].item);
      return {
        key,
        departmentId,
        unit,
        total: s.total,
        done: s.done,
        open: s.open,
        overdue: s.overdue,
        stale: s.stale,
        staleOnly: s.staleOnly,
        notStarted: s.notStarted,
        completionRate: s.completionRate,
        onTimeRate: s.onTimeRate,
        medianDaysToComplete: s.medianDaysToComplete,
        avgOpenProgress: s.avgOpenProgress,
        oldestOpenDays: s.oldestOpenDays,
      };
    })
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue || b.total - a.total);
}

/** Danh sách tháng liên tục từ `from` đến `to` (gồm cả hai đầu), dạng "2025-03". */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

function monthly(rows: Enriched[], months: string[]): MonthPoint[] {
  const assignedMonth = rows.map((r) => assignedAt(r.item).toISOString().slice(0, 7));
  const completedMonth = rows.map((r) => (r.item.completedAt && r.item.status === 'DONE' ? vnMonth(r.item.completedAt) : null));
  return months.map((month) => ({
    month,
    assigned: assignedMonth.filter((m) => m === month).length,
    completed: completedMonth.filter((m) => m === month).length,
    backlog: rows.filter(
      (r, i) => r.item.status !== 'CANCELLED' && assignedMonth[i] <= month && !(completedMonth[i] !== null && completedMonth[i]! <= month),
    ).length,
  }));
}

function aging(open: Enriched[]) {
  return AGE_BUCKETS.map((bucket, index) => {
    const min = index === 0 ? -1 : AGE_BUCKETS[index - 1].maxDays;
    const inBucket = open.filter((r) => r.ageDays > min && r.ageDays <= bucket.maxDays);
    return {
      label: bucket.label,
      overdue: inBucket.filter((r) => r.health.isOverdue).length,
      stale: inBucket.filter((r) => !r.health.isOverdue && r.health.isStale).length,
      active: inBucket.filter((r) => !r.health.isOverdue && !r.health.isStale).length,
    };
  });
}

function progressDistribution(open: Enriched[]) {
  return PROGRESS_BUCKETS.map((b) => ({
    label: b.label,
    count: open.filter((r) => {
      const p = r.item.progressPercent;
      if (b.min === null) return p === null;
      return p !== null && p >= b.min && p <= b.max;
    }).length,
  }));
}

function breakdown(rows: Enriched[], keyOf: (i: AnalyticsItem) => string | null) {
  return [...groupBy(rows, (r) => keyOf(r.item)).entries()]
    .map(([name, g]) => {
      const s = summarize(g);
      return { name, total: s.total, done: s.done, open: s.open, overdue: s.overdue, staleOnly: s.staleOnly, completionRate: s.completionRate };
    })
    .sort((a, b) => b.total - a.total);
}

export interface AnalyticsOptions {
  now?: Date;
  /** Tháng đầu/cuối của biểu đồ theo tháng; mặc định từ việc giao sớm nhất đến tháng hiện tại. */
  fromMonth?: string;
  toMonth?: string;
}

export function computeWorkAnalytics(items: AnalyticsItem[], options: AnalyticsOptions = {}) {
  const now = options.now ?? new Date();
  const rows = enrich(items, now);
  const open = rows.filter((r) => r.open);
  const firstMonth = rows.length ? rows.map((r) => assignedAt(r.item).toISOString().slice(0, 7)).sort()[0] : vnMonth(now);
  const months = monthRange(options.fromMonth ?? firstMonth, options.toMonth ?? vnMonth(now));

  const statusCounts = new Map<WorkStatusKey, number>();
  for (const r of rows) statusCounts.set(r.item.status, (statusCounts.get(r.item.status) ?? 0) + 1);

  return {
    kpi: summarize(rows),
    status: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    monthly: monthly(rows, months),
    units: unitStats(rows),
    aging: aging(open),
    progress: progressDistribution(open),
    leaders: breakdown(rows, (i) => personName(i.directedBy)),
    categories: breakdown(rows, (i) => i.tags[0] ?? null),
  };
}

export type WorkAnalytics = ReturnType<typeof computeWorkAnalytics>;
