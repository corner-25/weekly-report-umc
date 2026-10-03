/**
 * Trang nhập nhanh (/nhap-nhanh) mở từ mã QR dán ở quầy lễ tân, phòng khách:
 * mỗi loại một đường dẫn riêng để quét là vào thẳng form.
 */
export const QUICK_ENTRY_KINDS = {
  vip: { label: 'Dẫn khách VIP khám', hint: 'Khách VIP, người nhà khách đến khám' },
  doan: { label: 'Đón đoàn', hint: 'Đoàn làm việc, tham quan — kèm ảnh quà đoàn tặng' },
  'nhan-qua': { label: 'Nhận quà, hoa', hint: 'Đối tác gửi quà, hoa tặng bệnh viện' },
  'tang-qua': { label: 'Tặng hoa, quà', hint: 'Phòng tặng hoa, quà tri ân đối tác' },
} as const;

export type QuickEntryKind = keyof typeof QUICK_ENTRY_KINDS;

export function isQuickEntryKind(value: unknown): value is QuickEntryKind {
  return typeof value === 'string' && Object.hasOwn(QUICK_ENTRY_KINDS, value);
}

export const QUICK_ENTRY_PATH = '/nhap-nhanh';

export function quickEntryPath(kind?: QuickEntryKind): string {
  return kind ? `${QUICK_ENTRY_PATH}?loai=${kind}` : QUICK_ENTRY_PATH;
}
