/**
 * Đọc câu hỏi để biết người dùng đang hỏi về PHÒNG BAN nào và theo NGUỒN nào —
 * từ đó chatbot lọc đúng phạm vi (không lẫn phòng khác, không lẫn phân hệ khác)
 * và gom được mọi phân hệ của cùng một phòng.
 */
import { toSearchKey } from '@/lib/crm/constants';
import { UNIT_ABBREVIATIONS } from '@/lib/work/import';
import type { KnowledgeSource } from './collect';

/** Cụm từ người dùng hay dùng để chỉ đích danh một nguồn dữ liệu. */
const SOURCE_PATTERNS: Array<[RegExp, KnowledgeSource[]]> = [
  [/\b(bao cao tom tat|tom tat tuan|tom tat hoat dong)\b/, ['weekly_summary']],
  [/\b(theo bao cao tuan|trong bao cao tuan|bao cao tuan cua|bao cao tuan phong)\b/, ['weekly_report', 'weekly_summary']],
  [/\b(so tiep doan|tiep doan|dan doan|crm|tiep khach|doan khach)\b/, ['crm', 'crm_org']],
  [/\b(mou|bien ban ghi nho|ky ket hop tac|thoa thuan hop tac)\b/, ['mou', 'crm_org']],
  [/\b(bgd giao|ban giam doc giao|cong viec chi dao|viec chi dao|chi dao cua bgd|duoc giao)\b/, ['work_item', 'work_update']],
];

/** Người dùng nói rõ một nguồn thì chỉ trả lời từ nguồn đó; câu tổng hợp ("tóm tắt", "những gì") thì không lọc. */
export function detectSources(question: string): KnowledgeSource[] | null {
  const q = ` ${toSearchKey(question).replace(/[^a-z0-9]+/g, ' ')} `;
  if (/\b(tom tat giup|tong hop|tat ca|nhung hoat dong|lien quan gi|ra sao|ho so)\b/.test(q)) return null;
  const hits = SOURCE_PATTERNS.filter(([re]) => re.test(q));
  if (hits.length !== 1) return null;
  return hits[0][1];
}

/** Mã viết tắt → tên phòng ("KHTH" → "Phòng Kế hoạch Tổng hợp"), lấy từ bảng viết tắt của phân hệ công việc. */
const ABBREVIATIONS: Array<[string, string]> = Object.entries(UNIT_ABBREVIATIONS)
  .filter(([k]) => k !== 'BGĐ')
  .flatMap(([k, v]) => {
    const code = k.replace(/^(Phòng|Khoa|Trung tâm|Đơn vị)\s+/, '');
    return code === k ? [[k, v] as [string, string]] : [[k, v] as [string, string], [code, v] as [string, string]];
  });

const fold = (s: string) => ` ${toSearchKey(s).replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Phòng ban được nhắc trong câu hỏi, trả về tên chuẩn trong danh mục. Nhận tên đầy
 * đủ (có/không dấu), "Phòng KHTH", hoặc mã viết hoa đứng riêng ("KHĐT", "CTXH").
 */
export function detectDepartments(question: string, departments: readonly string[]): string[] {
  const q = fold(question);
  const found = new Set<string>();
  for (const name of departments) {
    if (q.includes(fold(name))) found.add(name);
  }
  for (const [abbr, full] of ABBREVIATIONS) {
    if (!departments.includes(full)) continue;
    const isBareCode = !/\s/.test(abbr);
    // Mã đứng riêng phải viết hoa trong câu gốc (tránh "hc" trong từ thường); có chữ "Phòng" thì so không dấu.
    const hit = isBareCode
      ? new RegExp(`(^|[^\\p{L}])${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(question)
      : q.includes(fold(abbr));
    if (hit) found.add(full);
  }
  // "Phòng Kế hoạch Tổng hợp" chứa cả chữ "Phòng" của phòng khác? Bỏ tên là một phần tên dài hơn đã khớp.
  return [...found].filter((n) => ![...found].some((m) => m !== n && fold(m).includes(fold(n))));
}
