/**
 * Dấu vân tay nội dung báo cáo của một phòng trong một tuần.
 *
 * Phòng Hành chính tạo sheet tuần mới bằng cách CHÉP sheet tuần trước rồi các
 * phòng sửa dần trong tuần. Nạp ngay khi sheet vừa xuất hiện là nạp số liệu tuần
 * trước dưới nhãn tuần này — đo trên production: tuần 35-39 có 70-80% đoạn văn
 * đã trích thực ra là của sheet tuần trước, làm doanh thu bãi xe, tổng đài, văn
 * bản… lệch đúng một tuần.
 *
 * Dấu vân tay cho phép:
 *   - nạp lại đúng phòng có nội dung thay đổi sau lần nạp trước
 *   - nhận ra phòng chưa sửa bản chép (trùng hệt tuần trước) để chưa nạp
 */
import { computeChecksum } from '../checksum';
import type { DepartmentWeekTasks } from './hospital-week-tasks';

type DepartmentTasks = DepartmentWeekTasks['tasks'];

/** Chuẩn hoá khoảng trắng để sửa định dạng lặt vặt không bị coi là đổi nội dung. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Hash nội dung báo cáo của một phòng.
 *
 * Bỏ số dòng gốc: chèn một dòng ở phòng phía trên làm dịch số dòng của mọi
 * phòng phía dưới, nhưng nội dung của họ không đổi.
 */
export function departmentContentHash(tasks: DepartmentTasks): string {
  return computeChecksum(
    tasks.map((t) => [normalize(t.rawName), normalize(t.resultText), t.progress ?? null]),
  );
}

/**
 * Phòng chưa cập nhật sheet chép từ tuần trước: nội dung y hệt tuần trước.
 *
 * Phòng không có dòng nào thì không coi là bản chép — không có gì để nạp nhầm.
 */
export function isUneditedCopy(currentHash: string, previousHash: string | undefined, taskCount: number): boolean {
  return taskCount > 0 && previousHash !== undefined && currentHash === previousHash;
}
