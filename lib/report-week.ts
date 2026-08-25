/**
 * Suy ngày bắt đầu và kết thúc của một tuần báo cáo.
 *
 * Bệnh viện đánh số tuần theo lịch riêng, không dùng được ISO week. Tuần chạy từ
 * Thứ Bảy đến Thứ Sáu, nhưng hai tuần đầu năm đều lệch nhịp:
 *
 *   tuần 1:  28/12 Chủ Nhật → 03/01 Thứ Bảy   (cụt)
 *   tuần 2:  02/01 Thứ Sáu  → 08/01 Thứ Năm   (cụt)
 *   tuần 3:  10/01 Thứ Bảy  → 16/01 Thứ Sáu   ← nhịp chuẩn bắt đầu từ đây
 *
 * Nên phải neo vào tuần 3. Neo vào tuần 1 hay tuần 2 đều lệch một ngày.
 */

/** Mốc neo mỗi năm, đo từ dữ liệu đã có trong hệ thống. */
const WEEK_ANCHOR: Record<number, { weekNumber: number; startIso: string }> = {
  2026: { weekNumber: 3, startIso: '2026-01-10' },
};

/** Một tuần báo cáo dài 7 ngày: Thứ Bảy đến Thứ Sáu. */
const DAYS_PER_WEEK = 7;

const MS_PER_DAY = 86_400_000;

export interface WeekDates {
  startDate: Date;
  endDate: Date;
}

/**
 * Ngày bắt đầu và kết thúc của tuần báo cáo; null khi chưa biết mốc của năm đó.
 *
 * Dùng Date.UTC chứ không phải `new Date(y, m, d)`: hàm sau tính theo múi giờ
 * máy chủ, ở Việt Nam (UTC+7) sẽ lưu lệch về ngày hôm trước.
 */
export function computeWeekDates(weekNumber: number, year: number): WeekDates | null {
  const anchor = WEEK_ANCHOR[year];
  if (!anchor) return null;

  const base = new Date(`${anchor.startIso}T00:00:00.000Z`);
  const offset = (weekNumber - anchor.weekNumber) * DAYS_PER_WEEK * MS_PER_DAY;
  const startDate = new Date(base.getTime() + offset);
  const endDate = new Date(startDate.getTime() + (DAYS_PER_WEEK - 1) * MS_PER_DAY);
  return { startDate, endDate };
}

/** Năm nào đã có mốc neo — dùng để báo lỗi sớm khi sang năm mới. */
export function hasWeekAnchor(year: number): boolean {
  return year in WEEK_ANCHOR;
}
