/** Lịch viết báo cáo tóm tắt — dùng chung máy chủ và giao diện. */

const MS_PER_DAY = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
/** Tuần coi là xong từ 00:00 (giờ VN) ngày này: Thứ Sáu kết thúc + 3 ngày = Thứ Hai. */
const DAYS_AFTER_END = 3;

/** Thời điểm tuần được coi là xong (UTC). endDate lưu nửa đêm theo lịch — lấy phần ngày. */
export function weekClosesAt(endDate: Date): Date {
  const day = Math.floor((endDate.getTime() + VN_OFFSET_MS) / MS_PER_DAY);
  return new Date((day + DAYS_AFTER_END) * MS_PER_DAY - VN_OFFSET_MS);
}
