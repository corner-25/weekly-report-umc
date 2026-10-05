import { describe, expect, test } from 'vitest';
import {
  buildSubmissionStrip, effectiveThread, summarizeThreads, summarizeWork, summarizeWorkByDepartment, weeksBetween,
  type ThreadSignalRow, type WorkSignalItem,
} from './department-signals';

const NOW = new Date('2026-10-05T03:00:00Z');
const day = (s: string) => new Date(`${s}T00:00:00Z`);

function work(over: Partial<WorkSignalItem> = {}): WorkSignalItem {
  return {
    status: 'IN_PROGRESS', dueDate: null, completedAt: null, lastActivityAt: day('2026-10-01'),
    directedAt: day('2026-09-01'), createdAt: day('2026-09-01'), ...over,
  };
}

function thread(over: Partial<ThreadSignalRow> = {}): ThreadSignalRow {
  return { kind: 'PROJECT', status: 'IN_PROGRESS', overrideKind: null, overrideStatus: null, needsReview: false, overriddenAt: null, lastWeek: 40, ...over };
}

describe('summarizeWork', () => {
  test('đếm việc đang thực hiện, quá hạn, sắp đến hạn, lâu chưa cập nhật', () => {
    const s = summarizeWork([
      work({ dueDate: day('2026-09-20') }), // quá hạn
      work({ dueDate: day('2026-10-20') }), // sắp đến hạn
      work({ lastActivityAt: day('2026-08-01') }), // lâu chưa cập nhật
      work({ status: 'PAUSED' }), // tạm dừng vẫn là đang thực hiện
      work({ status: 'CANCELLED', dueDate: day('2026-01-01') }), // huỷ: không quá hạn
    ], NOW);
    expect(s).toMatchObject({ total: 5, open: 4, overdue: 1, dueSoon: 1, stale: 1, cancelled: 1, done: 0 });
  });

  test('tỷ lệ hoàn thành bỏ việc huỷ khỏi mẫu số; đúng hạn chỉ xét việc xong có hạn', () => {
    const s = summarizeWork([
      work({ status: 'DONE', dueDate: day('2026-09-10'), completedAt: day('2026-09-09') }), // đúng hạn
      work({ status: 'DONE', dueDate: day('2026-09-10'), completedAt: day('2026-09-15') }), // trễ
      work({ status: 'DONE', completedAt: day('2026-09-15') }), // không hạn
      work(),
      work({ status: 'CANCELLED' }),
    ], NOW);
    expect(s.completionRate).toBe(75);
    expect(s.onTimeRate).toBe(50);
  });

  test('không có việc thì tỷ lệ là null', () => {
    expect(summarizeWork([], NOW)).toMatchObject({ total: 0, completionRate: null, onTimeRate: null });
  });
});

test('summarizeWorkByDepartment bỏ việc chưa khớp phòng', () => {
  const map = summarizeWorkByDepartment([
    { ...work(), departmentId: 'a' },
    { ...work({ status: 'DONE' }), departmentId: 'a' },
    { ...work(), departmentId: null },
  ], NOW);
  expect([...map.keys()]).toEqual(['a']);
  expect(map.get('a')).toMatchObject({ total: 2, open: 1, done: 1 });
});

describe('task threads', () => {
  test('Phòng HC sửa tay thắng AI; đã xác nhận thì hết cần xác nhận', () => {
    expect(effectiveThread(thread({ status: 'STALLED', overrideStatus: 'DONE', needsReview: true, overriddenAt: NOW }))).toEqual({
      kind: 'PROJECT', status: 'DONE', needsReview: false,
    });
  });

  test('summarizeThreads phân loại theo giá trị hiệu lực', () => {
    const s = summarizeThreads([
      thread(), // dự án đang làm
      thread({ status: 'STALLED', lastWeek: 35 }), // dự án đứng yên — vẫn tính đang làm
      thread({ kind: 'ROUTINE' }), // thường kỳ
      thread({ status: 'DONE' }),
      thread({ status: 'STOPPED', needsReview: true }),
      thread({ kind: null, status: null, lastWeek: 41 }), // chưa đánh giá
    ]);
    expect(s).toEqual({ total: 6, activeProjects: 2, routine: 1, done: 1, stalled: 1, stopped: 1, needsReview: 1, latestWeek: 41 });
  });
});

describe('buildSubmissionStrip', () => {
  const weeks = [
    { id: 'w40', year: 2026, weekNumber: 40 },
    { id: 'w39', year: 2026, weekNumber: 39 },
    { id: 'w38', year: 2026, weekNumber: 38 },
  ];

  test('cũ → mới; snapshot ưu tiên, không có thì dựa vào nhiệm vụ của phòng', () => {
    const strip = buildSubmissionStrip(weeks, new Map([['2026-40', 12]]), new Map([['w38', 5]]));
    expect(strip).toEqual([
      { year: 2026, week: 38, submitted: true, taskCount: 5 },
      { year: 2026, week: 39, submitted: false, taskCount: null },
      { year: 2026, week: 40, submitted: true, taskCount: 12 },
    ]);
  });
});

describe('weeksBetween', () => {
  test('cùng năm và qua năm', () => {
    expect(weeksBetween(202638, 202640)).toBe(2);
    expect(weeksBetween(202551, 202602)).toBe(3);
    expect(weeksBetween(202640, 202640)).toBe(0);
  });
  test('thiếu mốc thì null', () => {
    expect(weeksBetween(null, 202640)).toBeNull();
  });
});
