import { describe, expect, it } from 'vitest';
import { todayInVietnam, upcomingOccurrences } from './upcoming';

const d = (id: string, day: number, month: number, extra: Partial<{ year: number; isLunar: boolean; repeatsYearly: boolean }> = {}) => ({
  id, day, month, isLunar: false, ...extra,
});

describe('upcomingOccurrences', () => {
  it('lấy dịp trong cửa sổ và sắp theo ngày gần nhất', () => {
    const r = upcomingOccurrences([d('b', 20, 10), d('a', 5, 10), d('c', 1, 12)], '2026-10-02', 30);
    expect(r.map((o) => [o.item.id, o.date, o.daysUntil])).toEqual([
      ['a', '2026-10-05', 3],
      ['b', '2026-10-20', 18],
    ]);
  });

  it('tính dịp hôm nay là 0 ngày', () => {
    expect(upcomingOccurrences([d('a', 2, 10)], '2026-10-02', 7)[0].daysUntil).toBe(0);
  });

  it('vắt qua năm mới: 5/1 nhìn từ 28/12', () => {
    const r = upcomingOccurrences([d('a', 5, 1)], '2026-12-28', 30);
    expect(r[0].date).toBe('2027-01-05');
  });

  it('tính tuổi khi biết năm sinh', () => {
    expect(upcomingOccurrences([d('a', 5, 10, { year: 1966 })], '2026-10-02', 30)[0].years).toBe(60);
  });

  it('29/2 năm không nhuận nhắc vào 28/2', () => {
    expect(upcomingOccurrences([d('a', 29, 2)], '2027-02-20', 30)[0].date).toBe('2027-02-28');
  });

  it('đổi ngày âm sang dương của đúng năm: Rằm tháng Tám 2026 là 25/9', () => {
    expect(upcomingOccurrences([d('a', 15, 8, { isLunar: true })], '2026-09-01', 60)[0].date).toBe('2026-09-25');
  });

  it('ngày âm tháng Chạp rơi sang tháng 2 dương năm sau', () => {
    // 29 tháng Chạp năm Ất Tỵ = 16/02/2026
    const r = upcomingOccurrences([d('a', 29, 12, { isLunar: true })], '2026-01-20', 60);
    expect(r[0].date).toBe('2026-02-16');
  });

  it('dịp một lần chỉ tính đúng năm của nó', () => {
    const once = d('a', 10, 10, { year: 2025, repeatsYearly: false });
    expect(upcomingOccurrences([once], '2026-10-02', 30)).toEqual([]);
  });
});

describe('todayInVietnam', () => {
  it('23:30 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(todayInVietnam(new Date('2026-10-01T23:30:00Z'))).toBe('2026-10-02');
  });
});
