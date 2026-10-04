/**
 * Quy tắc thuần (không chạm DB) của phân hệ công việc: quy đổi trạng thái
 * nguyên văn ở nguồn, phân loại việc quá hạn / lâu chưa cập nhật, hash cập nhật.
 */
import { createHash } from 'crypto';
import { toSearchKey } from '@/lib/crm/constants';
import { CLOSED_STATUSES, DUE_SOON_DAYS, STALE_DAYS, type WorkStatusKey } from './constants';

const MS_PER_DAY = 86_400_000;

/** Từ khoá (đã bỏ dấu) → trạng thái. Xét theo thứ tự: "chưa hoàn thành" phải ra NOT_STARTED/IN_PROGRESS, không ra DONE. */
const STATUS_RULES: Array<[RegExp, WorkStatusKey]> = [
  [/\bhuy\b|thu hoi/, 'CANCELLED'],
  [/tam dung|tam hoan|ngung/, 'PAUSED'],
  [/chua (thuc hien|xu ly|bat dau)|moi giao|cho xu ly/, 'NOT_STARTED'],
  [/chua hoan thanh|dang|tre han|qua han|cho duyet/, 'IN_PROGRESS'],
  [/hoan thanh|da xong|ket thuc|da xu ly/, 'DONE'],
];

/** Quy đổi trạng thái ghi ở ứng dụng nội bộ; không nhận ra thì coi là đang thực hiện. */
export function mapExternalStatus(raw: string | null | undefined, progressPercent?: number | null): WorkStatusKey {
  const key = toSearchKey(raw);
  for (const [pattern, status] of STATUS_RULES) if (pattern.test(key)) return status;
  if (progressPercent === 100) return 'DONE';
  if (progressPercent === 0) return 'NOT_STARTED';
  return 'IN_PROGRESS';
}

export interface WorkHealth {
  isClosed: boolean;
  isOverdue: boolean;
  /** Số ngày đến hạn (âm là đã quá); null nếu không có hạn. */
  daysToDue: number | null;
  isDueSoon: boolean;
  /** Số ngày từ lần cập nhật gần nhất; null nếu chưa từng cập nhật. */
  daysSinceActivity: number | null;
  isStale: boolean;
}

/** Ngày theo giờ Việt Nam, dạng số ngày kể từ epoch — so hạn chót theo ngày, không theo giờ. */
function vnDay(date: Date): number {
  return Math.floor((date.getTime() + 7 * 3_600_000) / MS_PER_DAY);
}

export function workHealth(
  item: { status: WorkStatusKey; dueDate: Date | null; lastActivityAt: Date | null; directedAt?: Date | null; createdAt: Date },
  now: Date = new Date(),
): WorkHealth {
  const isClosed = CLOSED_STATUSES.includes(item.status);
  // dueDate là cột DATE (nửa đêm UTC): lấy thẳng số ngày UTC.
  const daysToDue = item.dueDate ? Math.floor(item.dueDate.getTime() / MS_PER_DAY) - vnDay(now) : null;
  // Việc cào về chưa có cập nhật nào: tính từ ngày chỉ đạo, không phải ngày nạp vào hệ thống.
  const activity = item.lastActivityAt ?? item.directedAt ?? item.createdAt;
  const daysSinceActivity = Math.floor((now.getTime() - activity.getTime()) / MS_PER_DAY);
  return {
    isClosed,
    isOverdue: !isClosed && daysToDue !== null && daysToDue < 0,
    daysToDue,
    isDueSoon: !isClosed && daysToDue !== null && daysToDue >= 0 && daysToDue <= DUE_SOON_DAYS,
    daysSinceActivity: item.lastActivityAt ? daysSinceActivity : null,
    isStale: !isClosed && daysSinceActivity > STALE_DAYS,
  };
}

/** Khoá chống trùng cho một lần cập nhật: cùng thời điểm, người và nội dung là một. */
export function updateHash(update: { occurredAt: Date; author?: string | null; content: string }): string {
  const text = `${update.occurredAt.toISOString()}|${(update.author ?? '').trim()}|${update.content.trim().replace(/\s+/g, ' ')}`;
  return createHash('sha256').update(text).digest('hex').slice(0, 40);
}
