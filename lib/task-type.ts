/**
 * Cách hiểu loại nhiệm vụ và con số tiến độ.
 *
 * Trước đây chỉ có hai loại (RECURRING / CUMULATIVE) và code kiểm tra kiểu
 * "phải RECURRING không, không thì coi như CUMULATIVE". Nay có 5 loại nên cách
 * đó khiến MILESTONE và UNRELIABLE bị hiểu nhầm thành tích luỹ.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md để biết vì sao cần 5 loại.
 */
import type { ProgressMeaning, ProgressType } from '@prisma/client';

export interface TaskTypeInfo {
  label: string;
  description: string;
  /** Lớp Tailwind cho nhãn hiển thị. */
  badgeClass: string;
  /** Có nên hiện ô nhập tiến độ không. */
  showProgressInput: boolean;
  /** Con số tiến độ có được tính vào thống kê không. */
  countsTowardStats: boolean;
}

export const TASK_TYPE_INFO: Record<ProgressType, TaskTypeInfo> = {
  RECURRING: {
    label: 'Thường quy',
    description: 'Nghiệp vụ lặp lại hàng tuần — 100% nghĩa là xong phần việc của tuần',
    badgeClass: 'bg-teal-100 text-teal-700',
    showProgressInput: true,
    countsTowardStats: false,
  },
  CUMULATIVE: {
    label: 'Tích luỹ',
    description: 'Dự án có đích — 100% nghĩa là hoàn thành toàn bộ',
    badgeClass: 'bg-violet-100 text-violet-700',
    showProgressInput: true,
    countsTowardStats: true,
  },
  MILESTONE: {
    label: 'Việc một lần',
    description: 'Sự việc có mốc thời gian — chỉ có xong hoặc chưa',
    badgeClass: 'bg-sky-100 text-sky-700',
    showProgressInput: false,
    countsTowardStats: false,
  },
  MONITORING: {
    label: 'Theo dõi số liệu',
    description: 'Giá trị nằm ở số liệu trong kết quả, không phải ở cột tiến độ',
    badgeClass: 'bg-amber-100 text-amber-700',
    showProgressInput: false,
    countsTowardStats: false,
  },
  UNRELIABLE: {
    label: 'Không dùng tiến độ',
    description: 'Con số tiến độ không phản ánh công việc — loại khỏi thống kê',
    badgeClass: 'bg-slate-100 text-slate-500',
    showProgressInput: false,
    countsTowardStats: false,
  },
};

export const PROGRESS_MEANING_LABEL: Record<ProgressMeaning, string> = {
  COMPLETION: '% hoàn thành thật',
  WEEKLY_DONE: 'Xong việc tuần này',
  TIME_RATIO: '% thời gian đã trôi qua',
  MEANINGLESS: 'Không có ý nghĩa',
};

/** Thông tin hiển thị cho một loại; mặc định RECURRING khi thiếu dữ liệu. */
export function getTaskTypeInfo(type: ProgressType | null | undefined): TaskTypeInfo {
  return TASK_TYPE_INFO[type ?? 'RECURRING'] ?? TASK_TYPE_INFO.RECURRING;
}

/**
 * Giá trị tiến độ gợi ý khi thêm nhiệm vụ vào tuần mới.
 *
 * - Thường quy: mặc định 100 vì tuần nào cũng làm xong phần việc của tuần
 * - Tích luỹ: mang theo giá trị tuần trước, người dùng nâng lên
 * - Các loại còn lại: không có tiến độ
 */
export function getDefaultProgress(
  type: ProgressType | null | undefined,
  latestProgress?: number | null,
): number | null {
  switch (type) {
    case 'RECURRING':
      return 100;
    case 'CUMULATIVE':
      return latestProgress ?? 0;
    default:
      return null;
  }
}

/**
 * Chỉ nhiệm vụ tích luỹ mới có tiến độ đáng đưa vào thống kê.
 *
 * Đo trên dữ liệu thật: trong 411 nhiệm vụ, chỉ ~15 có tiến độ thay đổi thật sự.
 * Gộp cả `5,5,5` và `2,4,6` vào "tiến độ trung bình" làm con số đó vô nghĩa.
 */
export function countsTowardProgressStats(
  type: ProgressType | null | undefined,
  meaning?: ProgressMeaning | null,
): boolean {
  if (meaning) return meaning === 'COMPLETION';
  return getTaskTypeInfo(type).countsTowardStats;
}

/**
 * Nhiệm vụ thường quy có tiến độ đọc được theo cách khác: không phải "% hoàn
 * thành" mà là "tuần này xong hay chưa".
 *
 * Cần tách riêng vì `countsTowardProgressStats` chỉ nhận COMPLETION, mà trên dữ
 * liệu thật KHÔNG có nhiệm vụ nào thuộc loại đó — 81 nhiệm vụ là WEEKLY_DONE,
 * 42 MEANINGLESS, 3 TIME_RATIO. Nếu chỉ dựa vào hàm kia thì mẫu số bằng 0 và
 * dashboard hiện "tiến độ trung bình 0%", khiến người xem tưởng công việc đình
 * trệ trong khi thực tế ~70% nhiệm vụ tuần nào cũng hoàn tất.
 */
export function countsTowardWeeklyCompletion(
  meaning?: ProgressMeaning | null,
): boolean {
  return meaning === 'WEEKLY_DONE';
}

/** Ngưỡng coi một nhiệm vụ thường quy là đã xong phần việc của tuần. */
export const WEEKLY_DONE_THRESHOLD = 100;
