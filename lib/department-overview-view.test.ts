import { describe, expect, test } from 'vitest';
import type { DepartmentOverviewRow } from './department-overview';
import { attentionScore, filterCounts, matchesFilter, overviewTotals, parseFilterKey, parseSortDir, parseSortKey, searchRows, sortRows } from './department-overview-view';

function row(name: string, over: { work?: Partial<DepartmentOverviewRow['work']>; latestSubmitted?: boolean; needsReview?: number; weeksBehind?: number | null; tracked?: number; secretaries?: number } = {}): DepartmentOverviewRow {
  return {
    id: name, name, description: null,
    counts: { masterTasks: 1, metricDefinitions: 2, secretaries: over.secretaries ?? 1, mous: 0, licenses: 1, accounts: 0 },
    work: { total: 10, open: 4, overdue: 0, dueSoon: 0, stale: 0, done: 6, cancelled: 0, completionRate: 60, onTimeRate: 50, ...over.work },
    report: { strip: [], submittedWeeks: 8, latestSubmitted: over.latestSubmitted ?? true },
    threads: { total: 0, activeProjects: 0, routine: 0, done: 0, stalled: 0, stopped: 0, needsReview: over.needsReview ?? 0, latestWeek: 40 },
    metrics: { tracked: over.tracked ?? 5, latestKey: 202640, weeksBehind: over.weeksBehind === undefined ? 0 : over.weeksBehind, flagged: 0 },
    licensesExpiring: 0,
  };
}

describe('lọc', () => {
  const rows = [
    row('Phòng A', { work: { overdue: 2, stale: 3 } }),
    row('Phòng B', { latestSubmitted: false }),
    row('Phòng C', { needsReview: 2, weeksBehind: 3 }),
    row('Phòng D', { weeksBehind: 5, tracked: 0 }), // không theo dõi số liệu: không tính chậm
  ];
  test('đếm theo từng bộ lọc', () => {
    expect(filterCounts(rows)).toEqual({ all: 4, overdue: 1, stale: 1, noReport: 1, review: 1, metricsLate: 1 });
    expect(matchesFilter(rows[3], 'metricsLate')).toBe(false);
  });
  test('tìm không dấu', () => {
    expect(searchRows([row('Phòng Hành chính'), row('Khoa Dược')], 'hanh chinh').map((r) => r.name)).toEqual(['Phòng Hành chính']);
    expect(searchRows(rows, '  ')).toHaveLength(4);
  });
});

describe('sắp xếp', () => {
  test('cần chú ý: quá hạn nặng hơn chưa nộp báo cáo', () => {
    const a = row('A', { work: { overdue: 2 } });
    const b = row('B', { latestSubmitted: false });
    const c = row('C');
    expect(attentionScore(a)).toBeGreaterThan(attentionScore(b));
    expect(sortRows([c, b, a], 'attention', 'desc').map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
  test('tỷ lệ null luôn xuống cuối, bằng nhau thì theo tên', () => {
    const rows = [row('B', { work: { completionRate: 50 } }), row('C', { work: { completionRate: null } }), row('A', { work: { completionRate: 50 } }), row('D', { work: { completionRate: 90 } })];
    expect(sortRows(rows, 'completion', 'asc').map((r) => r.name)).toEqual(['A', 'B', 'D', 'C']);
    expect(sortRows(rows, 'completion', 'desc').map((r) => r.name)).toEqual(['D', 'A', 'B', 'C']);
  });
  test('độ mới số liệu: mới nhất lên trước khi giảm dần', () => {
    const rows = [row('A', { weeksBehind: 4 }), row('B', { weeksBehind: 0 }), row('C', { weeksBehind: null })];
    expect(sortRows(rows, 'metrics', 'desc').map((r) => r.name)).toEqual(['B', 'A', 'C']);
  });
  test('đọc tham số URL an toàn', () => {
    expect(parseSortKey('bogus')).toBe('attention');
    expect(parseSortKey('overdue')).toBe('overdue');
    expect(parseFilterKey(null)).toBe('all');
    expect(parseSortDir(null, 'name')).toBe('asc');
    expect(parseSortDir('desc', 'name')).toBe('desc');
  });
});

test('overviewTotals cộng toàn viện, tỷ lệ hoàn thành bỏ việc huỷ', () => {
  const t = overviewTotals([row('A', { work: { total: 10, done: 5, cancelled: 0 } }), row('B', { work: { total: 12, done: 9, cancelled: 2, overdue: 1 }, latestSubmitted: false })]);
  expect(t).toMatchObject({ departments: 2, done: 14, completionRate: 70, overdue: 1, reportedLatest: 1, licenses: 2 });
});
