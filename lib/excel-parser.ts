import * as XLSX from 'xlsx';

export interface ParsedTask {
  orderNumber: number;
  taskName: string;
  result: string;
  timePeriod: string;
  progress: number | null;
  isImportant: boolean;
  subItems: string[]; // Sub-rows merged into this task
}

export interface ParsedDepartment {
  name: string;
  tasks: ParsedTask[];
}

export interface ParsedWeekData {
  departments: ParsedDepartment[];
  rawRowCount: number;
}

/**
 * Parse an Excel file buffer into structured weekly report data.
 * Expected format: 5 columns (Stt, Nhiệm vụ, Kết quả, Thời gian, Tiến độ)
 * Department headers are rows where col 0 has a long text and cols 1-4 are empty.
 */
export function parseExcelFile(buffer: ArrayBuffer): ParsedWeekData {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const departments: ParsedDepartment[] = [];
  let currentDept: ParsedDepartment | null = null;
  let currentTask: ParsedTask | null = null;
  let taskOrder = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();
    const col2 = String(row[2] ?? '').trim();
    const col3 = String(row[3] ?? '').trim();
    const col4 = String(row[4] ?? '').trim();

    // Skip header row
    if (col0 === 'Stt' || col0 === 'STT') continue;

    // Skip completely empty rows
    if (!col0 && !col1 && !col2 && !col3 && !col4) continue;

    // Detect department header: text in col0 only, other cols empty/whitespace
    if (isDepartmentHeader(col0, col1, col2)) {
      // Save previous task to previous dept
      if (currentTask && currentDept) {
        currentDept.tasks.push(currentTask);
        currentTask = null;
      }

      currentDept = { name: col0, tasks: [] };
      departments.push(currentDept);
      taskOrder = 0;
      continue;
    }

    if (!currentDept) continue;

    // Numbered row = new task (col0 is a number)
    const stt = parseFloat(col0);
    if (!isNaN(stt) && stt > 0 && col1) {
      // Save previous task
      if (currentTask) {
        currentDept.tasks.push(currentTask);
      }
      taskOrder++;
      currentTask = {
        orderNumber: taskOrder,
        taskName: col1,
        result: col2,
        timePeriod: col3,
        progress: normalizeProgress(col4),
        isImportant: false,
        subItems: [],
      };
      continue;
    }

    // Sub-row (no number in col0): either continuation of current task or a sub-item
    if (currentTask) {
      // If col1 has text, it's a sub-task name
      if (col1) {
        // Append sub-item result
        const subResult = col2 || col1;
        currentTask.subItems.push(subResult);
        // Merge result
        if (col2) {
          currentTask.result = currentTask.result
            ? currentTask.result + '\n' + col2
            : col2;
        }
        // Update timePeriod if provided
        if (col3) {
          currentTask.timePeriod = currentTask.timePeriod || col3;
        }
        // Update progress if sub-row has a progress value
        if (col4) {
          const subProgress = normalizeProgress(col4);
          if (subProgress !== null) {
            currentTask.progress = subProgress;
          }
        }
      } else if (col2) {
        // Just result text continuation
        currentTask.result = currentTask.result
          ? currentTask.result + '\n' + col2
          : col2;
        if (col3) {
          currentTask.timePeriod = currentTask.timePeriod || col3;
        }
        if (col4) {
          const subProgress = normalizeProgress(col4);
          if (subProgress !== null) {
            currentTask.progress = subProgress;
          }
        }
      }
    }
  }

  // Push last task
  if (currentTask && currentDept) {
    currentDept.tasks.push(currentTask);
  }

  return { departments, rawRowCount: rows.length };
}

function isDepartmentHeader(col0: string, col1: string, col2: string): boolean {
  if (!col0 || col0.length < 4) return false;
  if (col1 || (col2 && col2.trim())) return false;
  // Must not be a number
  if (!isNaN(Number(col0))) return false;
  // Common department prefixes
  const deptPrefixes = ['PHÒNG', 'TRUNG TÂM', 'ĐƠN VỊ', 'BAN', 'KHOA'];
  const upper = col0.toUpperCase();
  return deptPrefixes.some(p => upper.startsWith(p));
}

/**
 * Normalize progress values:
 * - Empty/whitespace → null
 * - Values <= 1 (e.g. 0.8, 0.13, 1) → multiply by 100
 * - Values > 1 and <= 100 → use as-is, rounded
 * - Values > 100 → null (invalid)
 */
export function normalizeProgress(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === ' ') return null;

  // Handle Vietnamese percentage format like "100%" or "80%"
  const cleaned = str.replace('%', '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  if (num <= 0) return null;
  if (num <= 1) return Math.round(num * 100);
  if (num <= 100) return Math.round(num);
  return null;
}

/**
 * Parse Vietnamese number format (dots as thousands separators)
 * e.g., "1.832" → 1832, "106.030.000" → 106030000
 */
export function parseVietnameseNumber(text: string): number | null {
  // Remove everything except digits, dots, and commas
  let cleaned = text.trim();

  // If it has both dots and commas, dots are thousands separators
  // If only dots: check if format is like "1.832" (thousands) vs "99.83" (decimal)
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Check if it looks like thousands separator (groups of 3 after dot)
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Thousands separator
      cleaned = cleaned.replace(/\./g, '');
    }
    // Otherwise it's a decimal number, leave as-is
  } else if (cleaned.includes(',')) {
    // Comma is decimal separator in Vietnamese
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
