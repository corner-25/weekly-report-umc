import { describe, expect, it } from 'vitest';
import { parseRevenueVnd } from '@/lib/fleet/cleaning';

/**
 * Doanh thu là ô nhập tự do, mỗi tài xế gõ một kiểu. Hàm toNumber cũ chỉ xoá
 * dấu phẩy nên đọc "470.000" thành 470 — đúng các giá trị 470/518/542/1.31 đã
 * lọt vào database. Bộ test này khoá lại quy tắc phân biệt dấu.
 */
describe('parseRevenueVnd', () => {
  it('đọc dấu chấm làm phân cách nghìn (kiểu Việt Nam)', () => {
    expect(parseRevenueVnd('470.000')).toBe(470_000);
    expect(parseRevenueVnd('300.000')).toBe(300_000);
    expect(parseRevenueVnd('1.310.000')).toBe(1_310_000);
    expect(parseRevenueVnd('2.000.000')).toBe(2_000_000);
    expect(parseRevenueVnd('20.300.000')).toBe(20_300_000);
  });

  it('đọc dấu phẩy làm phân cách nghìn (kiểu Mỹ)', () => {
    expect(parseRevenueVnd('470,000')).toBe(470_000);
    expect(parseRevenueVnd('1,310,000')).toBe(1_310_000);
  });

  it('một dấu theo sau đúng 3 chữ số luôn là nghìn, không phải thập phân', () => {
    // Tiền VNĐ không lẻ tới phần nghìn nên "1.310" là một nghìn ba trăm mười.
    expect(parseRevenueVnd('1.310')).toBe(1_310);
    expect(parseRevenueVnd('1,310')).toBe(1_310);
  });

  it('có cả hai dấu thì dấu đứng sau là thập phân', () => {
    expect(parseRevenueVnd('1.310.000,50')).toBe(1_310_000.5);
    expect(parseRevenueVnd('1,310,000.50')).toBe(1_310_000.5);
  });

  it('1-2 chữ số sau dấu là thập phân thật', () => {
    expect(parseRevenueVnd('470.5')).toBe(470.5);
  });

  it('đọc số thuần và số sẵn kiểu number', () => {
    expect(parseRevenueVnd('470000')).toBe(470_000);
    expect(parseRevenueVnd(470_000)).toBe(470_000);
    expect(parseRevenueVnd('0')).toBe(0);
  });

  it('bỏ hậu tố tiền tệ', () => {
    expect(parseRevenueVnd('470.000 VNĐ')).toBe(470_000);
    expect(parseRevenueVnd('470000đ')).toBe(470_000);
    expect(parseRevenueVnd('470.000₫')).toBe(470_000);
  });

  it('hiểu hậu tố viết tắt k / tr', () => {
    expect(parseRevenueVnd('470k')).toBe(470_000);
    expect(parseRevenueVnd('1.5tr')).toBe(1_500_000);
  });

  it('trả null cho ô trống hoặc không phải số', () => {
    expect(parseRevenueVnd('')).toBeNull();
    expect(parseRevenueVnd('nan')).toBeNull();
    expect(parseRevenueVnd('-')).toBeNull();
    expect(parseRevenueVnd('abc')).toBeNull();
    expect(parseRevenueVnd(null)).toBeNull();
    expect(parseRevenueVnd(undefined)).toBeNull();
  });

  it('trả null khi hình dạng mơ hồ, không đoán bừa', () => {
    expect(parseRevenueVnd('1.31.0')).toBeNull();
    expect(parseRevenueVnd('470.0000')).toBeNull();
  });

  it('từ chối số âm', () => {
    expect(parseRevenueVnd('-470000')).toBeNull();
    expect(parseRevenueVnd(-1)).toBeNull();
  });

  it('không lặp lại lỗi cũ của toNumber', () => {
    // Regression: các giá trị này từng bị ghi sai vào database.
    expect(parseRevenueVnd('470.000')).not.toBe(470);
    expect(parseRevenueVnd('1.310')).not.toBe(1.31);
    expect(parseRevenueVnd('2.000.000')).not.toBeNull();
  });
});
