import * as XLSX from 'xlsx';
import { z } from 'zod';

/**
 * Parser báo cáo phòng: sheet "Số liệu tuần (<năm>)" → các dòng HcMetric.
 *
 * Đặc điểm dữ liệu thật (kiểm chứng 2026-08-20 trên file 2.278 dòng):
 *   - Header dòng 1: Tuần | Tháng | Danh mục | Nội dung | Số liệu
 *   - 24% ô "Số liệu" bỏ trống — chưa nhập, KHÔNG phải 0
 *   - Vài giá trị dùng dấu phẩy thập phân kiểu VN ('5074,1')
 *   - Ký tự '/' nghĩa là không áp dụng
 *   - Vài ô rác chỉ chứa khoảng trắng ở cột 12-13
 * Xem docs/ONEDRIVE-DATA-ANALYSIS.md.
 */

/** Tên sheet chứa số liệu, kèm năm trong ngoặc. */
const DATA_SHEET_PATTERN = /^Số liệu tuần\s*\((\d{4})\)$/i;

/** Giá trị đánh dấu "không áp dụng" trong cột Số liệu. */
const NOT_APPLICABLE = new Set(['/', '-', 'n/a', 'na']);

const RowSchema = z.object({
  week: z.number().int().min(1).max(53),
  month: z.number().int().min(1).max(12).nullable(),
  category: z.string().min(1),
  content: z.string().min(1),
  value: z.number().finite(),
});

export type DeptReportRow = z.infer<typeof RowSchema>;

export interface DeptReportParseResult {
  year: number;
  sheetName: string;
  rows: DeptReportRow[];
  /** Dòng bỏ qua vì ô Số liệu trống — bình thường, không phải lỗi. */
  emptyValueCount: number;
  /** Dòng bỏ qua vì giá trị "không áp dụng" ('/'). */
  notApplicableCount: number;
  /** Dòng bị loại kèm lý do, để ghi vào SyncLog cho người rà soát. */
  rejected: Array<{ rowNumber: number; reason: string; raw: unknown }>;
}

/**
 * Tìm sheet số liệu và lấy năm từ tên sheet.
 *
 * Năm đến từ tên sheet chứ không đoán, vì đoán sai nghĩa là ghi đè số liệu
 * năm khác. Không tìm thấy sheet đúng dạng → ném lỗi.
 */
export function findDataSheet(workbook: XLSX.WorkBook): { sheetName: string; year: number } {
  for (const name of workbook.SheetNames) {
    const match = DATA_SHEET_PATTERN.exec(name.trim());
    if (match) return { sheetName: name, year: Number(match[1]) };
  }
  throw new Error(
    `Không tìm thấy sheet "Số liệu tuần (<năm>)". Các sheet có trong file: ${workbook.SheetNames.join(', ')}`,
  );
}

/**
 * Chuyển ô "Số liệu" sang số.
 *
 * Trả về:
 *   - number       khi parse được
 *   - 'EMPTY'      khi ô trống (chưa nhập — khác 0)
 *   - 'NOT_APPLIED' khi là '/' hoặc tương đương
 *   - 'INVALID'    khi có nội dung nhưng không hiểu được
 */
export function parseMetricValue(raw: unknown): number | 'EMPTY' | 'NOT_APPLIED' | 'INVALID' {
  if (raw === null || raw === undefined) return 'EMPTY';
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 'INVALID';

  const s = String(raw).trim();
  if (s === '') return 'EMPTY';
  if (NOT_APPLICABLE.has(s.toLowerCase())) return 'NOT_APPLIED';

  // Dấu phẩy thập phân kiểu VN: '5074,1' → 5074.1
  const normalized = s.replace(/\s/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 'INVALID';
}

/** Đọc workbook báo cáo phòng thành các dòng đã kiểm chứng. */
export function parseDeptReport(buffer: Buffer): DeptReportParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const { sheetName, year } = findDataSheet(workbook);

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
  });

  const rows: DeptReportRow[] = [];
  const rejected: DeptReportParseResult['rejected'] = [];
  let emptyValueCount = 0;
  let notApplicableCount = 0;

  raw.forEach((r, i) => {
    const rowNumber = i + 2; // +1 bỏ header, +1 vì Excel đánh số từ 1

    const category = String(r['Danh mục'] ?? '').trim();
    const content = String(r['Nội dung'] ?? '').trim();

    // Dòng trống hoàn toàn — bỏ im lặng, không coi là lỗi.
    if (!category && !content) return;

    const value = parseMetricValue(r['Số liệu']);
    if (value === 'EMPTY') {
      emptyValueCount += 1;
      return; // chưa nhập số liệu — không ghi 0
    }
    if (value === 'NOT_APPLIED') {
      notApplicableCount += 1;
      return;
    }
    if (value === 'INVALID') {
      rejected.push({ rowNumber, reason: `Số liệu không đọc được: ${String(r['Số liệu'])}`, raw: r });
      return;
    }

    const parsed = RowSchema.safeParse({
      week: toInt(r['Tuần']),
      month: toInt(r['Tháng']),
      category,
      content,
      value,
    });

    if (!parsed.success) {
      rejected.push({
        rowNumber,
        reason: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        raw: r,
      });
      return;
    }

    rows.push(parsed.data);
  });

  return { year, sheetName, rows, emptyValueCount, notApplicableCount, rejected };
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
