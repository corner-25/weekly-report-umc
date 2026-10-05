import { describe, expect, test } from 'vitest';
import { ATTENTION_LIMIT, buildThreadSection, buildWorkSection, monthsBack, MONTHS_SHOWN, type ProfileThreadRow, type ProfileWorkRow } from './department-profile-sections';

const NOW = new Date('2026-10-05T03:00:00Z');
const day = (s: string) => new Date(`${s}T00:00:00Z`);
let seq = 0;

function item(over: Partial<ProfileWorkRow> = {}): ProfileWorkRow {
  seq += 1;
  return {
    id: `w${seq}`, title: `Việc ${seq}`, kind: 'DIRECTIVE', priority: 'NORMAL', status: 'IN_PROGRESS',
    departmentId: 'd', departmentName: 'Phòng A', leadUnit: null, directedBy: null,
    directedAt: day('2026-09-01'), createdAt: day('2026-09-01'), dueDate: null, completedAt: null,
    lastActivityAt: day('2026-10-01'), progressPercent: null, tags: [], ...over,
  };
}

test('monthsBack lùi đúng số tháng, qua năm', () => {
  expect(monthsBack(NOW, 0)).toBe('2026-10');
  expect(monthsBack(NOW, 11)).toBe('2025-11');
});

describe('buildWorkSection', () => {
  test('danh sách cần chú ý: quá hạn nặng nhất lên trước, lâu chưa cập nhật không lặp việc quá hạn', () => {
    const a = item({ dueDate: day('2026-09-30') });
    const b = item({ dueDate: day('2026-08-01'), lastActivityAt: day('2026-07-01') });
    const c = item({ lastActivityAt: day('2026-08-01') });
    const d = item({ lastActivityAt: null, directedAt: day('2026-06-01') });
    const soon = item({ dueDate: day('2026-10-10') });
    const s = buildWorkSection([a, b, c, d, soon], NOW);
    expect(s.lists.overdue.map((x) => x.id)).toEqual([b.id, a.id]);
    // Chưa từng cập nhật lên đầu, rồi việc im lâu nhất.
    expect(s.lists.stale.map((x) => x.id)).toEqual([d.id, c.id]);
    expect(s.lists.dueSoon.map((x) => x.id)).toEqual([soon.id]);
    expect(s.lists.overdue[0].dueDate).toBe('2026-08-01');
  });

  test('mới hoàn thành xếp theo ngày xong, giới hạn số dòng', () => {
    const done = Array.from({ length: ATTENTION_LIMIT + 2 }, (_, i) =>
      item({ status: 'DONE', completedAt: day(`2026-09-${String(i + 10).padStart(2, '0')}`) }),
    );
    const s = buildWorkSection(done, NOW);
    expect(s.lists.recentDone).toHaveLength(ATTENTION_LIMIT);
    expect(s.lists.recentDone[0].id).toBe(done[done.length - 1].id);
    expect(s.kpi.completionRate).toBe(100);
  });

  test('biểu đồ tháng đủ 12 tháng gần nhất', () => {
    const s = buildWorkSection([item()], NOW);
    expect(s.monthly).toHaveLength(MONTHS_SHOWN);
    expect(s.monthly[s.monthly.length - 1].month).toBe('2026-10');
  });
});

function thread(over: Partial<ProfileThreadRow> = {}): ProfileThreadRow {
  seq += 1;
  return {
    id: `t${seq}`, title: `Nhiệm vụ ${seq}`, kind: 'PROJECT', status: 'IN_PROGRESS', overrideKind: null, overrideStatus: null,
    progress: 50, overrideProgress: null, firstWeek: 30, lastWeek: 40, completedWeek: null, needsReview: false, overriddenAt: null, ...over,
  };
}

describe('buildThreadSection', () => {
  test('tách việc có tiến độ, cần xác nhận và mới xong; thường kỳ không có %', () => {
    const p = thread({ progress: 40 });
    const r = thread({ needsReview: true });
    const routine = thread({ kind: 'ROUTINE', progress: 100 });
    const done = thread({ status: 'DONE', completedWeek: null, lastWeek: 39 });
    const s = buildThreadSection([p, r, routine, done], 2026);
    expect(s.projects.map((t) => t.id)).toEqual([p.id]);
    expect(s.review.map((t) => t.id)).toEqual([r.id]);
    expect(s.recentDone[0]).toMatchObject({ id: done.id, completedWeek: 39 });
    expect(s.summary).toMatchObject({ total: 4, routine: 1, needsReview: 1, done: 1 });
  });

  test('% sửa tay thắng % của AI', () => {
    const s = buildThreadSection([thread({ progress: 40, overrideProgress: 80 })], 2026);
    expect(s.projects[0].progress).toBe(80);
  });
});
