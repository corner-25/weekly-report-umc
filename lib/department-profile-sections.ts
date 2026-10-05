/**
 * Phần tính thuần của hồ sơ phòng ban: khối "Công việc chỉ đạo" (số liệu điều
 * hành + các danh sách cần chú ý) và khối "Nhiệm vụ báo cáo tuần" (task threads).
 * Không chạm DB — lib/department-profile.ts nạp dữ liệu rồi gọi vào đây.
 */
import type { TaskThreadKind, TaskThreadStatus } from '@prisma/client';
import type { WorkKindKey, WorkPriorityKey, WorkStatusKey } from '@/lib/work/constants';
import { computeWorkAnalytics, isOpen, type AnalyticsItem } from '@/lib/work/analytics';
import { workHealth, type WorkHealth } from '@/lib/work/status';
import { effectiveThread, summarizeThreads, type ThreadSignalRow } from '@/lib/department-signals';

/** Số việc tối đa mỗi danh sách cần chú ý — đủ để thấy, xem hết ở trang Công việc. */
export const ATTENTION_LIMIT = 6;
/** Biểu đồ theo tháng: ngần này tháng gần nhất. */
export const MONTHS_SHOWN = 12;
const THREAD_LIMIT = 8;

export interface ProfileWorkRow extends AnalyticsItem {
  title: string;
  kind: WorkKindKey;
  priority: WorkPriorityKey;
}

export interface AttentionItem {
  id: string;
  title: string;
  status: WorkStatusKey;
  kind: WorkKindKey;
  priority: WorkPriorityKey;
  progressPercent: number | null;
  dueDate: string | null;
  completedAt: string | null;
  directedBy: string | null;
  health: WorkHealth;
}

const isoDay = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** Tháng "YYYY-MM" lùi `back` tháng so với `now` (giờ Việt Nam). */
export function monthsBack(now: Date, back: number): string {
  const vn = new Date(now.getTime() + 7 * 3_600_000);
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - back, 1));
  return d.toISOString().slice(0, 7);
}

export function buildWorkSection(items: readonly ProfileWorkRow[], now: Date) {
  const analytics = computeWorkAnalytics([...items], { now, fromMonth: monthsBack(now, MONTHS_SHOWN - 1) });
  const rows = items.map((item) => ({ item, health: workHealth(item, now) }));
  const open = rows.filter((r) => isOpen(r.item.status));
  const toDto = ({ item, health }: (typeof rows)[number]): AttentionItem => ({
    id: item.id, title: item.title, status: item.status, kind: item.kind, priority: item.priority,
    progressPercent: item.progressPercent, dueDate: isoDay(item.dueDate), completedAt: item.completedAt?.toISOString() ?? null,
    directedBy: item.directedBy, health,
  });
  const silence = (h: WorkHealth) => h.daysSinceActivity ?? Number.MAX_SAFE_INTEGER;

  return {
    kpi: analytics.kpi,
    status: analytics.status,
    monthly: analytics.monthly,
    lists: {
      overdue: open.filter((r) => r.health.isOverdue).sort((a, b) => (a.health.daysToDue ?? 0) - (b.health.daysToDue ?? 0)).slice(0, ATTENTION_LIMIT).map(toDto),
      dueSoon: open.filter((r) => r.health.isDueSoon).sort((a, b) => (a.health.daysToDue ?? 0) - (b.health.daysToDue ?? 0)).slice(0, ATTENTION_LIMIT).map(toDto),
      // Chỉ việc chưa quá hạn — việc quá hạn đã nằm ở danh sách trên.
      stale: open.filter((r) => r.health.isStale && !r.health.isOverdue).sort((a, b) => silence(b.health) - silence(a.health)).slice(0, ATTENTION_LIMIT).map(toDto),
      recentDone: rows
        .filter((r) => r.item.status === 'DONE' && r.item.completedAt)
        .sort((a, b) => b.item.completedAt!.getTime() - a.item.completedAt!.getTime())
        .slice(0, ATTENTION_LIMIT)
        .map(toDto),
    },
  };
}

export type WorkSection = ReturnType<typeof buildWorkSection>;

// ── Nhiệm vụ báo cáo tuần ──

export interface ProfileThreadRow extends ThreadSignalRow {
  id: string;
  title: string;
  progress: number | null;
  overrideProgress: number | null;
  firstWeek: number;
  completedWeek: number | null;
}

export interface ThreadItem {
  id: string;
  title: string;
  kind: TaskThreadKind | null;
  status: TaskThreadStatus | null;
  progress: number | null;
  firstWeek: number;
  lastWeek: number;
  completedWeek: number | null;
  needsReview: boolean;
}

function toThreadItem(t: ProfileThreadRow): ThreadItem {
  const { kind, status, needsReview } = effectiveThread(t);
  return {
    id: t.id, title: t.title, kind, status, needsReview,
    progress: kind === 'ROUTINE' ? null : t.overrideProgress ?? t.progress,
    firstWeek: t.firstWeek, lastWeek: t.lastWeek,
    completedWeek: status === 'DONE' ? t.completedWeek ?? t.lastWeek : null,
  };
}

export function buildThreadSection(rows: readonly ProfileThreadRow[], year: number | null) {
  const items = rows.map(toThreadItem);
  return {
    year,
    summary: summarizeThreads(rows),
    projects: items
      .filter((t) => t.kind !== null && t.kind !== 'ROUTINE' && (t.status === 'IN_PROGRESS' || t.status === 'STALLED') && !t.needsReview)
      .sort((a, b) => b.lastWeek - a.lastWeek || (b.progress ?? -1) - (a.progress ?? -1))
      .slice(0, THREAD_LIMIT),
    review: items.filter((t) => t.needsReview).sort((a, b) => b.lastWeek - a.lastWeek).slice(0, THREAD_LIMIT),
    recentDone: items
      .filter((t) => t.status === 'DONE')
      .sort((a, b) => (b.completedWeek ?? 0) - (a.completedWeek ?? 0))
      .slice(0, 5),
  };
}

export type ThreadSection = ReturnType<typeof buildThreadSection>;
