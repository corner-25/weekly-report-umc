import { describe, expect, it } from 'vitest';
import {
  formatRange,
  hospitalWeekOf,
  hospitalWeekRange,
  isDateKey,
  storedDateKey,
  vnTodayKey,
  week1StartKey,
  weeksInYear,
} from './hospital-week';

describe('week1StartKey', () => {
  it('2026: tuần 1 bắt đầu Thứ Bảy 27/12/2025, khớp mốc neo tuần 3 = 10/01', () => {
    expect(week1StartKey(2026)).toBe('2025-12-27');
    expect(hospitalWeekRange(3, 2026).startKey).toBe('2026-01-10');
  });

  it('2027: 01/01 là Thứ Sáu nên tuần 1 bắt đầu 26/12/2026', () => {
    expect(week1StartKey(2027)).toBe('2026-12-26');
  });
});

describe('hospitalWeekRange', () => {
  it('dùng mốc neo cho 2026 và không đánh dấu ước tính', () => {
    expect(hospitalWeekRange(40, 2026)).toEqual({
      weekNumber: 40, year: 2026, startKey: '2026-09-26', endKey: '2026-10-02', isEstimated: false,
    });
  });

  it('quy tắc chung trùng khớp mốc neo ở mọi tuần 2026', () => {
    for (let w = 3; w <= 52; w += 1) {
      const anchored = hospitalWeekRange(w, 2026);
      const ruleStart = new Date(Date.UTC(2025, 11, 27 + (w - 1) * 7)).toISOString().slice(0, 10);
      expect(anchored.startKey).toBe(ruleStart);
    }
  });

  it('năm chưa có mốc neo thì suy theo quy tắc và đánh dấu ước tính', () => {
    const r = hospitalWeekRange(1, 2027);
    expect(r).toMatchObject({ startKey: '2026-12-26', endKey: '2027-01-01', isEstimated: true });
  });
});

describe('hospitalWeekOf', () => {
  it.each([
    ['2026-10-05', 41, 2026], // Thứ Hai
    ['2026-10-03', 41, 2026], // Thứ Bảy đầu tuần
    ['2026-10-02', 40, 2026], // Thứ Sáu cuối tuần trước
    ['2026-02-17', 8, 2026], // Tết
    ['2026-12-25', 52, 2026],
    ['2026-12-26', 1, 2027], // đã sang tuần 1 năm sau
  ])('%s thuộc tuần %i/%i', (key, week, year) => {
    expect(hospitalWeekOf(key)).toMatchObject({ weekNumber: week, year });
  });
});

describe('weeksInYear', () => {
  it('2026 có 52 tuần', () => {
    expect(weeksInYear(2026)).toBe(52);
  });
});

describe('storedDateKey', () => {
  it('00:00Z và 23:59Z giữ nguyên ngày UTC', () => {
    expect(storedDateKey('2026-01-10T00:00:00.000Z')).toBe('2026-01-10');
    expect(storedDateKey('2026-01-16T23:59:59.000Z')).toBe('2026-01-16');
  });

  it('17:00Z là nửa đêm giờ Việt Nam của ngày hôm sau', () => {
    expect(storedDateKey('2026-01-02T17:00:00.000Z')).toBe('2026-01-03');
  });
});

describe('tiện ích khác', () => {
  it('vnTodayKey cộng 7 giờ', () => {
    expect(vnTodayKey(new Date('2026-10-04T18:00:00Z'))).toBe('2026-10-05');
  });

  it('isDateKey loại ngày không có thật', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('abc')).toBe(false);
  });

  it('formatRange', () => {
    expect(formatRange('2026-09-26', '2026-10-02')).toBe('26/09 – 02/10/2026');
  });
});
