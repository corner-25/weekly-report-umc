/**
 * Danh mục cố định của CRM đối tác: nhãn tiếng Việt cho các enum, danh sách
 * chọn sẵn trong modal nhập liệu.
 */
import type {
  CrmContactStatus,
  CrmDateKind,
  CrmInteractionStatus,
  CrmInteractionType,
  CrmOrganizationType,
  CrmRelationKind,
  CrmTier,
} from '@prisma/client';

export { VIP_STAFF, normalizeOrganizationName } from '@/lib/vip';

export const TIER_LABELS: Record<CrmTier, string> = { VIP: 'VIP', A: 'A', B: 'B', C: 'C' };

/** Số ngày nhắc trước theo hạng (phương án đề xuất trong phác thảo, đã chốt). */
export const REMIND_DAYS_BY_TIER: Record<CrmTier, number> = { VIP: 7, A: 3, B: 1, C: 0 };

export const ORGANIZATION_TYPE_LABELS: Record<CrmOrganizationType, string> = {
  HOSPITAL: 'Bệnh viện, cơ sở y tế',
  UNIVERSITY: 'Trường, viện nghiên cứu',
  COMPANY: 'Doanh nghiệp',
  GOVERNMENT: 'Cơ quan nhà nước',
  INTERNATIONAL: 'Tổ chức quốc tế',
  PRESS: 'Báo chí',
  OTHER: 'Khác',
};

export const CONTACT_STATUS_LABELS: Record<CrmContactStatus, string> = {
  ACTIVE: 'Đang quan hệ',
  INACTIVE: 'Ngừng',
};

export const RELATION_KIND_LABELS: Record<CrmRelationKind, string> = {
  SPOUSE: 'Vợ/chồng',
  CHILD: 'Con',
  PARENT: 'Bố/mẹ',
  ASSISTANT: 'Trợ lý',
  SECRETARY: 'Thư ký riêng',
  OTHER: 'Khác',
};

export const DATE_KIND_LABELS: Record<CrmDateKind, string> = {
  BIRTHDAY: 'Sinh nhật',
  APPOINTMENT: 'Ngày nhận chức',
  FOUNDING: 'Ngày thành lập',
  ANNIVERSARY: 'Ngày kỷ niệm',
  OTHER: 'Khác',
};

export const INTERACTION_TYPE_LABELS: Record<CrmInteractionType, string> = {
  VIP_ESCORT: 'Dẫn khách VIP khám bệnh',
  DELEGATION: 'Tiếp & dẫn đoàn',
  MEETING: 'Gặp mặt, làm việc',
  CALL: 'Gọi điện',
  EMAIL: 'Email, thư',
  EVENT: 'Sự kiện',
  GIFT: 'Tặng hoa, quà',
  OTHER: 'Khác',
};

/** Dịch vụ thường hỗ trợ khi dẫn khách VIP khám bệnh — chọn nhiều. */
export const ESCORT_SERVICES = [
  'Khám bệnh',
  'Xét nghiệm',
  'Chẩn đoán hình ảnh',
  'Thăm dò chức năng',
  'Nhận thuốc',
  'Nhập viện, nội trú',
  'Phẫu thuật, thủ thuật',
  'Tái khám',
] as const;

/** Mục đích đoàn — chọn một, có thể gõ thêm. */
export const DELEGATION_PURPOSES = [
  'Làm việc',
  'Tham quan',
  'Học tập kinh nghiệm',
  'Ký kết hợp tác',
  'Kiểm tra, giám sát',
  'Thăm hỏi',
] as const;

export const INTERACTION_STATUS_LABELS: Record<CrmInteractionStatus, string> = {
  PLANNED: 'Lịch hẹn',
  DONE: 'Đã thực hiện',
  CANCELLED: 'Đã huỷ',
};

/**
 * Khoá tìm kiếm: viết thường, bỏ dấu, gọn khoảng trắng — để gõ "nguyen van a"
 * vẫn ra "Nguyễn Văn A". DB chưa có extension unaccent nên tự chuẩn hoá ở app
 * và lưu vào cột searchKey.
 */
export function toSearchKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
