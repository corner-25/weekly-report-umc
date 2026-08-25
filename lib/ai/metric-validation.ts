/**
 * Bắt lỗi số liệu ngay khi trích, thay vì dọn tay sau nhiều tuần.
 *
 * Báo cáo do người viết tay nên lỗi nhập là chuyện thường xuyên, không phải
 * ngoại lệ. Các loại đã gặp trong 35 tuần dữ liệu:
 *
 *   1. Hai dòng cùng ngày, một dòng là tồn ĐẦU kỳ ghi nhầm ngày
 *   2. Một tên gom nhiều loại số liệu khác hẳn nhau (luỹ kế 37 triệu lẫn số
 *      tuần 60 nghìn)
 *   3. Ngày tháng bị tách thành chỉ số (31 ngày, 12 tháng, 2025 năm)
 *   4. Số ở mệnh đề so sánh bị lấy nhầm ("2.800.000 đồng (tăng 2%)" → 2 %)
 *   5. Thiếu hoặc thừa một chữ số ("170.00km" thay vì "170.000km")
 *
 * Nguyên tắc: KHÔNG tự sửa giá trị. Chỉ đánh dấu để người xem quyết định — máy
 * đoán sai một lần là hỏng cả chuỗi, mà người đọc câu gốc là biết ngay.
 */

/** Ngưỡng lệch so với lịch sử của chính chỉ số đó để coi là đáng ngờ. */
const OUTLIER_HIGH_RATIO = 10;
const OUTLIER_LOW_RATIO = 0.1;

/** Số điểm tối thiểu để lịch sử đủ tin cậy làm mốc so sánh. */
const MIN_HISTORY_POINTS = 5;

/** Đơn vị chỉ dùng cho thành phần ngày tháng, không đo lường công việc. */
const DATE_PART_UNITS = new Set(['ngày', 'tháng', 'năm']);

export type MetricFlag =
  | 'DATE_FRAGMENT' /// Mảnh của một ngày tháng, không phải số đo
  | 'COMPARISON_VALUE' /// Số lấy từ mệnh đề so sánh
  | 'OUTLIER_HIGH' /// Cao bất thường so với lịch sử chỉ số này
  | 'OUTLIER_LOW' /// Thấp bất thường
  | 'MIXED_SCALE' /// Một tên gom nhiều thang giá trị khác hẳn nhau
  | 'DUPLICATE_PERIOD'; /// Nhiều giá trị cho cùng một mốc thời gian

export interface MetricInput {
  name: string;
  value: number;
  unit: string | null;
  sourceText: string;
  asOfDate?: string | null;
}

export interface MetricIssue {
  flag: MetricFlag;
  /** Giải thích cho người xem, viết sẵn bằng tiếng Việt. */
  message: string;
}

/**
 * Lịch sử của một chỉ số, dùng làm mốc so sánh.
 *
 * Chỉ cần trung vị và số điểm — không giữ toàn bộ giá trị để hàm chạy được với
 * dữ liệu lớn mà không tốn bộ nhớ.
 */
export interface MetricHistory {
  median: number;
  count: number;
}

/**
 * Bản ghi này có phải mảnh của một ngày tháng không.
 *
 * "biên bản đối chiếu ... thời điểm 31/12/2025" bị tách thành ba bản ghi:
 * 31 ngày, 12 tháng, 2025 năm. Nhận ra bằng hai dấu hiệu cùng lúc để không bắt
 * nhầm số liệu thật mang đơn vị ngày ("thời gian xử lý trung bình: 3 ngày").
 */
function isDateFragment(metric: MetricInput): boolean {
  const unit = metric.unit?.toLowerCase().trim();
  if (!unit || !DATE_PART_UNITS.has(unit)) return false;

  // Câu gốc phải chứa một ngày đầy đủ dạng dd/mm/yyyy.
  if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(metric.sourceText)) return false;

  // Và giá trị phải khớp một thành phần của ngày đó.
  const match = metric.sourceText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return false;
  const [, day, month, year] = match;
  return (
    metric.value === Number(day) ||
    metric.value === Number(month) ||
    metric.value === Number(year)
  );
}

/**
 * Giá trị này có phải lấy từ mệnh đề so sánh không.
 *
 * "chi phí quản lý: 2.800.000 đồng (tăng 2% so với tuần trước)" sinh ra hai bản
 * ghi, bản thứ hai mang giá trị 2 đơn vị %. Số thật nằm ngoài ngoặc.
 */
function isComparisonValue(metric: MetricInput): boolean {
  if (metric.unit !== '%') return false;
  return /\((tăng|giảm)[^)]*\)|(tăng|giảm)\s+\d+\s*%\s*so\s+với/i.test(
    metric.sourceText,
  );
}

/**
 * Kiểm tra một số liệu, trả về các vấn đề tìm thấy.
 *
 * `history` là lịch sử của CHÍNH chỉ số này ở các tuần trước; bỏ trống khi chỉ
 * số mới xuất hiện lần đầu.
 */
export function validateMetric(
  metric: MetricInput,
  history?: MetricHistory,
): MetricIssue[] {
  const issues: MetricIssue[] = [];

  if (isDateFragment(metric)) {
    issues.push({
      flag: 'DATE_FRAGMENT',
      message:
        `Giá trị ${metric.value} ${metric.unit} trùng một thành phần của ngày ` +
        `trong câu gốc — nhiều khả năng là mốc thời gian, không phải số đo.`,
    });
  }

  if (isComparisonValue(metric)) {
    issues.push({
      flag: 'COMPARISON_VALUE',
      message:
        `Câu gốc có mệnh đề so sánh trong ngoặc; ${metric.value}% nhiều khả ` +
        `năng lấy từ đó chứ không phải số liệu của kỳ này.`,
    });
  }

  // So với lịch sử — chỉ khi có đủ điểm để trung vị đáng tin.
  if (history && history.count >= MIN_HISTORY_POINTS && history.median > 0) {
    const ratio = metric.value / history.median;

    if (ratio > OUTLIER_HIGH_RATIO) {
      issues.push({
        flag: 'OUTLIER_HIGH',
        message:
          `Cao gấp ${ratio.toFixed(0)} lần mức thường thấy của chỉ số này ` +
          `(${history.median.toLocaleString('vi-VN')}). Kiểm tra xem có thừa chữ số không.`,
      });
    } else if (metric.value > 0 && ratio < OUTLIER_LOW_RATIO) {
      issues.push({
        flag: 'OUTLIER_LOW',
        message:
          `Chỉ bằng 1/${(1 / ratio).toFixed(0)} mức thường thấy ` +
          `(${history.median.toLocaleString('vi-VN')}). Kiểm tra xem có thiếu chữ số không.`,
      });
    }
  }

  return issues;
}

/**
 * Kiểm tra cả nhóm số liệu của một tuần, bắt lỗi chỉ thấy được khi so với nhau.
 *
 * Hai loại: nhiều giá trị cho cùng một mốc (tồn kho ghi hai dòng cùng ngày), và
 * một tên gom nhiều thang giá trị khác hẳn (luỹ kế lẫn số tuần).
 */
export function validateMetricGroup(
  metrics: readonly MetricInput[],
): Map<number, MetricIssue[]> {
  const result = new Map<number, MetricIssue[]>();
  const add = (index: number, issue: MetricIssue) => {
    result.set(index, [...(result.get(index) ?? []), issue]);
  };

  // Gom theo (tên, mốc thời gian).
  const byKey = new Map<string, number[]>();
  metrics.forEach((m, i) => {
    const key = `${m.name}|${m.asOfDate ?? ''}`;
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  });

  for (const indexes of byKey.values()) {
    if (indexes.length < 2) continue;

    const values = indexes.map((i) => metrics[i].value);
    if (new Set(values).size < 2) continue; // trùng y hệt, không phải mâu thuẫn

    const max = Math.max(...values);
    const min = Math.min(...values);

    for (const i of indexes) {
      // Chênh lệch lớn giữa các giá trị cùng mốc nghĩa là thang khác nhau —
      // ví dụ luỹ kế lẫn số trong tuần, hay tồn đầu kỳ lẫn tồn cuối kỳ.
      const flag: MetricFlag = min > 0 && max / min >= OUTLIER_HIGH_RATIO
        ? 'MIXED_SCALE'
        : 'DUPLICATE_PERIOD';

      add(i, {
        flag,
        message:
          flag === 'MIXED_SCALE'
            ? `Cùng tên và cùng mốc thời gian nhưng giá trị chênh nhau ` +
              `${(max / min).toFixed(0)} lần (${values.join(' · ')}) — ` +
              `nhiều khả năng là hai loại số liệu khác nhau bị đặt cùng tên.`
            : `Có ${indexes.length} giá trị cho cùng một mốc thời gian ` +
              `(${values.join(' · ')}). Cần xác định giá trị nào đúng.`,
      });
    }
  }

  return result;
}
