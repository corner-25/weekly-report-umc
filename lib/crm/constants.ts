/**
 * Danh mục cố định của CRM đối tác: nhãn tiếng Việt cho các enum, danh sách
 * chọn sẵn trong modal nhập liệu.
 */
import type {
  CrmCareStatus,
  CrmContactStatus,
  CrmDateKind,
  CrmGiftType,
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
/** Hình thức tiếp đoàn — theo danh mục chuẩn hoá của sổ tiếp đoàn 2022–2026. */
export const DELEGATION_PURPOSES = [
  'Làm việc',
  'Tham quan - Học tập',
  'Ký kết hợp tác (MOU)',
  'Chúc Tết',
  'Chúc mừng - Tặng quà',
] as const;

export const DELEGATION_PURPOSE_HINTS: Record<(typeof DELEGATION_PURPOSES)[number], string> = {
  'Làm việc': 'Đoàn đến làm việc, thanh tra, kiểm tra, kiểm toán, giám định, thẩm định, khảo sát, đánh giá, hội nghị, hỗ trợ chuyên môn theo hợp đồng',
  'Tham quan - Học tập': 'Đoàn đến tham quan, học tập, trao đổi kinh nghiệm, tìm hiểu mô hình của Bệnh viện',
  'Ký kết hợp tác (MOU)': 'Lễ ký kết biên bản ghi nhớ / thoả thuận hợp tác',
  'Chúc Tết': 'Đoàn đến chúc Tết Nguyên đán',
  'Chúc mừng - Tặng quà': 'Tổ chức/cá nhân gửi quà hoặc đến chúc mừng (sinh nhật Bệnh viện, tặng biểu trưng…)',
};

/** Chủ đề làm việc của đoàn — để lọc, thống kê; gắn được nhiều chủ đề. */
export const DELEGATION_TOPICS = [
  'Quản trị - Tổ chức bệnh viện',
  'Chuyên môn - Chuyển giao kỹ thuật',
  'CNTT - Chuyển đổi số',
  'Bệnh án điện tử',
  'Quản lý chất lượng',
  'Đào tạo - Nghiên cứu khoa học',
  'Hợp tác - Ký kết',
  'Thanh tra - Kiểm tra - Kiểm toán',
  'Tài chính - Giá dịch vụ',
  'Bảo hiểm y tế',
  'Dược - Vật tư - Thiết bị y tế',
  'Đấu thầu - Mua sắm',
  'Điều dưỡng - Chăm sóc người bệnh',
  'Kiểm soát nhiễm khuẩn',
  'Dinh dưỡng',
  'Công tác xã hội - CSKH',
  'Hạ tầng - Môi trường - An toàn',
  'Ngoại giao - Chúc mừng',
] as const;

/** Loại tổ chức chi tiết (sổ tiếp đoàn) và loại gộp tương ứng của CRM. */
export const ORGANIZATION_CATEGORIES: Record<string, CrmOrganizationType> = {
  'Bệnh viện - Cơ sở y tế': 'HOSPITAL',
  'Trường - Viện nghiên cứu': 'UNIVERSITY',
  'Doanh nghiệp': 'COMPANY',
  'Ngân hàng - Bảo hiểm': 'COMPANY',
  'Cơ quan quản lý nhà nước': 'GOVERNMENT',
  'Chính quyền - Đảng - Đoàn thể': 'GOVERNMENT',
  'Công an - Quân đội': 'GOVERNMENT',
  'Cơ quan ngoại giao': 'INTERNATIONAL',
  'Báo chí - Truyền thông': 'PRESS',
  'Hội - Tổ chức phi chính phủ': 'OTHER',
  'Tổ chức đánh giá - Chứng nhận': 'OTHER',
  'Cá nhân': 'OTHER',
};

export const ORGANIZATION_SCOPES = ['Trong nước', 'Nước ngoài', 'Tổ chức quốc tế', 'Nội bộ ĐHYD TP.HCM'] as const;

export const INTERACTION_STATUS_LABELS: Record<CrmInteractionStatus, string> = {
  PLANNED: 'Lịch hẹn',
  DONE: 'Đã thực hiện',
  POSTPONED: 'Hoãn',
  CANCELLED: 'Đã huỷ',
};

export const GIFT_TYPE_LABELS: Record<CrmGiftType, string> = {
  FLOWERS: 'Hoa',
  GIFT: 'Quà',
  CARD: 'Thiệp',
  VISIT: 'Đến thăm',
  OTHER: 'Khác',
};

export const CARE_STATUS_LABELS: Record<CrmCareStatus, string> = {
  TODO: 'Chưa đặt',
  ORDERED: 'Đã đặt',
  DELIVERED: 'Đã trao',
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

export const MAX_CRM_PHOTO_BYTES = 8 * 1024 * 1024;
/** Đủ cho vài góc chụp giỏ quà và ảnh trao tặng, không biến CRM thành kho ảnh. */
export const MAX_PHOTOS_PER_ITEM = 12;

export const PHOTO_KIND_LABELS = {
  RECEIVED: 'Quà, hoa bệnh viện nhận',
  GIVEN: 'Quà, hoa tặng đối tác',
  OTHER: 'Ảnh khác',
} as const;
