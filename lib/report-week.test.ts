/**
 * Test suy ngày tuần báo cáo.
 *
 * Hàm này từng neo sai mốc hai lần trước khi đúng — neo vào tuần 1 lệch một
 * ngày, neo vào tuần 2 cũng lệch một ngày, phải tới tuần 3 mới khớp. Sai một
 * ngày là tuần mới tạo ra chồng lấn hoặc hụt so với tuần trước.
 *
 * Các mốc dưới đây lấy từ 9 tuần có thật trong hệ thống, trải từ tháng 1 đến
 * tháng 5/2026.
 */
import { describe, expect, it } from 'vitest';
import { computeWeekDates, hasWeekAnchor } from './report-week';

/** Rút Date về chuỗi YYYY-MM-DD cho dễ so sánh. */
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('computeWeekDates', () => {
  it.each([
    [3, '2026-01-10', '2026-01-16'],
    [4, '2026-01-17', '2026-01-23'],
    [5, '2026-01-24', '2026-01-30'],
    [6, '2026-01-31', '2026-02-06'],
    [7, '2026-02-07', '2026-02-13'],
    [17, '2026-04-18', '2026-04-24'],
    [18, '2026-04-25', '2026-05-01'],
    [21, '2026-05-16', '2026-05-22'],
    [22, '2026-05-23', '2026-05-29'],
  ])('tuần %i khớp dữ liệu thật trong hệ thống', (week, start, end) => {
    const dates = computeWeekDates(week, 2026)!;
    expect(iso(dates.startDate)).toBe(start);
    expect(iso(dates.endDate)).toBe(end);
  });

  it('tuần kế tiếp nối liền tuần trước, không chồng lấn hay hụt', () => {
    for (let w = 3; w < 40; w += 1) {
      const current = computeWeekDates(w, 2026)!;
      const next = computeWeekDates(w + 1, 2026)!;
      const gapDays =
        (next.startDate.getTime() - current.endDate.getTime()) / 86_400_000;
      expect(gapDays).toBe(1);
    }
  });

  it('mỗi tuần đúng 7 ngày', () => {
    const dates = computeWeekDates(20, 2026)!;
    const days =
      (dates.endDate.getTime() - dates.startDate.getTime()) / 86_400_000 + 1;
    expect(days).toBe(7);
  });

  it('bắt đầu Thứ Bảy, kết thúc Thứ Sáu', () => {
    const dates = computeWeekDates(20, 2026)!;
    expect(dates.startDate.getUTCDay()).toBe(6); // Thứ Bảy
    expect(dates.endDate.getUTCDay()).toBe(5); // Thứ Sáu
  });

  it('không lưu lệch ngày do múi giờ Việt Nam', () => {
    // new Date(2026, 0, 10) ở UTC+7 lưu thành 2026-01-09T17:00Z.
    const dates = computeWeekDates(3, 2026)!;
    expect(dates.startDate.toISOString()).toBe('2026-01-10T00:00:00.000Z');
  });

  it('trả null khi chưa biết mốc của năm đó', () => {
    expect(computeWeekDates(5, 2027)).toBeNull();
    expect(hasWeekAnchor(2027)).toBe(false);
    expect(hasWeekAnchor(2026)).toBe(true);
  });
});
