export const VIP_STAFF = [
  'Nguyễn Lương Bảo Châu',
  'Nguyễn Thị Thảo Trang',
  'Vũ Thị Bích Thảo',
  'Nguyễn Ngọc Linh Ân',
  'Nguyễn Đoàn Vĩnh',
  'Nguyễn Thị Thu Thục',
] as const;

export function normalizeOrganizationName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}
