import { describe, expect, it } from 'vitest';
import { daysFromToday, formatLargeNumbersVi, isEffectivelyEmpty, serialize } from './pipeline';

const NOW = new Date('2026-09-30T03:00:00Z'); // 10:00 giờ VN

describe('serialize — tính sẵn số ngày cho cột mốc hạn', () => {
  it('ghi rõ đã quá hạn thay vì để model tự nhẩm', () => {
    const row = serialize({ license_plate: '50A-018.35', inspection_expiry: new Date('2026-09-03T00:00:00Z') }, '', NOW);
    expect(row).toEqual({ license_plate: '50A-018.35', inspection_expiry: '2026-09-03 (đã quá 27 ngày)' });
  });

  it('ghi còn N ngày cho mốc tương lai và "hôm nay" cho mốc trùng ngày', () => {
    expect(serialize(new Date('2026-10-10T00:00:00Z'), 'expiry_date', NOW)).toBe('2026-10-10 (còn 10 ngày)');
    expect(serialize(new Date('2026-09-30T00:00:00Z'), 'deadline', NOW)).toBe('2026-09-30 (hôm nay)');
  });

  it('không gắn chú thích cho cột ngày thường', () => {
    expect(serialize(new Date('2026-09-26T00:00:00Z'), 'week_start', NOW)).toBe('2026-09-26');
  });

  it('tính theo lịch Việt Nam, không lệch ngày do múi giờ', () => {
    // 23:30 UTC ngày 29 = 06:30 sáng 30/09 giờ VN -> vẫn là "hôm nay"
    expect(daysFromToday(new Date('2026-09-29T23:30:00Z'), NOW)).toBe(0);
  });

  it('đổi bigint sang number', () => {
    expect(serialize({ n: BigInt(5) })).toEqual({ n: 5 });
  });
});

describe('isEffectivelyEmpty', () => {
  it('coi 1 dòng toàn NULL (SUM trên tập rỗng) là không có dữ liệu', () => {
    expect(isEffectivelyEmpty([{ active_trainees: null }])).toBe(true);
    expect(isEffectivelyEmpty([])).toBe(true);
  });
  it('dòng có giá trị, kể cả 0, là có dữ liệu', () => {
    expect(isEffectivelyEmpty([{ total: 0 }])).toBe(false);
    expect(isEffectivelyEmpty([{ a: null, b: 'x' }])).toBe(false);
  });
});

describe('serialize — an toàn khi dùng trong Array.map', () => {
  it('rows.map(r => serialize(r)) gắn đúng số ngày', () => {
    const rows = [{ inspection_expiry: new Date('2026-09-03T00:00:00Z') }];
    const out = rows.map((r) => serialize(r, '', NOW));
    expect(out[0]).toEqual({ inspection_expiry: '2026-09-03 (đã quá 27 ngày)' });
  });
  it('ngày không hợp lệ trả null thay vì làm sập câu trả lời', () => {
    expect(serialize(new Date('không phải ngày'), 'expiry_date', NOW)).toBeNull();
  });
});

describe('serialize — kiểu Decimal của Prisma', () => {
  it('đổi Decimal thành số thay vì {"s":1,"e":0,"d":[...]}', () => {
    const fakeDecimal = { s: 1, e: 0, d: [5, 6000000], toNumber: () => 5.6 };
    expect(serialize({ change_pct: fakeDecimal })).toEqual({ change_pct: 5.6 });
  });
});

describe('formatLargeNumbersVi', () => {
  it('viết sẵn số lớn kiểu Việt, giữ nguyên năm và số nhỏ', () => {
    expect(formatLargeNumbersVi([{ year: 2026, week_number: 39, value: 49004000, ratio: 22.9 }])).toEqual([
      { year: 2026, week_number: 39, value: '49.004.000', ratio: 22.9 },
    ]);
  });
});
