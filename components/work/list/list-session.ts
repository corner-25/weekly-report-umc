/**
 * Nhớ trạng thái danh sách công việc trong phiên trình duyệt: đường dẫn kèm bộ
 * lọc, vị trí cuộn, số dòng đang hiện — để xem một việc rồi quay lại vẫn đúng chỗ.
 */
export const LIST_URL_KEY = 'work-list-url';
export const SCROLL_KEY = 'work-list-scroll';
export const SHOWN_KEY = 'work-list-shown';
export const LIST_PATH = '/dashboard/work/items';

export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* trình duyệt chặn lưu trữ: chỉ mất phần ghi nhớ */
  }
}

/** Bộ lọc của danh sách, bỏ tham số xem nhanh (?xem=) — khoá ghi nhớ không đổi khi mở/đóng xem nhanh. */
export function listSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('xem');
  return params.toString();
}

/** Đường dẫn danh sách gần nhất anh/chị đã xem, mặc định là danh sách trống bộ lọc. */
export function lastListUrl(): string {
  return readSession(LIST_URL_KEY) ?? LIST_PATH;
}
