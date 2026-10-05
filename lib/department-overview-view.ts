/**
 * Lọc, sắp xếp và chấm "mức cần chú ý" cho bảng tổng quan phòng ban. Thuần,
 * chạy được ở trình duyệt (chỉ dùng kiểu từ lib/department-overview.ts).
 */
import type { DepartmentOverviewRow } from '@/lib/department-overview';
import { toSearchKey } from '@/lib/crm/constants';

/** Số liệu mới nhất chậm từ ngần này tuần trở lên thì coi là "số liệu chậm". */
export const METRICS_LATE_WEEKS = 2;

export const SORT_KEYS = ['attention', 'name', 'open', 'overdue', 'dueSoon', 'stale', 'completion', 'report', 'threads', 'metrics', 'secretaries'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export const SORT_LABELS: Record<SortKey, string> = {
  attention: 'Cần chú ý nhất',
  name: 'Tên phòng',
  open: 'Đang thực hiện',
  overdue: 'Quá hạn',
  dueSoon: 'Sắp đến hạn',
  stale: 'Lâu chưa cập nhật',
  completion: 'Tỷ lệ hoàn thành',
  report: 'Nộp báo cáo tuần',
  threads: 'Nhiệm vụ cần xác nhận',
  metrics: 'Độ mới số liệu',
  secretaries: 'Số thư ký',
};

/** Chiều mặc định khi bấm vào một cột: tên A→Z, tỷ lệ/nộp báo cáo thấp lên trước, còn lại nhiều lên trước. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  attention: 'desc', name: 'asc', open: 'desc', overdue: 'desc', dueSoon: 'desc', stale: 'desc',
  completion: 'asc', report: 'asc', threads: 'desc', metrics: 'desc', secretaries: 'desc',
};

export const FILTER_KEYS = ['all', 'overdue', 'stale', 'noReport', 'review', 'metricsLate'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const FILTER_LABELS: Record<FilterKey, { label: string; hint: string }> = {
  all: { label: 'Tất cả', hint: 'Mọi phòng ban đang hoạt động' },
  overdue: { label: 'Có việc quá hạn', hint: 'Có công việc chỉ đạo đang thực hiện đã qua hạn chót' },
  stale: { label: 'Lâu chưa cập nhật', hint: 'Có công việc chỉ đạo quá 14 ngày không có báo cáo tiến độ mới' },
  noReport: { label: 'Chưa nộp tuần gần nhất', hint: 'Phòng không có trong báo cáo tuần chung của tuần mới nhất' },
  review: { label: 'Nhiệm vụ cần xác nhận', hint: 'Nhiệm vụ báo cáo tuần AI chưa chắc tình trạng, Phòng HC chưa xác nhận' },
  metricsLate: { label: 'Số liệu chậm', hint: `Số liệu theo dõi mới nhất chậm từ ${METRICS_LATE_WEEKS} tuần trở lên so với tuần báo cáo mới nhất` },
};

const FILTERS: Record<FilterKey, (r: DepartmentOverviewRow) => boolean> = {
  all: () => true,
  overdue: (r) => r.work.overdue > 0,
  stale: (r) => r.work.stale > 0,
  noReport: (r) => !r.report.latestSubmitted,
  review: (r) => r.threads.needsReview > 0,
  metricsLate: (r) => r.metrics.tracked > 0 && (r.metrics.weeksBehind ?? 0) >= METRICS_LATE_WEEKS,
};

export function matchesFilter(row: DepartmentOverviewRow, filter: FilterKey): boolean {
  return FILTERS[filter](row);
}

export function filterCounts(rows: readonly DepartmentOverviewRow[]): Record<FilterKey, number> {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, rows.filter(FILTERS[k]).length])) as Record<FilterKey, number>;
}

/**
 * Mức cần chú ý: việc quá hạn nặng nhất, rồi việc lâu chưa cập nhật, chưa nộp báo
 * cáo tuần gần nhất, nhiệm vụ cần xác nhận và số liệu chậm. Chỉ dùng để xếp hạng.
 */
export function attentionScore(r: DepartmentOverviewRow): number {
  const staleOnly = Math.max(0, r.work.stale - r.work.overdue);
  return (
    r.work.overdue * 3 +
    staleOnly +
    r.work.dueSoon * 0.5 +
    (r.report.latestSubmitted ? 0 : 4) +
    r.threads.needsReview * 0.5 +
    (FILTERS.metricsLate(r) ? 2 : 0)
  );
}

/** Giá trị để so sánh; null luôn xuống cuối bất kể chiều. */
function sortValue(r: DepartmentOverviewRow, key: SortKey): number | string | null {
  switch (key) {
    case 'attention': return attentionScore(r);
    case 'name': return r.name;
    case 'open': return r.work.open;
    case 'overdue': return r.work.overdue;
    case 'dueSoon': return r.work.dueSoon;
    case 'stale': return r.work.stale;
    case 'completion': return r.work.completionRate;
    case 'report': return r.report.submittedWeeks;
    case 'threads': return r.threads.needsReview;
    case 'metrics': return r.metrics.weeksBehind === null ? null : -r.metrics.weeksBehind;
    case 'secretaries': return r.counts.secretaries;
  }
}

export function sortRows(rows: readonly DepartmentOverviewRow[], key: SortKey, dir: SortDir): DepartmentOverviewRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const diff = typeof va === 'string' ? va.localeCompare(vb as string, 'vi') : va - (vb as number);
      if (diff !== 0) return diff * sign;
    }
    return a.name.localeCompare(b.name, 'vi');
  });
}

/** Tìm không dấu theo tên và mô tả. */
export function searchRows(rows: readonly DepartmentOverviewRow[], query: string): DepartmentOverviewRow[] {
  const q = toSearchKey(query.trim());
  if (!q) return [...rows];
  return rows.filter((r) => toSearchKey(r.name, r.description).includes(q));
}

export function parseSortKey(raw: string | null): SortKey {
  return (SORT_KEYS as readonly string[]).includes(raw ?? '') ? (raw as SortKey) : 'attention';
}

export function parseFilterKey(raw: string | null): FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(raw ?? '') ? (raw as FilterKey) : 'all';
}

export function parseSortDir(raw: string | null, key: SortKey): SortDir {
  return raw === 'asc' || raw === 'desc' ? raw : DEFAULT_DIR[key];
}

/** Tổng toàn viện cho dải số liệu đầu trang. */
export function overviewTotals(rows: readonly DepartmentOverviewRow[]) {
  const sum = (pick: (r: DepartmentOverviewRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0);
  const done = sum((r) => r.work.done);
  const base = sum((r) => r.work.total - r.work.cancelled);
  return {
    departments: rows.length,
    open: sum((r) => r.work.open),
    overdue: sum((r) => r.work.overdue),
    dueSoon: sum((r) => r.work.dueSoon),
    stale: sum((r) => r.work.stale),
    done,
    completionRate: base > 0 ? Math.round((done / base) * 100) : null,
    reportedLatest: rows.filter((r) => r.report.latestSubmitted).length,
    needsReview: sum((r) => r.threads.needsReview),
    secretaries: sum((r) => r.counts.secretaries),
    masterTasks: sum((r) => r.counts.masterTasks),
    metricDefinitions: sum((r) => r.counts.metricDefinitions),
    mous: sum((r) => r.counts.mous),
    licenses: sum((r) => r.counts.licenses),
    licensesExpiring: sum((r) => r.licensesExpiring),
  };
}

export type OverviewTotals = ReturnType<typeof overviewTotals>;
