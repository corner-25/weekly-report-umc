/**
 * Test cho các hàm làm sạch dữ liệu tổ xe.
 *
 * Đây là những hàm quyết định 14.183 chuyến xe được hiểu thế nào — đọc sai một
 * con số là sai cả thống kê. Chúng đều là hàm thuần nên test rẻ.
 *
 * Phần lớn ca test dưới đây lấy từ dữ liệu thật đã gây lỗi, không phải ví dụ
 * bịa: tài xế nhập "45.000km", "50,000", ô trống, hay chữ lẫn số.
 */
import { describe, expect, it } from 'vitest';
import { checkOdometerSequence, parseFuelLiters, parseOdometer } from './cleaning';

describe('parseOdometer', () => {
  it('đọc số nguyên bình thường', () => {
    expect(parseOdometer('45000')).toBe(45000);
    expect(parseOdometer(45000)).toBe(45000);
  });

  it('bỏ dấu ngăn hàng nghìn, cả chấm lẫn phẩy', () => {
    expect(parseOdometer('45.000')).toBe(45000);
    expect(parseOdometer('50,000')).toBe(50000);
    expect(parseOdometer('123.456')).toBe(123456);
  });

  it('đọc được khi tài xế viết kèm đơn vị', () => {
    expect(parseOdometer('45000km')).toBe(45000);
    expect(parseOdometer('45.000 km')).toBe(45000);
  });

  it('trả null khi ô trống hoặc không có số', () => {
    expect(parseOdometer('')).toBeNull();
    expect(parseOdometer('   ')).toBeNull();
    expect(parseOdometer(null)).toBeNull();
    expect(parseOdometer(undefined)).toBeNull();
    expect(parseOdometer('không nhớ')).toBeNull();
  });

  it('chỉ nhận số ở ĐẦU chuỗi, không nhặt số giữa câu', () => {
    // "xe số 3" không phải chỉ số công-tơ-mét bằng 3.
    expect(parseOdometer('xe số 3')).toBeNull();
  });
});

describe('parseFuelLiters', () => {
  it('đọc số lít có phần thập phân', () => {
    expect(parseFuelLiters('45.5')).toBeCloseTo(45.5);
    expect(parseFuelLiters(30)).toBe(30);
  });

  it('ô trống trả 0 — không có đổ xăng nghĩa là 0 lít', () => {
    expect(parseFuelLiters('')).toBe(0);
    expect(parseFuelLiters(null)).toBe(0);
  });
});

describe('checkOdometerSequence', () => {
  /**
   * Dựng một chuyến, chỉ khai phần cần cho ca test.
   *
   * `hasRawValue` phân biệt hai loại thiếu số: ô trống hẳn (tài xế không ghi —
   * chấp nhận được) và ô có chữ nhưng không đọc ra số (nhập sai — cần rà soát).
   */
  const trip = (
    vehicleId: string,
    sequence: number,
    odometer: number | null,
    hasRawValue = odometer !== null,
  ) => ({ vehicleId, sequence, odometer, hasRawValue });

  it('chuyến đầu của mỗi xe không có gì để so', () => {
    const result = checkOdometerSequence([trip('50A-001.11', 1, 10000)]);
    expect(result[0].status).toBe('NO_PREVIOUS');
  });

  it('số tăng dần là hợp lệ', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 10000),
      trip('50A-001.11', 2, 10150),
      trip('50A-001.11', 3, 10300),
    ]);
    expect(result.map((r) => r.status)).toEqual(['NO_PREVIOUS', 'OK', 'OK']);
    expect(result[1].delta).toBe(150);
  });

  it('số lùi là bất thường — công-tơ-mét không quay ngược', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 10000),
      trip('50A-001.11', 2, 9000),
    ]);
    expect(result[1].status).toBe('DECREASED');
  });

  it('mỗi xe tính riêng, không lẫn sang xe khác', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 90000),
      trip('50B-002.22', 2, 500),
    ]);
    // Xe thứ hai bắt đầu ở 500 nhưng đó là chuyến đầu CỦA NÓ, không phải lùi.
    expect(result[1].status).toBe('NO_PREVIOUS');
  });

  it('ba lần lùi liên tiếp nghĩa là thay công-tơ-mét, nhận mốc mới', () => {
    // Sau khi thay đồng hồ, số bắt đầu lại từ thấp và tiếp tục tăng. Nếu vẫn so
    // với mốc cũ thì mọi chuyến sau đều bị đánh dấu sai.
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 200000),
      trip('50A-001.11', 2, 100),
      trip('50A-001.11', 3, 250),
      trip('50A-001.11', 4, 400),
      trip('50A-001.11', 5, 550),
    ]);
    expect(result[4].status).toBe('OK');
  });

  it('ô có chữ nhưng không ra số thì đánh dấu UNPARSED, không coi là lùi', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 10000),
      trip('50A-001.11', 2, null, true), // tài xế viết "không nhớ"
    ]);
    expect(result[1].status).toBe('UNPARSED');
  });

  it('ô trống hẳn thì bỏ qua — tài xế không bắt buộc ghi mỗi chuyến', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 10000),
      trip('50A-001.11', 2, null, false),
    ]);
    expect(result[1].status).toBe('OK');
  });

  it('chuyến thiếu số không phá mốc so sánh của chuyến sau', () => {
    const result = checkOdometerSequence([
      trip('50A-001.11', 1, 10000),
      trip('50A-001.11', 2, null, false),
      trip('50A-001.11', 3, 10200),
    ]);
    // Vẫn so với 10.000 của chuyến 1, không phải "không có gì để so".
    expect(result[2].status).toBe('OK');
    expect(result[2].delta).toBe(200);
  });
});
