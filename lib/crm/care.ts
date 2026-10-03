/**
 * Chăm sóc đối tác (giai đoạn 2): các quy tắc thuần cho việc chuẩn bị quà, hoa —
 * khoá chống trùng, số ngày nhắc trước, chuyển trạng thái, khoảng thời gian
 * tính ngân sách. Không đọc DB: API và test dùng chung.
 */
import type { CrmCareStatus, CrmDateKind, CrmTier } from '@prisma/client';
import { REMIND_DAYS_BY_TIER } from './constants';

/** Nhắc trước tối đa (ngày) — bằng giới hạn ô "Nhắc trước" của ngày quan trọng. */
export const MAX_REMIND_DAYS = 60;

/**
 * Khoá của một dịp, cùng dạng `key` mà API tổng quan trả cho từng dịp sắp tới:
 *   sinh nhật      birthday:<contactId>
 *   ngày quan trọng date:<importantDateId>
 *   dịp gõ tay     <kind>:contact|organization:<id>
 */
export function occasionSourceKey(input: {
  contactId?: string | null;
  organizationId?: string | null;
  occasionKind: CrmDateKind;
  importantDateId?: string | null;
}): string {
  if (input.importantDateId) return `date:${input.importantDateId}`;
  if (input.occasionKind === 'BIRTHDAY' && input.contactId) return `birthday:${input.contactId}`;
  const target = input.contactId ? `contact:${input.contactId}` : `organization:${input.organizationId ?? ''}`;
  return `${input.occasionKind.toLowerCase()}:${target}`;
}

/** Khoá chống trùng của một việc: một dịp + một ngày diễn ra (YYYY-MM-DD) = một việc. */
export function careKey(sourceKey: string, occasionDate: string): string {
  return `${sourceKey}@${occasionDate.slice(0, 10)}`;
}

export function careOccasionKey(input: Parameters<typeof occasionSourceKey>[0] & { occasionDate: string }): string {
  return careKey(occasionSourceKey(input), input.occasionDate);
}

/** Số ngày nhắc trước: ngày quan trọng tự đặt thì theo nó, không thì theo hạng (C = 0: chỉ nhắc đúng ngày). */
export function remindDaysFor(tier: CrmTier, remindDaysBefore?: number | null): number {
  return remindDaysBefore ?? REMIND_DAYS_BY_TIER[tier];
}

/**
 * Lý do không cho chuyển trạng thái, hoặc null nếu được. Đã trao thì đã có lượt
 * tương tác GIFT trong lịch sử — không lùi lại hay huỷ được.
 */
export function careTransitionError(from: CrmCareStatus, to: CrmCareStatus): string | null {
  if (from === to) return 'Việc này đã ở trạng thái đó';
  if (from === 'DELIVERED') {
    return to === 'CANCELLED' ? 'Quà/hoa đã trao, không huỷ được' : 'Quà/hoa đã trao, không đổi lại trạng thái được';
  }
  return null;
}

/**
 * Tháng này và năm nay theo ngày `todayIso` (giờ Việt Nam), dạng nửa mở [from, to)
 * để so với cột DATE `occasionDate` (Prisma đọc/ghi DATE ở 00:00 UTC).
 */
export function budgetPeriods(todayIso: string) {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  return {
    month: { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) },
    year: { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) },
  };
}
