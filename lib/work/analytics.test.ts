import { describe, expect, it } from 'vitest';
import { completedOnTime, computeWorkAnalytics, monthRange, personName, type AnalyticsItem } from './analytics';

const NOW = new Date('2026-10-05T03:00:00Z');
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

function item(overrides: Partial<AnalyticsItem> = {}): AnalyticsItem {
  return {
    id: Math.random().toString(36).slice(2),
    status: 'IN_PROGRESS',
    departmentId: 'hc',
    departmentName: 'Phòng Hành chính',
    leadUnit: 'Phòng HC',
    directedBy: 'A00-045 Nguyễn Hoàng Bắc (BGĐ)',
    directedAt: date('2026-09-01'),
    createdAt: date('2026-09-01'),
    dueDate: null,
    completedAt: null,
    lastActivityAt: new Date('2026-10-01T02:00:00Z'),
    progressPercent: null,
    tags: ['Giao ban tuần'],
    ...overrides,
  };
}

describe('personName', () => {
  it('bỏ mã nhân viên và đơn vị trong ngoặc', () => {
    expect(personName('A00-045 Nguyễn Hoàng Bắc (BGĐ)')).toBe('Nguyễn Hoàng Bắc');
    expect(personName('')).toBeNull();
    expect(personName(null)).toBeNull();
  });
});

describe('monthRange', () => {
  it('gồm hai đầu và qua năm', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('completedOnTime', () => {
  it('hoàn thành trong ngày hạn (giờ Việt Nam) là đúng hạn', () => {
    // 23:30 ngày 10/9 giờ VN = 16:30 UTC
    expect(completedOnTime(item({ status: 'DONE', dueDate: date('2026-09-10'), completedAt: new Date('2026-09-10T16:30:00Z') }))).toBe(true);
    expect(completedOnTime(item({ status: 'DONE', dueDate: date('2026-09-10'), completedAt: new Date('2026-09-10T17:30:00Z') }))).toBe(false);
  });
  it('không có hạn hoặc chưa xong thì không xét', () => {
    expect(completedOnTime(item({ status: 'DONE', completedAt: NOW }))).toBeNull();
    expect(completedOnTime(item({ dueDate: date('2026-09-10') }))).toBeNull();
  });
});

describe('computeWorkAnalytics', () => {
  const items = [
    item({ status: 'DONE', directedAt: date('2026-08-01'), completedAt: new Date('2026-08-11T03:00:00Z'), dueDate: date('2026-08-15') }),
    item({ status: 'DONE', directedAt: date('2026-08-01'), completedAt: new Date('2026-09-20T03:00:00Z'), dueDate: date('2026-09-01') }),
    item({ dueDate: date('2026-09-30'), progressPercent: 40 }),
    item({ departmentId: null, departmentName: null, leadUnit: 'Khoa Mắt', lastActivityAt: null, directedAt: date('2025-06-01'), status: 'NOT_STARTED' }),
    item({ status: 'CANCELLED' }),
  ];
  const a = computeWorkAnalytics(items, { now: NOW });

  it('đếm tổng quan', () => {
    expect(a.kpi).toMatchObject({ total: 5, done: 2, open: 2, overdue: 1, notStarted: 1, cancelled: 1, completionRate: 50, onTimeRate: 50, lateDone: 1 });
    expect(a.kpi.avgOpenProgress).toBe(40);
    expect(a.kpi.medianDaysToComplete).toBe(30); // 10 và 50 ngày
  });

  it('gom theo đơn vị, đơn vị chưa khớp phòng ban giữ tên nguồn', () => {
    const hc = a.units.find((u) => u.departmentId === 'hc')!;
    expect(hc).toMatchObject({ total: 4, done: 2, open: 1, overdue: 1 });
    expect(a.units.find((u) => u.unit === 'Khoa Mắt')).toMatchObject({ open: 1, stale: 1 });
  });

  it('theo tháng: giao, xong, tồn cuối tháng', () => {
    const byMonth = Object.fromEntries(a.monthly.map((m) => [m.month, m]));
    expect(a.monthly[0].month).toBe('2025-06');
    expect(byMonth['2026-08']).toMatchObject({ assigned: 2, completed: 1, backlog: 2 });
    expect(byMonth['2026-09']).toMatchObject({ assigned: 2, completed: 1, backlog: 2 });
  });

  it('tuổi việc tồn và phân bố tiến độ chỉ xét việc đang mở', () => {
    expect(a.aging.reduce((s, b) => s + b.overdue + b.stale + b.active, 0)).toBe(2);
    expect(a.aging.find((b) => b.label === 'Trên 1 năm')).toMatchObject({ stale: 1 });
    expect(a.progress.find((b) => b.label === '26–50%')?.count).toBe(1);
    expect(a.progress.find((b) => b.label === 'Chưa ghi %')?.count).toBe(1);
  });

  it('theo lãnh đạo chỉ đạo và phân loại', () => {
    expect(a.leaders[0]).toMatchObject({ name: 'Nguyễn Hoàng Bắc', total: 5 });
    expect(a.categories[0]).toMatchObject({ name: 'Giao ban tuần', total: 5 });
  });
});
