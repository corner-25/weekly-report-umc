/**
 * Xử lý giá trị ngày/giờ dạng chuỗi như ô nhập HTML: ngày "YYYY-MM-DD", ngày giờ
 * "YYYY-MM-DDTHH:mm", giờ "HH:mm". Thuần, không dính múi giờ (tính theo lịch).
 */
export type DateMode = 'date' | 'datetime-local' | 'time';

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;

export function parseKey(key: string | undefined | null): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key ?? '');
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, m, d } : null;
}

export function parseTime(value: string | undefined | null): { h: number; min: number } | null {
  const match = /(?:^|T)(\d{2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  return h <= 23 && min <= 59 ? { h, min } : null;
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Thứ trong tuần, Thứ Hai = 0 … Chủ Nhật = 6. */
export const weekdayMon0 = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function addDays(day: Ymd, delta: number): Ymd {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + delta));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Lưới 6 tuần của một tháng (bắt đầu Thứ Hai), gồm cả ngày tháng trước/sau. */
export function monthGrid(y: number, m: number): Array<Ymd & { inMonth: boolean }> {
  const lead = weekdayMon0(y, m, 1);
  const start = addDays({ y, m, d: 1 }, -lead);
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    return { ...day, inMonth: day.m === m };
  });
}

export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

/** "Thứ Hai, 05/10/2026" (· 15:21 với ngày giờ) — hiện trên nút chọn. */
export function formatValue(value: string, mode: DateMode): string {
  if (mode === 'time') {
    const t = parseTime(value);
    return t ? `${pad(t.h)}:${pad(t.min)}` : '';
  }
  const day = parseKey(value);
  if (!day) return '';
  const text = `${WEEKDAY_NAMES[weekdayMon0(day.y, day.m, day.d)]}, ${pad(day.d)}/${pad(day.m)}/${day.y}`;
  const t = mode === 'datetime-local' ? parseTime(value) : null;
  return t ? `${text} · ${pad(t.h)}:${pad(t.min)}` : text;
}

/** Ngày có nằm ngoài [min, max] (so theo phần ngày) không. */
export function outOfRange(key: string, min?: string, max?: string): boolean {
  return Boolean((min && key < min.slice(0, 10)) || (max && key > max.slice(0, 10)));
}
