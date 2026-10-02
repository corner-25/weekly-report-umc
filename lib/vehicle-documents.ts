/**
 * Quy tắc cho file hồ sơ xe (ảnh chụp giấy tờ, PDF): loại file nhận, dung
 * lượng tối đa, và nhận diện loại file thật từ nội dung — không tin đuôi file
 * hay Content-Type trình duyệt gửi lên.
 */
import { createHash } from 'crypto';

/** Một trang hồ sơ chụp điện thoại ~0,5 MB; PDF nhiều trang vài MB. */
export const MAX_VEHICLE_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const ALLOWED_VEHICLE_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type VehicleDocumentMime = (typeof ALLOWED_VEHICLE_DOCUMENT_TYPES)[number];

/** Loại file theo chữ ký đầu file; null nếu không phải ảnh/PDF được nhận. */
export function sniffMimeType(bytes: Uint8Array): VehicleDocumentMime | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (starts([0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  return null;
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Tên file an toàn để đặt trong header Content-Disposition. */
export function contentDisposition(fileName: string, inline = true): string {
  const ascii = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
