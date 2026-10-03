/**
 * Thu nhỏ ảnh chụp điện thoại trước khi tải lên: ảnh gốc 4–8 MB còn vài trăm KB,
 * đủ nét để xem giỏ hoa, quà. Ảnh đã nhỏ sẵn thì giữ nguyên.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const SMALL_ENOUGH_BYTES = 500 * 1024;

export async function resizePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // Trình duyệt không đọc được (vd HEIC trên máy tính) — để máy chủ báo lỗi rõ ràng.
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
