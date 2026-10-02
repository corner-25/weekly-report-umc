import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

/** Bỏ khoảng trắng; chuỗi rỗng → undefined (để không gửi trường trống lên API). */
export function cleanText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function displayName(person: { fullName: string; academicTitle?: string | null }): string {
  return person.academicTitle ? `${person.academicTitle} ${person.fullName}` : person.fullName;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words.length > 1 ? words[words.length - 2][0] : '';
  return `${first}${words[words.length - 1][0]}`.toLocaleUpperCase('vi');
}

export function formatDate(value: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, pattern, { locale: vi });
}

export function formatDateTime(value: string): string {
  return formatDate(value, 'dd/MM/yyyy HH:mm');
}

/** Giá trị cho `<input type="datetime-local">` theo giờ máy. */
export function toDateTimeLocal(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function daysUntilLabel(days: number): string {
  if (days <= 0) return 'hôm nay';
  return `còn ${days} ngày`;
}

export function dayMonth(day: number | null | undefined, month: number | null | undefined, year?: number | null): string {
  if (!day || !month) return '—';
  const base = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  return year ? `${base}/${year}` : base;
}

export function yearsLabel(kind: string, years: number | null): string | null {
  if (years === null || years <= 0) return null;
  return kind === 'BIRTHDAY' ? `${years} tuổi` : `${years} năm`;
}

/** Danh sách chọn có thêm giá trị hiện tại nếu nó không nằm trong danh mục (dữ liệu cũ). */
export function withCurrent(list: readonly string[], current: string | null | undefined): string[] {
  return current && !list.includes(current) ? [...list, current] : [...list];
}

/**
 * Giá trị trường văn bản gửi API: rỗng khi tạo mới thì bỏ qua (undefined); rỗng khi
 * sửa thì gửi `null` để API xoá trường đó (PATCH hiểu null/'' là xoá).
 */
export function textOrClear(value: string | null | undefined, isEdit: boolean): string | null | undefined {
  return cleanText(value) ?? (isEdit ? null : undefined);
}

/** Kiểu body PATCH: mọi trường tuỳ chọn, cho phép `null` để xoá. */
export type Clearable<T> = { [K in keyof T]?: T[K] | null };
