/**
 * Test chuẩn hoá biển số.
 *
 * Hàm này quyết định 14.183 chuyến xe nối vào hồ sơ nào. Các ca test dùng đúng
 * những cách viết có thật trong dữ liệu, không phải ví dụ bịa.
 */
import { describe, expect, it } from 'vitest';
import { extractPlate, isSamePlate, normalizePlate } from './plate';

describe('normalizePlate', () => {
  it('bỏ mọi ký tự ngăn cách', () => {
    expect(normalizePlate('50A-007.39')).toBe('50A00739');
    expect(normalizePlate('50A-007-39')).toBe('50A00739');
    expect(normalizePlate('50A00739')).toBe('50A00739');
    expect(normalizePlate('50A 007 39')).toBe('50A00739');
  });

  it('bỏ dấu cách thừa — có thật trong hồ sơ: "50A- 004-55"', () => {
    expect(normalizePlate('50A- 004-55')).toBe('50A00455');
    expect(normalizePlate('51A -40-66')).toBe('51A4066');
    expect(normalizePlate('51 D 2150')).toBe('51D2150');
  });

  it('viết hoa để không phân biệt hoa thường', () => {
    expect(normalizePlate('50a-007.39')).toBe('50A00739');
  });
});

describe('isSamePlate', () => {
  it('nhận ra cùng một xe qua ba cách viết khác nhau', () => {
    expect(isSamePlate('50A-007.39', '50A-007-39')).toBe(true);
    expect(isSamePlate('50A-004.55', '50A- 004-55')).toBe(true);
    expect(isSamePlate('51A-1212', '51A-12-12')).toBe(true);
  });

  it('không gộp nhầm hai xe khác nhau', () => {
    expect(isSamePlate('50A-032.80', '50A-032.81')).toBe(false);
    expect(isSamePlate('50A-007.39', '50A-007.30')).toBe(false);
  });
});

describe('extractPlate', () => {
  it('tìm được biển số giữa câu', () => {
    expect(extractPlate('Giấy phép đèn còi ưu tiên - 50M-002.19 (TOYOTA)')).toBe(
      '50M-002.19',
    );
    expect(extractPlate('Cavet xe - 51B-509.51 (HYUNDAI GRAND)')).toBe('51B-509.51');
  });

  it('trả null khi câu không có biển số', () => {
    expect(extractPlate('Giấy phép kinh doanh vận tải')).toBeNull();
  });

  it('biển số tìm được khớp với biển số trong hồ sơ dù khác cách viết', () => {
    const found = extractPlate('Cavet xe - 50A-032.81 (TOYOTA FORTUNER)');
    expect(found).not.toBeNull();
    expect(isSamePlate(found!, '50A-032-81')).toBe(true);
  });
});
