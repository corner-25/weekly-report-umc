/**
 * Quy tắc ảnh quà, hoa trong CRM. Trình duyệt thu nhỏ ảnh trước khi gửi
 * (components/crm/photo-resize.ts), nên một ảnh thường chỉ vài trăm KB;
 * giới hạn ở đây chặn trường hợp gửi thẳng ảnh gốc.
 */
import { sniffMimeType } from '@/lib/vehicle-documents';

export { MAX_CRM_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from './constants';

export type CrmPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Loại ảnh theo chữ ký đầu file; PDF và file khác không nhận. */
export function sniffPhotoMime(bytes: Uint8Array): CrmPhotoMime | null {
  const mime = sniffMimeType(bytes);
  return mime === 'application/pdf' ? null : mime;
}
