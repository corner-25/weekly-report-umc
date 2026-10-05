import { describe, expect, it } from 'vitest';
import { auditYear, needsAttention, worstSeverity, type AuditWeekInput } from './audit';
import { hospitalWeekRange } from './hospital-week';

const DEPTS = ['A', 'B', 'C', 'D'];

/** Tuần "chuẩn": đúng ngày, đủ đơn vị, có nhiệm vụ và số liệu. */
function week(n: number, overrides: Partial<AuditWeekInput> = {}): AuditWeekInput {
  const r = hospitalWeekRange(n, 2026);
  return {
    id: `w${n}`,
    weekNumber: n,
    year: 2026,
    startDate: `${r.startKey}T00:00:00.000Z`,
    endDate: `${r.endKey}T00:00:00.000Z`,
    status: 'DRAFT',
    taskCount: 80,
    departmentCount: DEPTS.length,
    departmentNames: DEPTS,
    emptyResultCount: 0,
    metricValueCount: 0,
    extractedMetricCount: 200,
    ...overrides,
  };
}

const TODAY = '2026-10-05'; // Thứ Hai tuần 41

describe('auditYear', () => {
  it('tuần chuẩn không có vấn đề', () => {
    const a = auditYear([3, 4, 5, 6].map((n) => week(n)), 2026, TODAY);
    expect(Object.values(a.issuesByWeek).every((i) => i.length === 0)).toBe(true);
  });

  it('liệt kê tuần thiếu đến hết tuần trước, không tính tuần hiện tại', () => {
    const weeks = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => n !== 8).map((n) => week(n));
    const a = auditYear(weeks, 2026, TODAY);
    expect(a.missingWeeks.map((m) => m.weekNumber)).toEqual([8]);
    expect(a.missingWeeks[0]).toMatchObject({ startKey: '2026-02-14', endKey: '2026-02-20' });
    expect(a.closedWeekCount).toBe(40);
    expect(a.reportedClosedCount).toBe(39);
    expect(a.currentWeek).toMatchObject({ weekNumber: 41, startKey: '2026-10-03', weekId: null, status: null });
  });

  it('nhận ra tuần hiện tại đã có báo cáo', () => {
    const a = auditYear([week(41, { status: 'COMPLETED' })], 2026, TODAY);
    expect(a.currentWeek).toMatchObject({ weekId: 'w41', status: 'COMPLETED' });
  });

  it('bắt tuần lệch quy tắc Thứ Bảy → Thứ Sáu (tuần 9 lưu Thứ Hai)', () => {
    const a = auditYear([week(9, { startDate: '2026-02-23T00:00:00.000Z' })], 2026, TODAY);
    expect(a.issuesByWeek.w9.map((i) => i.code)).toContain('DATE_MISMATCH');
    expect(a.issuesByWeek.w9[0].detail).toContain('21/02 – 27/02/2026');
  });

  it('bỏ qua hai tuần đầu năm lệch nhịp', () => {
    const a = auditYear([week(1, { startDate: '2025-12-28T17:00:00.000Z' })], 2026, TODAY);
    expect(a.issuesByWeek.w1.map((i) => i.code)).not.toContain('DATE_MISMATCH');
  });

  it('bắt tuần trùng ngày (tuần 20 lưu ngày của tuần 19), không kéo theo tuần đúng', () => {
    const w19 = week(19);
    const w20 = week(20, { startDate: w19.startDate, endDate: w19.endDate });
    const a = auditYear([w19, w20], 2026, TODAY);
    expect(a.issuesByWeek.w20[0]).toMatchObject({ code: 'DUPLICATE_RANGE', severity: 'danger', label: 'Trùng ngày tuần 19' });
    expect(a.issuesByWeek.w20.map((i) => i.code)).toContain('DATE_MISMATCH');
    expect(a.issuesByWeek.w19).toEqual([]);
  });

  it('bắt tuần thiếu đơn vị thường lệ', () => {
    const weeks = [3, 4, 5, 6, 7].map((n) => week(n));
    weeks.push(week(9, { departmentNames: ['A', 'B'], departmentCount: 2 }));
    const a = auditYear(weeks, 2026, TODAY);
    const issue = a.issuesByWeek.w9.find((i) => i.code === 'MISSING_DEPTS');
    expect(issue?.label).toBe('Thiếu 2 đơn vị');
    expect(issue?.detail).toContain('C; D');
  });

  it('báo cáo rỗng là mức nghiêm trọng', () => {
    const a = auditYear([week(5, { taskCount: 0, departmentCount: 0, departmentNames: [] })], 2026, TODAY);
    expect(worstSeverity(a.issuesByWeek.w5)).toBe('danger');
    expect(needsAttention(a.issuesByWeek.w5)).toBe(true);
  });

  it('việc trống kết quả và thiếu số liệu chỉ là thông tin', () => {
    const a = auditYear([week(5, { emptyResultCount: 2, extractedMetricCount: 0 })], 2026, TODAY);
    expect(a.issuesByWeek.w5.map((i) => i.code).sort()).toEqual(['EMPTY_RESULTS', 'NO_METRICS']);
    expect(needsAttention(a.issuesByWeek.w5)).toBe(false);
  });

  it('năm đã qua tính đủ 52 tuần, năm tương lai không thiếu tuần nào', () => {
    expect(auditYear([], 2025, TODAY).closedWeekCount).toBe(52);
    expect(auditYear([], 2027, TODAY)).toMatchObject({ closedWeekCount: 0, missingWeeks: [], currentWeek: null });
  });

  it('bỏ qua tuần của năm khác', () => {
    const a = auditYear([week(5, { year: 2025, id: 'old' })], 2026, TODAY);
    expect(a.issuesByWeek.old).toBeUndefined();
  });
});

describe('worstSeverity', () => {
  it('trả null khi không có vấn đề', () => {
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity(undefined)).toBeNull();
  });
});
