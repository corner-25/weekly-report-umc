import { describe, expect, it } from 'vitest';
import { addMonths, formatValue, monthGrid, outOfRange, parseKey, parseTime, weekdayMon0 } from './date-picker';

describe('date-utils', () => {
  it('đọc giá trị ngày, ngày giờ, giờ như ô nhập HTML', () => {
    expect(parseKey('2026-10-05')).toEqual({ y: 2026, m: 10, d: 5 });
    expect(parseKey('2026-02-30')).toBeNull();
    expect(parseKey('')).toBeNull();
    expect(parseTime('2026-10-05T15:21')).toEqual({ h: 15, min: 21 });
    expect(parseTime('08:05')).toEqual({ h: 8, min: 5 });
  });

  it('tuần bắt đầu Thứ Hai; lưới tháng 6 tuần', () => {
    expect(weekdayMon0(2026, 10, 5)).toBe(0); // 05/10/2026 là Thứ Hai
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({ y: 2026, m: 9, d: 28, inMonth: false });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it('cộng tháng qua năm', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });

  it('hiện tiếng Việt', () => {
    expect(formatValue('2026-10-05', 'date')).toBe('Thứ Hai, 05/10/2026');
    expect(formatValue('2026-10-05T15:21', 'datetime-local')).toBe('Thứ Hai, 05/10/2026 · 15:21');
    expect(formatValue('09:30', 'time')).toBe('09:30');
  });

  it('giới hạn min/max theo phần ngày', () => {
    expect(outOfRange('2026-10-04', '2026-10-05')).toBe(true);
    expect(outOfRange('2026-10-05', '2026-10-05T10:00')).toBe(false);
    expect(outOfRange('2026-10-06', undefined, '2026-10-05')).toBe(true);
  });
});
