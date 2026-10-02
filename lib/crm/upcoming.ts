/**
 * Tính các dịp sắp tới (sinh nhật, ngày nhận chức, kỷ niệm thành lập…) trong
 * một khoảng ngày, đã đổi âm lịch sang dương lịch của đúng năm đó.
 *
 * Hàm thuần, không đọc DB: API gom ngày từ hồ sơ rồi gọi hàm này.
 */
import { lunarToSolar } from './lunar';

export interface RecurringDate {
  /** Định danh để giao diện mở đúng hồ sơ. */
  id: string;
  day: number;
  month: number;
  /** Năm gốc (năm sinh, năm thành lập) — để tính tuổi/số năm. */
  year?: number | null;
  isLunar: boolean;
  repeatsYearly?: boolean;
}

export interface Occurrence<T extends RecurringDate> {
  item: T;
  /** Ngày dương lịch của dịp, dạng YYYY-MM-DD. */
  date: string;
  daysUntil: number;
  /** Tròn bao nhiêu năm kể từ năm gốc (sinh nhật lần thứ, kỷ niệm năm thứ); null nếu không biết năm gốc. */
  years: number | null;
}

const MS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIsoDate: string): number {
  return Math.round((Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate(fromIso)}T00:00:00Z`)) / MS_PER_DAY);
}
const fromIsoDate = (iso: string) => iso.slice(0, 10);

/**
 * Ngày dương lịch của dịp trong năm `year` (năm dương cho ngày dương, năm âm cho
 * ngày âm). 29/2 ở năm không nhuận lùi về 28/2.
 */
function occurrenceIn(item: RecurringDate, year: number): { iso: string; anchorYear: number } | null {
  if (item.isLunar) {
    const solar = lunarToSolar(item.day, item.month, year);
    return solar ? { iso: toIso(solar.year, solar.month, solar.day), anchorYear: year } : null;
  }
  const day = item.month === 2 && item.day === 29 && !isLeapYear(year) ? 28 : item.day;
  return { iso: toIso(year, item.month, day), anchorYear: year };
}

/**
 * Các dịp rơi vào [today, today + windowDays], sắp theo ngày gần nhất.
 *
 * Ngày âm lịch thử cả năm âm trước/sau: ngày âm tháng Chạp năm nay có thể rơi
 * vào tháng 1-2 dương năm sau, và ngược lại.
 */
export function upcomingOccurrences<T extends RecurringDate>(
  items: readonly T[],
  todayIso: string,
  windowDays: number,
): Occurrence<T>[] {
  const today = fromIsoDate(todayIso);
  const thisYear = Number(today.slice(0, 4));
  const result: Occurrence<T>[] = [];

  for (const item of items) {
    const candidates = [thisYear - 1, thisYear, thisYear + 1]
      .map((y) => occurrenceIn(item, y))
      .filter((c): c is { iso: string; anchorYear: number } => c !== null)
      .map((c) => ({ ...c, daysUntil: daysBetween(today, c.iso) }))
      .filter((c) => c.daysUntil >= 0 && c.daysUntil <= windowDays)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const next = candidates[0];
    if (!next) continue;
    // Dịp một lần (repeatsYearly = false) chỉ tính đúng năm gốc của nó.
    if (item.repeatsYearly === false && item.year && next.anchorYear !== item.year) continue;

    result.push({
      item,
      date: next.iso,
      daysUntil: next.daysUntil,
      years: item.year ? next.anchorYear - item.year : null,
    });
  }

  return result.sort((a, b) => a.daysUntil - b.daysUntil || a.date.localeCompare(b.date));
}

/** "Hôm nay" theo giờ Việt Nam, dạng YYYY-MM-DD — server chạy UTC. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
