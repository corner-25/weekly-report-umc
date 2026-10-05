/**
 * Lịch tuần báo cáo của bệnh viện, dạng "khoá ngày" YYYY-MM-DD.
 *
 * Tuần chạy Thứ Bảy → Thứ Sáu. Tuần 1 là tuần (T7→T6) chứa ngày 01/01 — với
 * năm 2026 quy tắc này cho đúng mốc neo tuần 3 = 10/01 trong lib/report-week.ts.
 * Năm nào đã có mốc neo thì dùng mốc neo; năm chưa có thì suy theo quy tắc và
 * đánh dấu `isEstimated` để giao diện nói rõ là ước tính.
 *
 * Làm việc bằng chuỗi ngày thay vì Date để không bị lệch múi giờ: máy chủ chạy
 * UTC, người dùng ở UTC+7.
 */
import { computeWeekDates } from '@/lib/report-week';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const SATURDAY = 6;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface HospitalWeekRange {
  weekNumber: number;
  year: number;
  /** Thứ Bảy đầu tuần, YYYY-MM-DD. */
  startKey: string;
  /** Thứ Sáu cuối tuần, YYYY-MM-DD. */
  endKey: string;
  /** true khi năm chưa có mốc neo, ngày được suy theo quy tắc chung. */
  isEstimated: boolean;
}

const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const dateOfKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const addDays = (key: string, days: number) => keyOf(new Date(dateOfKey(key).getTime() + days * MS_PER_DAY));
const diffDays = (a: string, b: string) => Math.round((dateOfKey(a).getTime() - dateOfKey(b).getTime()) / MS_PER_DAY);

/** Chuỗi YYYY-MM-DD hợp lệ hay không. */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = dateOfKey(value);
  return !Number.isNaN(d.getTime()) && keyOf(d) === value;
}

/** Thứ Bảy mở đầu tuần 1 của năm theo quy tắc chung. */
export function week1StartKey(year: number): string {
  const jan1 = dateOfKey(`${String(year).padStart(4, '0')}-01-01`);
  const backToSaturday = (jan1.getUTCDay() - SATURDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(keyOf(jan1), -backToSaturday);
}

/** Số tuần báo cáo của một năm: 52 hoặc 53. */
export function weeksInYear(year: number): number {
  return diffDays(week1StartKey(year + 1), week1StartKey(year)) / DAYS_PER_WEEK;
}

/** Ngày đầu/cuối của tuần báo cáo. Ưu tiên mốc neo trong lib/report-week.ts. */
export function hospitalWeekRange(weekNumber: number, year: number): HospitalWeekRange {
  const anchored = computeWeekDates(weekNumber, year);
  if (anchored) {
    return {
      weekNumber,
      year,
      startKey: keyOf(anchored.startDate),
      endKey: keyOf(anchored.endDate),
      isEstimated: false,
    };
  }
  const startKey = addDays(week1StartKey(year), (weekNumber - 1) * DAYS_PER_WEEK);
  return { weekNumber, year, startKey, endKey: addDays(startKey, DAYS_PER_WEEK - 1), isEstimated: true };
}

/** Một ngày (YYYY-MM-DD) thuộc tuần báo cáo nào. */
export function hospitalWeekOf(dateKey: string): HospitalWeekRange {
  let year = Number(dateKey.slice(0, 4));
  if (dateKey >= week1StartKey(year + 1)) year += 1;
  const weekNumber = Math.floor(diffDays(dateKey, week1StartKey(year)) / DAYS_PER_WEEK) + 1;
  return hospitalWeekRange(weekNumber, year);
}

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function vnTodayKey(now: Date = new Date()): string {
  return keyOf(new Date(now.getTime() + VN_OFFSET_MS));
}

/**
 * Đổi ngày đã lưu trong DB về khoá ngày.
 *
 * DB đang lẫn hai cách lưu: đa số là 00:00Z (hoặc 23:59Z cho ngày cuối), riêng
 * vài tuần đầu năm lưu 17:00Z của hôm trước (= 00:00 giờ Việt Nam). Giờ UTC
 * nằm trong khoảng 12h–22h được coi là "nửa đêm Việt Nam" của ngày hôm sau.
 */
export function storedDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const hour = d.getUTCHours();
  const isVnMidnight = hour >= 12 && hour <= 22;
  return isVnMidnight ? keyOf(new Date(d.getTime() + VN_OFFSET_MS)) : keyOf(d);
}

/** Khoá ngày → Date 00:00Z để gửi lên API (khớp cách lib/report-week.ts lưu). */
export function dateKeyToUtc(key: string): Date {
  return dateOfKey(key);
}

/** "10/01" hoặc "10/01/2026". */
export function formatDateKey(key: string, withYear = false): string {
  const [y, m, d] = key.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** "10/01 – 16/01/2026". */
export function formatRange(startKey: string, endKey: string): string {
  return `${formatDateKey(startKey)} – ${formatDateKey(endKey, true)}`;
}
