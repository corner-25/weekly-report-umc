/**
 * Tách nhiệm vụ theo phòng ban từ một sheet tuần của báo cáo bệnh viện.
 *
 * `hospital-report.ts` đọc workbook thành các sheet tuần dạng thô; module này
 * chuyển tiếp thành đầu vào cho pipeline AI, gồm cả quan hệ cha–con.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import type { HospitalTaskRow, HospitalWeekSheet } from './hospital-report';

export interface DepartmentWeekTasks {
  departmentName: string;
  tasks: Array<{
    rawName: string;
    resultText: string;
    parentGroup: string | null;
    progress: number | null;
    /**
     * Dòng trong sheet gốc. Nhiều dòng con không có tên nên đều mang tên nhóm
     * cha; không có định danh riêng thì chúng đè lên nhau khi tra cứu.
     */
    sourceRow: number;
  }>;
}

/**
 * Dòng chỉ có tên nhiệm vụ mà không có kết quả là **tiêu đề nhóm**, không phải
 * nhiệm vụ thật. Đo trên dữ liệu: 672/4.879 dòng thuộc loại này. Đưa chúng vào
 * pipeline sẽ làm hỏng cả việc đếm lẫn việc khớp.
 */
function isGroupHeader(row: HospitalTaskRow, next: HospitalTaskRow | undefined): boolean {
  if (row.result !== '' || row.nextWeekPlan !== '') return false;
  // Có số thứ tự và dòng kế tiếp không có số → đây là dòng mở nhóm.
  return row.stt !== '' && next !== undefined && next.stt === '';
}

/** Nhóm nhiệm vụ của một sheet tuần theo phòng ban, gắn nhóm cha. */
export function extractWeekTasksByDepartment(sheet: HospitalWeekSheet): DepartmentWeekTasks[] {
  const byDept = new Map<string, DepartmentWeekTasks>();
  let currentParent: string | null = null;
  let currentDept: string | null = null;

  sheet.rows.forEach((row, index) => {
    if (row.department !== currentDept) {
      currentDept = row.department;
      currentParent = null; // sang phòng mới thì quên nhóm cha cũ
    }

    if (isGroupHeader(row, sheet.rows[index + 1])) {
      currentParent = row.taskName;
      return;
    }

    // Không có tên lẫn kết quả thì không phải nhiệm vụ.
    if (!row.taskName && !row.result) return;

    const entry = byDept.get(row.department) ?? {
      departmentName: row.department,
      tasks: [],
    };
    entry.tasks.push({
      rawName: row.taskName || currentParent || '(không tên)',
      resultText: row.result,
      parentGroup: currentParent,
      progress: row.progress,
      sourceRow: row.sourceRow,
    });
    byDept.set(row.department, entry);
  });

  return [...byDept.values()];
}
