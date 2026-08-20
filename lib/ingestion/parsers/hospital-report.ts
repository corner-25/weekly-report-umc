import * as XLSX from 'xlsx';

/**
 * Parser báo cáo bệnh viện: mỗi sheet là một tuần → nhiệm vụ theo phòng ban.
 *
 * Cấu trúc thật (kiểm chứng 2026-08-20 trên workbook 33 sheet):
 *   - Tên sheet: "<tuần>.<năm>", vd "17.2026". Có sheet thừa dấu cách: "29.2026 "
 *   - Dòng 1-5: tiêu đề; dòng 6: header; dòng 7+: dữ liệu
 *   - Cột: Stt | Nhiệm vụ | Kết quả thực hiện | Thời gian | Tiến độ (%) | Kế hoạch tuần sau
 *   - Dòng phòng ban: cột A viết HOA toàn bộ, dài > 5 ký tự
 *   - Nhiệm vụ có thể phân cấp: dòng cha (Stt có số, Kết quả rỗng) + dòng con (Stt rỗng)
 *
 * Xem docs/ONEDRIVE-DATA-ANALYSIS.md.
 */

/** Tên sheet dạng "<tuần>.<năm>". */
const SHEET_NAME_PATTERN = /^(\d{1,2})\.(\d{4})$/;

/** Header phải nằm ở dòng này (1-based) trên mọi sheet. */
const HEADER_ROW = 6;

/** Cột A của dòng phòng ban phải dài hơn ngưỡng này để tránh nhầm với 'STT', 'A', 'I'. */
const MIN_DEPT_NAME_LENGTH = 6;

export interface HospitalTaskRow {
  /** Phòng ban phụ trách, lấy từ dòng tiêu đề nhóm gần nhất phía trên. */
  department: string;
  /** Số thứ tự trong phòng; rỗng với dòng con của một nhiệm vụ cha. */
  stt: string;
  /** Tên nhiệm vụ (cột B). */
  taskName: string;
  /** Kết quả thực hiện (cột C). */
  result: string;
  /** Thời gian thực hiện (cột D). */
  timePeriod: string;
  /** Tiến độ 0–100, null nếu không ghi hoặc không phải số. */
  progress: number | null;
  /** Kế hoạch tuần sau (cột F). */
  nextWeekPlan: string;
  /** Dòng trong sheet gốc, phục vụ truy vết khi rà soát. */
  sourceRow: number;
}

export interface HospitalWeekSheet {
  sheetName: string;
  week: number;
  year: number;
  rows: HospitalTaskRow[];
  departments: string[];
}

export interface HospitalReportParseResult {
  sheets: HospitalWeekSheet[];
  /** Sheet bị bỏ qua kèm lý do (tên không đúng dạng, header sai...). */
  skippedSheets: Array<{ sheetName: string; reason: string }>;
}

/** Ô Excel → chuỗi đã cắt khoảng trắng; null/undefined → ''. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Dòng này có phải tiêu đề phòng ban không?
 *
 * Quy tắc: cột A viết HOA toàn bộ và đủ dài. Đã kiểm trên cả 33 sheet —
 * nhận đúng 14 phòng ban mỗi sheet, không nhầm với 'Stt' hay số thứ tự.
 */
export function isDepartmentRow(colA: unknown): boolean {
  const s = cellText(colA);
  if (s.length < MIN_DEPT_NAME_LENGTH) return false;
  if (/^\d+$/.test(s)) return false;
  return s === s.toUpperCase() && s !== s.toLowerCase();
}

/**
 * Chuẩn hoá cột "Tiến độ (%)" về thang 0–100.
 *
 * Excel lưu phần trăm theo bốn cách khác nhau trong cùng file này:
 *   - số nguyên 1        → 100% (định dạng phần trăm của Excel)
 *   - số thực 0.02–0.998 → 2%–99.8%
 *   - chuỗi '100%', '99.6%', '99,7%', '40%%'
 *   - chuỗi mô tả 'Đang xử lý' → không phải số, trả null
 */
export function parseProgress(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    // Excel lưu phần trăm dưới dạng phân số: 1 = 100%, 0.996 = 99.6%
    if (raw >= 0 && raw <= 1) return Math.round(raw * 1000) / 10;
    if (raw > 1 && raw <= 100) return raw;
    return null;
  }

  const s = cellText(raw);
  if (s === '') return null;

  // '40%%' → '40', '99,7%' → '99.7'
  const cleaned = s.replace(/%/g, '').replace(',', '.').trim();
  if (cleaned === '') return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

/** Lấy tuần và năm từ tên sheet; trả null nếu tên không đúng dạng. */
export function parseSheetName(sheetName: string): { week: number; year: number } | null {
  const match = SHEET_NAME_PATTERN.exec(sheetName.trim());
  if (!match) return null;

  const week = Number(match[1]);
  const year = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return { week, year };
}

/** Đọc workbook báo cáo bệnh viện thành các sheet tuần. */
export function parseHospitalReport(buffer: Buffer): HospitalReportParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: HospitalWeekSheet[] = [];
  const skippedSheets: HospitalReportParseResult['skippedSheets'] = [];

  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheetName(sheetName);
    if (!parsed) {
      skippedSheets.push({ sheetName, reason: 'Tên sheet không đúng dạng "<tuần>.<năm>"' });
      continue;
    }

    const grid: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: true,
    });

    const headerCell = cellText(grid[HEADER_ROW - 1]?.[0]);
    if (headerCell !== 'Stt') {
      skippedSheets.push({
        sheetName,
        reason: `Dòng ${HEADER_ROW} không phải header (tìm thấy "${headerCell}" thay vì "Stt")`,
      });
      continue;
    }

    const rows: HospitalTaskRow[] = [];
    const departments: string[] = [];
    let currentDept: string | null = null;

    for (let i = HEADER_ROW; i < grid.length; i += 1) {
      const row = grid[i] ?? [];

      if (isDepartmentRow(row[0])) {
        currentDept = cellText(row[0]);
        departments.push(currentDept);
        continue;
      }

      // Nhiệm vụ luôn thuộc về một phòng ban; dòng trước tiêu đề đầu tiên là rác.
      if (!currentDept) continue;

      const taskName = cellText(row[1]);
      const result = cellText(row[2]);
      const nextWeekPlan = cellText(row[5]);

      // Dòng không có nội dung nào trong ba cột chính → dòng trống, bỏ qua.
      if (!taskName && !result && !nextWeekPlan) continue;

      rows.push({
        department: currentDept,
        stt: cellText(row[0]),
        taskName,
        result,
        timePeriod: cellText(row[3]),
        progress: parseProgress(row[4]),
        nextWeekPlan,
        sourceRow: i + 1,
      });
    }

    sheets.push({ sheetName, week: parsed.week, year: parsed.year, rows, departments });
  }

  return { sheets, skippedSheets };
}
