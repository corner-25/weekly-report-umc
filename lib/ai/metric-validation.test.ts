/**
 * Test bộ kiểm tra số liệu.
 *
 * Mọi ca test dưới đây là lỗi CÓ THẬT đã gặp trong 35 tuần dữ liệu, không phải
 * ví dụ bịa. Mục đích là chặn chúng tái diễn.
 */
import { describe, expect, it } from 'vitest';
import {
  validateMetric,
  validateMetricGroup,
  type MetricInput,
} from './metric-validation';

/** Dựng một số liệu, chỉ khai phần cần cho ca test. */
const metric = (over: Partial<MetricInput> = {}): MetricInput => ({
  name: 'Chỉ số thử',
  value: 100,
  unit: 'lượt',
  sourceText: 'Chỉ số thử: 100 lượt',
  ...over,
});

const flags = (issues: ReturnType<typeof validateMetric>) =>
  issues.map((i) => i.flag);

describe('mảnh ngày tháng', () => {
  it('bắt được ngày bị tách thành chỉ số', () => {
    // Có thật: "31/12/2025" thành ba bản ghi 31 ngày, 12 tháng, 2025 năm.
    const src = 'Hoàn thành biên bản đối chiếu công nợ thời điểm 31/12/2025';
    expect(flags(validateMetric(metric({ value: 31, unit: 'ngày', sourceText: src }))))
      .toContain('DATE_FRAGMENT');
    expect(flags(validateMetric(metric({ value: 12, unit: 'tháng', sourceText: src }))))
      .toContain('DATE_FRAGMENT');
    expect(flags(validateMetric(metric({ value: 2025, unit: 'năm', sourceText: src }))))
      .toContain('DATE_FRAGMENT');
  });

  it('KHÔNG bắt nhầm số liệu thật mang đơn vị ngày', () => {
    // "3 ngày" ở đây là thời gian xử lý, không phải ngày trong tháng.
    const issues = validateMetric(
      metric({
        value: 3,
        unit: 'ngày',
        sourceText: 'Thời gian xử lý trung bình: 3 ngày',
      }),
    );
    expect(flags(issues)).not.toContain('DATE_FRAGMENT');
  });

  it('KHÔNG bắt nhầm khi giá trị không khớp thành phần nào của ngày', () => {
    const issues = validateMetric(
      metric({
        value: 45,
        unit: 'ngày',
        sourceText: 'Tính đến 31/12/2025, tồn đọng 45 ngày',
      }),
    );
    expect(flags(issues)).not.toContain('DATE_FRAGMENT');
  });
});

describe('số lấy từ mệnh đề so sánh', () => {
  it('bắt được phần trăm trong ngoặc so sánh', () => {
    // Có thật: "2.800.000 đồng (tăng 2% so với...)" sinh thêm bản ghi 2%.
    const issues = validateMetric(
      metric({
        value: 2,
        unit: '%',
        sourceText: 'chi phí quản lý: 2.800.000 đồng (tăng 2% so với tuần trước)',
      }),
    );
    expect(flags(issues)).toContain('COMPARISON_VALUE');
  });

  it('KHÔNG bắt nhầm tỷ lệ thật', () => {
    const issues = validateMetric(
      metric({
        value: 100,
        unit: '%',
        sourceText: 'Tỷ lệ tuân thủ nhận dạng người bệnh: 100%',
      }),
    );
    expect(flags(issues)).not.toContain('COMPARISON_VALUE');
  });
});

describe('lệch so với lịch sử', () => {
  const history = { median: 1000, count: 20 };

  it('bắt giá trị cao gấp nhiều lần — nghi thừa chữ số', () => {
    const issues = validateMetric(metric({ value: 50_000 }), history);
    expect(flags(issues)).toContain('OUTLIER_HIGH');
  });

  it('bắt giá trị thấp bất thường — nghi thiếu chữ số', () => {
    // Có thật: "170.00km" thay vì "170.000km" giữa chuỗi đang ở 165.000.
    const issues = validateMetric(metric({ value: 50 }), history);
    expect(flags(issues)).toContain('OUTLIER_LOW');
  });

  it('dao động bình thường thì không báo', () => {
    expect(flags(validateMetric(metric({ value: 1200 }), history))).toHaveLength(0);
    expect(flags(validateMetric(metric({ value: 700 }), history))).toHaveLength(0);
  });

  it('lịch sử quá ngắn thì không kết luận', () => {
    const issues = validateMetric(metric({ value: 50_000 }), { median: 1000, count: 2 });
    expect(flags(issues)).not.toContain('OUTLIER_HIGH');
  });

  it('giá trị 0 không bị coi là thấp bất thường', () => {
    // "0 gói thầu thông qua tuần này" là số liệu hợp lệ.
    const issues = validateMetric(metric({ value: 0 }), history);
    expect(flags(issues)).not.toContain('OUTLIER_LOW');
  });
});

describe('kiểm tra cả nhóm', () => {
  it('bắt hai giá trị cùng mốc chênh nhau nhiều lần', () => {
    // Có thật: tồn kho ghi hai dòng cùng ngày 08/01/2026.
    const issues = validateMetricGroup([
      metric({ name: 'Tồn kho', value: 352_663_324, asOfDate: '2026-01-08' }),
      metric({ name: 'Tồn kho', value: 5_352_597_477, asOfDate: '2026-01-08' }),
    ]);
    expect(issues.get(0)?.map((i) => i.flag)).toContain('MIXED_SCALE');
    expect(issues.get(1)?.map((i) => i.flag)).toContain('MIXED_SCALE');
  });

  it('bắt hai giá trị cùng mốc lệch ít — cần xác định cái nào đúng', () => {
    const issues = validateMetricGroup([
      metric({ name: 'Số ca', value: 109, asOfDate: '2026-03-01' }),
      metric({ name: 'Số ca', value: 110, asOfDate: '2026-03-01' }),
    ]);
    expect(issues.get(0)?.map((i) => i.flag)).toContain('DUPLICATE_PERIOD');
  });

  it('khác mốc thời gian thì không phải mâu thuẫn', () => {
    const issues = validateMetricGroup([
      metric({ name: 'Tồn kho', value: 100, asOfDate: '2026-01-01' }),
      metric({ name: 'Tồn kho', value: 500, asOfDate: '2026-01-08' }),
    ]);
    expect(issues.size).toBe(0);
  });

  it('cùng giá trị lặp lại không phải mâu thuẫn', () => {
    const issues = validateMetricGroup([
      metric({ name: 'Tồn kho', value: 100, asOfDate: '2026-01-01' }),
      metric({ name: 'Tồn kho', value: 100, asOfDate: '2026-01-01' }),
    ]);
    expect(issues.size).toBe(0);
  });

  it('chỉ số khác tên thì tính riêng', () => {
    const issues = validateMetricGroup([
      metric({ name: 'Tổng viện phí nội trú', value: 502_099_390 }),
      metric({ name: 'Tổng viện phí ngoại trú', value: 287_237_561 }),
    ]);
    expect(issues.size).toBe(0);
  });
});
