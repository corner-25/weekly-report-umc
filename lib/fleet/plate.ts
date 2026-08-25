/**
 * Chuẩn hoá biển số xe để so khớp giữa các nguồn dữ liệu.
 *
 * Ba nơi ghi biển số theo ba cách: tài xế nhập trên Google Sheets dùng dấu chấm
 * ("50A-007.39"), hồ sơ phương tiện dùng gạch ngang ("50A-007-39"), có bản còn
 * thừa dấu cách ("50A- 004-55"). So trực tiếp chỉ khớp 4/19 xe.
 *
 * Trước đây hàm này được chép lại ở ba script khác nhau — sửa một chỗ thì hai
 * chỗ kia lệch theo. Gom về một nơi để còn test được.
 */

/**
 * Rút biển số về dạng so khớp: chỉ chữ và số, viết hoa.
 *
 * "50A-007.39", "50A-007-39", "50A- 007-39" đều thành "50A00739".
 */
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Tìm biển số trong một câu văn.
 *
 * Dùng cho tên giấy tờ như "Giấy phép đèn còi ưu tiên - 50M-002.19 (TOYOTA)",
 * nơi biển số nằm giữa câu chứ không có cột riêng.
 *
 * Khuôn dạng biển số Việt Nam: hai chữ số (mã tỉnh), một chữ cái (seri), rồi
 * nhóm số phân cách bằng chấm hoặc gạch.
 */
export function extractPlate(text: string): string | null {
  const match = text.match(/\b\d{2}\s*[A-Z]\s*[-\s]?\s*\d{2,3}[.\-]?\d{2,3}\b/i);
  return match ? match[0] : null;
}

/** Hai biển số có phải cùng một xe không, bất kể cách viết. */
export function isSamePlate(a: string, b: string): boolean {
  return normalizePlate(a) === normalizePlate(b);
}
