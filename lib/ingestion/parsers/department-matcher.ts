/**
 * Khớp tên phòng ban viết HOA trong Excel với bản ghi Department trong database.
 *
 * Excel ghi "PHÒNG QUẢN LÝ CHẤT LƯỢNG BỆNH VIỆN", database lưu "Phòng QLCL BV" —
 * cùng một phòng, hai cách viết. So khớp không dấu không đủ, cần bảng ánh xạ tay
 * cho các trường hợp viết tắt.
 */

/**
 * Ánh xạ tên Excel (viết HOA) → tên Department trong DB.
 *
 * Chỉ liệt kê các trường hợp mà so khớp tự động KHÔNG ra: viết tắt, đổi từ.
 * Các phòng khớp thẳng sau khi bỏ dấu (Hành chính, Điều dưỡng...) không cần vào đây.
 */
export const DEPARTMENT_ALIASES: Readonly<Record<string, string>> = {
  'PHÒNG QUẢN LÝ CHẤT LƯỢNG BỆNH VIỆN': 'Phòng QLCL BV',
  'PHÒNG KHOA HỌC VÀ ĐÀO TẠO': 'Phòng Khoa học Đào tạo',
};

/** Bỏ dấu tiếng Việt và chuẩn hoá khoảng trắng để so khớp. */
export function normalizeDeptName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export interface DepartmentMatch {
  /** Tên như trong Excel. */
  excelName: string;
  /** Id Department khớp được, null nếu chưa có trong DB. */
  departmentId: string | null;
  /** Tên trong DB, null nếu chưa có. */
  dbName: string | null;
  /** Cách khớp, phục vụ ghi log để người rà soát biết mức tin cậy. */
  method: 'ALIAS' | 'EXACT' | 'NORMALIZED' | 'NONE';
}

/**
 * Khớp một tên Excel với danh sách phòng ban trong DB.
 *
 * Thứ tự ưu tiên: bảng ánh xạ tay → trùng khít → trùng sau khi bỏ dấu.
 * Không khớp được thì trả `method: 'NONE'` để nơi gọi quyết định tạo mới
 * hay báo người dùng — parser không tự tạo Department.
 */
export function matchDepartment(
  excelName: string,
  dbDepartments: ReadonlyArray<{ id: string; name: string }>,
): DepartmentMatch {
  const base = { excelName };

  const aliased = DEPARTMENT_ALIASES[excelName.trim()];
  if (aliased) {
    const hit = dbDepartments.find((d) => d.name === aliased);
    if (hit) return { ...base, departmentId: hit.id, dbName: hit.name, method: 'ALIAS' };
  }

  const exact = dbDepartments.find((d) => d.name === excelName.trim());
  if (exact) return { ...base, departmentId: exact.id, dbName: exact.name, method: 'EXACT' };

  const target = normalizeDeptName(excelName);
  const normalized = dbDepartments.find((d) => normalizeDeptName(d.name) === target);
  if (normalized) {
    return { ...base, departmentId: normalized.id, dbName: normalized.name, method: 'NORMALIZED' };
  }

  return { ...base, departmentId: null, dbName: null, method: 'NONE' };
}
