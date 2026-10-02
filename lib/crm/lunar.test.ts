/**
 * Test đổi âm ↔ dương lịch Việt Nam (múi giờ +7).
 *
 * Mốc kiểm chứng là các ngày lễ đã biết chắc, không tự tính: Tết Nguyên đán và
 * Tết Trung thu các năm gần đây, cùng tháng nhuận 6 năm Ất Tỵ 2025.
 */
import { describe, expect, it } from 'vitest';
import { lunarToSolar, solarToLunar } from './lunar';

const iso = (d: { day: number; month: number; year: number } | null) =>
  d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : null;

describe('lunarToSolar — Tết Nguyên đán', () => {
  it.each([
    [2023, '2023-01-22'],
    [2024, '2024-02-10'],
    [2025, '2025-01-29'],
    [2026, '2026-02-17'],
  ])('mùng 1 tháng Giêng năm %i là %s', (year, expected) => {
    expect(iso(lunarToSolar(1, 1, year))).toBe(expected);
  });
});

describe('lunarToSolar — Tết Trung thu (15/8 âm)', () => {
  it.each([
    [2024, '2024-09-17'],
    [2025, '2025-10-06'],
    [2026, '2026-09-25'],
  ])('năm %i là %s', (year, expected) => {
    expect(iso(lunarToSolar(15, 8, year))).toBe(expected);
  });
});

describe('tháng nhuận', () => {
  it('năm 2025 có tháng 6 nhuận: 1/6 nhuận khác 1/6 thường', () => {
    const normal = lunarToSolar(1, 6, 2025);
    const leap = lunarToSolar(1, 6, 2025, true);
    expect(iso(normal)).toBe('2025-06-25');
    expect(iso(leap)).toBe('2025-07-25');
  });
  it('tháng không nhuận thì trả null khi hỏi tháng nhuận', () => {
    expect(lunarToSolar(1, 5, 2025, true)).toBeNull();
  });
});

describe('solarToLunar', () => {
  it('đổi ngược đúng mùng 1 Tết 2026', () => {
    expect(solarToLunar(17, 2, 2026)).toEqual({ day: 1, month: 1, year: 2026, leap: false });
  });
  it('nhận ra ngày thuộc tháng nhuận', () => {
    expect(solarToLunar(25, 7, 2025)).toEqual({ day: 1, month: 6, year: 2025, leap: true });
  });
  it('ngày cuối năm dương vẫn thuộc năm âm trước', () => {
    expect(solarToLunar(1, 1, 2026).year).toBe(2025);
  });
});

describe('ngày 30 âm ở tháng thiếu', () => {
  it('lùi về ngày 29 thay vì nhảy sang tháng sau', () => {
    // Tháng Chạp năm Ất Tỵ (2025) chỉ có 29 ngày: 30 Tết là 29 tháng Chạp.
    const result = lunarToSolar(30, 12, 2025);
    expect(iso(result)).toBe('2026-02-16');
  });
});
