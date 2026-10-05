/** Nhãn và ngưỡng của phân hệ Quản lý công việc (dùng chung giao diện và máy chủ). */

export const WORK_KIND_LABELS = { DIRECTIVE: 'Chỉ đạo BGĐ', PLAN: 'Theo kế hoạch', OTHER: 'Khác' } as const;

export const WORK_STATUS_LABELS = {
  NOT_STARTED: 'Chưa thực hiện',
  IN_PROGRESS: 'Đang xử lý',
  PAUSED: 'Tạm dừng',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
} as const;

export const WORK_PRIORITY_LABELS = { LOW: 'Thấp', NORMAL: 'Bình thường', HIGH: 'Cao', URGENT: 'Khẩn' } as const;

export const WORK_SOURCE_LABELS = { QLCV: 'Quản lý công việc', MANUAL: 'Phòng HC mở' } as const;

export type WorkKindKey = keyof typeof WORK_KIND_LABELS;
export type WorkStatusKey = keyof typeof WORK_STATUS_LABELS;
export type WorkPriorityKey = keyof typeof WORK_PRIORITY_LABELS;

/** Việc đang làm mà quá ngần này ngày không có cập nhật thì coi là "lâu chưa cập nhật". */
export const STALE_DAYS = 14;
/** Hạn chót trong ngần này ngày tới thì nhắc "sắp đến hạn". */
export const DUE_SOON_DAYS = 30;

/** Trạng thái đã khép lại — không nhắc, không tính quá hạn. */
export const CLOSED_STATUSES: readonly WorkStatusKey[] = ['DONE', 'CANCELLED'];
