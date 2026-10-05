/**
 * Trạng thái bộ lọc của trang danh sách báo cáo tuần, lưu trên URL để quay lại
 * từ trang chi tiết vẫn giữ nguyên bộ lọc.
 */

export type WeekStatusFilter = 'all' | 'draft' | 'completed' | 'issues';

export interface WeekListFilters {
  year: number;
  status: WeekStatusFilter;
  /** Ô tìm theo số tuần, giữ nguyên chuỗi người dùng gõ. */
  q: string;
}

const STATUS_VALUES: readonly WeekStatusFilter[] = ['all', 'draft', 'completed', 'issues'];
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MAX_QUERY_LENGTH = 20;
const LIST_PATH = '/dashboard/weeks';

interface ReadableParams {
  get(name: string): string | null;
}

export function parseWeekListFilters(params: ReadableParams, defaultYear: number): WeekListFilters {
  const rawYear = Number(params.get('year'));
  const year = Number.isInteger(rawYear) && rawYear >= MIN_YEAR && rawYear <= MAX_YEAR ? rawYear : defaultYear;
  const rawStatus = params.get('status') ?? 'all';
  const status = (STATUS_VALUES as readonly string[]).includes(rawStatus) ? (rawStatus as WeekStatusFilter) : 'all';
  const q = (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
  return { year, status, q };
}

/** Chuỗi query (không có "?") — bỏ các giá trị mặc định cho URL gọn. */
export function serializeWeekListFilters(filters: WeekListFilters, defaultYear: number): string {
  const sp = new URLSearchParams();
  if (filters.year !== defaultYear) sp.set('year', String(filters.year));
  if (filters.status !== 'all') sp.set('status', filters.status);
  if (filters.q.trim()) sp.set('q', filters.q.trim());
  return sp.toString();
}

/**
 * Đường dẫn quay về danh sách từ tham số `back` trên trang chi tiết.
 * Chỉ nhận các khoá bộ lọc đã biết — không bao giờ trả về URL ngoài hệ thống.
 */
export function weekListHref(back: string | null | undefined): string {
  if (!back) return LIST_PATH;
  const source = new URLSearchParams(back.startsWith('?') ? back.slice(1) : back);
  const safe = new URLSearchParams();
  const year = source.get('year');
  if (year && /^\d{4}$/.test(year)) safe.set('year', year);
  const status = source.get('status');
  if (status && (STATUS_VALUES as readonly string[]).includes(status)) safe.set('status', status);
  const q = source.get('q');
  if (q) safe.set('q', q.slice(0, MAX_QUERY_LENGTH));
  const qs = safe.toString();
  return qs ? `${LIST_PATH}?${qs}` : LIST_PATH;
}

/** Thêm `back=<bộ lọc>` vào link chi tiết/sửa để nút "Quay lại" giữ bộ lọc. */
export function withBack(href: string, listQuery: string): string {
  if (!listQuery) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}back=${encodeURIComponent(listQuery)}`;
}

/** Lọc theo ô tìm: số tuần ("40"), khoảng ("38-40") hoặc danh sách ("8, 20"). */
export function matchesWeekQuery(weekNumber: number, q: string): boolean {
  const text = q.trim();
  if (!text) return true;
  return text.split(/[,\s]+/).filter(Boolean).some((part) => {
    const range = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      return weekNumber >= from && weekNumber <= to;
    }
    return /^\d{1,2}$/.test(part) && Number(part) === weekNumber;
  });
}
