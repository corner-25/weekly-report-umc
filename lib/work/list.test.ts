import { describe, expect, it } from 'vitest';
import { filterItems, groupByUnit, sortItems, type WorkListItem } from './list';

let seq = 0;
function item(o: Partial<WorkListItem> = {}): WorkListItem {
  seq += 1;
  return {
    id: `w${seq}`, source: 'QLCV', externalId: String(seq), externalUrl: null, kind: 'DIRECTIVE', title: `Việc ${seq}`,
    status: 'IN_PROGRESS', externalStatus: null, priority: 'NORMAL', department: { id: 'hc', name: 'Phòng Hành chính' }, leadUnit: 'Phòng HC',
    leader: 'Nguyễn Hoàng Bắc', directedAt: '2026-09-01', dueDate: null, completedAt: null, progressPercent: null, tags: ['Giao ban tuần'],
    assignees: [], updateCount: 1, lastUpdate: null, ageDays: 30, silentDays: 3, daysToDue: null, isOpen: true, isOverdue: false,
    isDueSoon: false, isStale: false, lateDays: null, ...o,
  };
}

const overdueStale = item({ title: 'Quá hạn và im lặng', isOverdue: true, isStale: true, daysToDue: -20, silentDays: 40, dueDate: '2026-09-15' });
const stale = item({ title: 'Chỉ im lặng', isStale: true, silentDays: 90, updateCount: 0 });
const dueSoon = item({ title: 'Sắp đến hạn', isDueSoon: true, daysToDue: 5, dueDate: '2026-10-10', department: { id: 'kh', name: 'Phòng Kế hoạch Tổng hợp' } });
const done = item({ title: 'Đã xong', status: 'DONE', isOpen: false, directedAt: '2025-03-01', completedAt: '2025-04-01T00:00:00Z', lateDays: 0 });
const ITEMS = [done, dueSoon, stale, overdueStale];

describe('filterItems', () => {
  it('việc quá hạn mà im lặng nằm ở cả tab Quá hạn lẫn Lâu chưa cập nhật', () => {
    const { counts } = filterItems(ITEMS, { view: 'open' });
    expect(counts).toMatchObject({ open: 3, overdue: 1, dueSoon: 1, stale: 2, noUpdate: 1, done: 1, all: 4 });
    expect(filterItems(ITEMS, { view: 'stale' }).items.map((i) => i.title)).toContain('Quá hạn và im lặng');
  });

  it('lọc năm, đơn vị, tìm không dấu; số đếm tab theo cùng bộ lọc', () => {
    expect(filterItems(ITEMS, { view: 'all', year: '2025' }).items).toEqual([done]);
    const kh = filterItems(ITEMS, { view: 'open', departmentId: 'kh' });
    expect(kh.items).toEqual([dueSoon]);
    expect(kh.counts.overdue).toBe(0);
    expect(filterItems(ITEMS, { view: 'all', q: 'im lang' }).items).toHaveLength(2);
    expect(filterItems([...ITEMS, item({ department: null })], { view: 'all', departmentId: 'none' }).items).toHaveLength(1);
  });
});

describe('sortItems', () => {
  it('"cần chú ý trước": quá hạn, rồi sắp đến hạn, rồi im lặng, việc đã xong cuối', () => {
    expect(sortItems(ITEMS, 'smart').map((i) => i.title)).toEqual(['Quá hạn và im lặng', 'Sắp đến hạn', 'Chỉ im lặng', 'Đã xong']);
  });
  it('hạn gần nhất: việc không có hạn xuống cuối', () => {
    expect(sortItems(ITEMS, 'due').slice(0, 2).map((i) => i.title)).toEqual(['Quá hạn và im lặng', 'Sắp đến hạn']);
  });
});

describe('groupByUnit', () => {
  it('đơn vị có việc quá hạn lên đầu', () => {
    const groups = groupByUnit(ITEMS);
    expect(groups[0]).toMatchObject({ unit: 'Phòng Hành chính', overdue: 1 });
    expect(groups.map((g) => g.items.length)).toEqual([3, 1]);
  });
});
