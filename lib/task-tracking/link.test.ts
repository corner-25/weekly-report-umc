import { describe, expect, it } from 'vitest';
import { linkWeek, type OpenThread, type ReportRow } from './link';
import { computeProfile } from './profile';

const row = (week: number, sourceRow: number, rawName: string, resultText: string, progress: number | null = null): ReportRow => ({
  week, sourceRow, rawName, parentGroup: null, resultText, progress,
});

/** Chạy liên tiếp nhiều tuần, trả về khoá việc của từng dòng theo thứ tự. */
function run(weeks: ReportRow[][]): string[][] {
  let open: OpenThread[] = [];
  let n = 0;
  return weeks.map((rows) => {
    const r = linkWeek(rows, open, rows[0].week, () => `t${++n}`);
    open = r.open;
    return rows.map((x) => r.assignments.find((a) => a.row.sourceRow === x.sourceRow)!.threadKey);
  });
}

describe('linkWeek', () => {
  it('cùng tên nhiệm vụ nhưng sang việc khác thì tách việc mới (Bảo hiểm Y tế)', () => {
    const name = 'Giám định chi phí KCB BHYT';
    const keys = run([
      [row(12, 5, name, 'Thống nhất biên bản Giám định quý 4/2025', 80)],
      [row(13, 5, name, 'Thống nhất biên bản Giám định quý 4/2025', 80)],
      [row(16, 6, name, 'Chuẩn bị hồ sơ tiếp đoàn Giám định BHXH quý 1/2026', 10)],
      [row(17, 6, name, 'Chuẩn bị hồ sơ tiếp đoàn Giám định BHXH quý 1/2026', 20)],
    ]);
    expect(keys[0][0]).toBe(keys[1][0]);
    expect(keys[2][0]).not.toBe(keys[1][0]);
    expect(keys[3][0]).toBe(keys[2][0]);
  });

  it('việc thường kỳ đổi số liệu mỗi tuần vẫn là một việc (Điều dưỡng)', () => {
    const name = 'Giám sát chuyên môn';
    const keys = run([
      [row(36, 9, name, '* Giám sát quy trình kỹ thuật ĐD - Số khoa/đơn vị giám sát: 23 - Số lượt giám sát: 410', 100)],
      [row(37, 9, name, '* Giám sát quy trình kỹ thuật ĐD - Số khoa/đơn vị giám sát: 21 - Số lượt giám sát: 388', 100)],
    ]);
    expect(keys[1][0]).toBe(keys[0][0]);
  });

  it('vắng quá 4 tuần thì không nối lại', () => {
    const keys = run([[row(1, 3, 'Hội nghị', 'Tổ chức hội nghị khoa học')], [row(8, 3, 'Hội nghị', 'Tổ chức hội nghị khoa học')]]);
    expect(keys[1][0]).not.toBe(keys[0][0]);
  });

  it('hai dòng cùng tuần không nối chung một việc', () => {
    const keys = run([
      [row(5, 1, 'Văn bản', 'Soạn thảo quy chế làm việc')],
      [row(6, 1, 'Văn bản', 'Soạn thảo quy chế làm việc'), row(6, 2, 'Văn bản', 'Soạn thảo quy chế làm việc (bản 2)')],
    ]);
    expect(new Set(keys[1]).size).toBe(2);
    expect(keys[1]).toContain(keys[0][0]);
  });
});

describe('computeProfile', () => {
  it('phòng không ghi %', () => {
    expect(computeProfile([{ progresses: [null, null, null] }, { progresses: [null] }]).style).toBe('NO_PERCENT');
  });
  it('phòng ghi 100% mọi tuần', () => {
    expect(computeProfile([{ progresses: [100, 100, 100] }, { progresses: [100, 100] }]).style).toBe('ALWAYS_100');
  });
  it('phòng ghi % tiến độ thật', () => {
    const s = computeProfile([{ progresses: [10, 20, 30, 50] }, { progresses: [80, 80, 80] }, { progresses: [50, 100] }]);
    expect(s.style).toBe('PROGRESSIVE');
    expect(s.stuck).toBeGreaterThan(0);
  });
});

import { applyRules } from './rules';

describe('applyRules', () => {
  const entries = (ps: Array<number | null>, from = 30) => ps.map((p, i) => ({ week: from + i, progress: p, resultText: 'x', nextWeekPlan: null, timePeriod: null }));
  const j = (over: Record<string, unknown> = {}) => ({ id: 'a', ten_ngan: 'Việc A', loai: 'PROJECT' as const, tinh_trang: 'IN_PROGRESS' as const, tien_do: 50, do_tin_cay: 0.9, ...over });

  it('việc thường kỳ không giữ %', () => {
    expect(applyRules(j({ loai: 'ROUTINE', tien_do: 100 }), entries([100, 100]), 'ALWAYS_100', 31).progress).toBeNull();
  });
  it('phòng ghi % thật, lần cuối 100% → xong', () => {
    const r = applyRules(j(), entries([50, 80, 100]), 'PROGRESSIVE', 32);
    expect(r).toMatchObject({ status: 'DONE', progress: 100, completedWeek: 32 });
  });
  it('phòng ghi 100% mọi tuần thì 100 không có nghĩa là xong', () => {
    expect(applyRules(j(), entries([100, 100]), 'ALWAYS_100', 31).status).toBe('IN_PROGRESS');
  });
  it('% đứng yên 6 lần liên tiếp → đứng yên', () => {
    expect(applyRules(j({ tien_do: 80 }), entries([80, 80, 80, 80, 80, 80]), 'MIXED', 35).status).toBe('STALLED');
  });
  it('còn báo cáo tuần mới nhất thì không thể là ngừng báo cáo', () => {
    expect(applyRules(j({ tinh_trang: 'STOPPED' }), entries([10, 20]), 'PROGRESSIVE', 31).status).toBe('IN_PROGRESS');
  });
  it('ngừng báo cáo thì cần người xác nhận', () => {
    expect(applyRules(j({ tinh_trang: 'STOPPED' }), entries([10, 20]), 'PROGRESSIVE', 40).needsReview).toBe(true);
  });
});

describe('wordSet', () => {
  it('giữ số định danh kỳ và văn bản, bỏ số liệu', async () => {
    const { wordSet } = await import('./link');
    expect([...wordSet('Thống nhất biên bản Giám định quý 3/2025')]).toEqual(expect.arrayContaining(['quy3', 'y2025']));
    expect(wordSet('Số khoa giám sát: 23').has('23')).toBe(false);
    expect(wordSet('Phản hồi công văn số 199/BHXH').has('so199')).toBe(true);
  });
  it('biên bản quý 3 và quý 4 là hai việc', () => {
    const name = 'Giám định chi phí KCB BHYT';
    const keys = run([
      [row(1, 5, name, 'Thống nhất biên bản Giám định quý 3/2025', 80)],
      [row(2, 5, name, 'Thống nhất biên bản Giám định quý 4/2025', 80)],
    ]);
    expect(keys[1][0]).not.toBe(keys[0][0]);
  });
});

describe('luồng thường kỳ', () => {
  it('cùng tên nhiệm vụ đã quyết là thường kỳ thì nối mọi tuần, kể cả nhiều dòng một tuần', () => {
    let open: OpenThread[] = [];
    let n = 0;
    const routine = new Set(['quan ly van ban di, den']);
    const w1 = linkWeek([row(14, 1, 'Quản lý văn bản đi, đến', 'Phát hành 95 hợp đồng')], open, 14, () => `t${++n}`, routine);
    open = w1.open;
    const w2 = linkWeek(
      [row(19, 1, 'Quản lý văn bản đi, đến', 'Tiếp nhận 338 văn bản đến'), row(19, 2, 'Quản lý văn bản đi, đến', 'Rà soát sổ công văn')],
      open, 19, () => `t${++n}`, routine,
    );
    expect(new Set(w2.assignments.map((a) => a.threadKey))).toEqual(new Set([w1.assignments[0].threadKey]));
    expect(w2.assignments.every((a) => !a.isNew)).toBe(true);
  });
});

describe('readableTimePeriod', () => {
  it('đổi số ngày Excel ra ngày', async () => {
    const { readableTimePeriod } = await import('./pipeline');
    expect(readableTimePeriod('46120')).toBe('08/04/2026');
    expect(readableTimePeriod('Tuần 13/2026')).toBe('Tuần 13/2026');
    expect(readableTimePeriod('')).toBeNull();
  });
});
