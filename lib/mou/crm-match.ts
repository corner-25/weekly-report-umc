/**
 * Ghép đối tác ký MOU với tổ chức đã có trong CRM — cùng một đơn vị thì nối
 * lại để xem một chỗ: tiếp đoàn, đầu mối, quà tặng và hợp tác đã ký.
 *
 * Bước 1 (thuần, không AI): chấm điểm theo từ khoá phân biệt để lọc vài ứng viên.
 * Bước 2 (AI): đọc tên MOU + ứng viên, quyết định có phải cùng đơn vị không —
 * phân biệt được "Nhi đồng 1" với "Nhi đồng 2", công ty mẹ với chi nhánh.
 */
import { z } from 'zod';
import { toSearchKey } from '@/lib/crm/constants';
import { partnerAliases } from './assess';

export interface OrgCandidate {
  id: string;
  name: string;
  aliases: string[];
  category: string | null;
  scope: string | null;
}

/** Chữ chung chung không giúp phân biệt đơn vị (đã bỏ dấu, viết thường). */
const GENERIC = new Set(
  ('cong ty tnhh cp co phan mtv mot thanh vien trach nhiem huu han chi nhanh tap doan benh vien bv da khoa dk truong dai hoc dh hoc vien ' +
    'vien trung tam quoc te thanh pho tp ho chi minh hcm tphcm viet nam va cua ve to chuc hoi quy dich vu dau tu tu van y te ky thuat ' +
    'phong kham the and of the hospital university center centre company limited ltd inc llc group vpdd van phong dai dien tinh ' +
    'bvdk han nhat ban loan hoa ky uc phap duoc')
    .split(' '),
);

export function distinctiveTokens(name: string): string[] {
  return [...new Set(toSearchKey(name).split(/[^a-z0-9]+/).filter((t) => t && !GENERIC.has(t)))];
}

/**
 * Điểm giống nhau 0–1: tỷ lệ từ phân biệt của tên ngắn hơn có mặt trong tên kia
 * (lấy cặp cách gọi khớp nhất). Số (1, 2, 115, 30-4) phải khớp đúng — lệch số là khác đơn vị.
 */
export function nameScore(a: string, b: string): number {
  const ta = distinctiveTokens(a);
  const tb = distinctiveTokens(b);
  if (!ta.length || !tb.length) return 0;
  const numsA = ta.filter((t) => /^\d+$/.test(t));
  const numsB = tb.filter((t) => /^\d+$/.test(t));
  if (numsA.length && numsB.length && !numsA.some((n) => numsB.includes(n))) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const hit = short.filter((t) => long.includes(t)).length;
  return hit / short.length;
}

export function rankCandidates(partnerName: string, orgs: OrgCandidate[], limit = 6): Array<OrgCandidate & { score: number }> {
  const names = partnerAliases(partnerName);
  return orgs
    .map((o) => ({ ...o, score: Math.max(...names.flatMap((n) => [o.name, ...o.aliases].map((on) => nameScore(n, on)))) }))
    .filter((o) => o.score >= 0.5)
    .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name, 'vi'))
    .slice(0, limit);
}

export const matchResultSchema = z.object({
  results: z.array(
    z.object({
      mou: z.number().int().min(1),
      match: z.string().nullable().catch(null),
      relation: z.enum(['SAME', 'PARENT', 'BRANCH', 'NONE']).catch('NONE'),
      confidence: z.enum(['high', 'medium', 'low']).catch('low'),
      reason: z.string().trim().min(1).catch(''),
    }),
  ),
});
export type MatchResult = z.infer<typeof matchResultSchema>['results'][number];

export interface MatchItem {
  partnerName: string;
  partnerCountry: string | null;
  field: string | null;
  candidates: Array<OrgCandidate & { score: number }>;
}

export function buildMatchPrompt(items: MatchItem[]): string {
  const blocks = items
    .map((it, i) => {
      const cands = it.candidates.length
        ? it.candidates.map((c, j) => `   C${j + 1}. ${c.name}${c.aliases.length ? ` (tên khác: ${c.aliases.slice(0, 4).join('; ')})` : ''}${c.category ? ` · ${c.category}` : ''}${c.scope ? ` · ${c.scope}` : ''}`).join('\n')
        : '   (không có ứng viên)';
      return `MOU ${i + 1}: ${it.partnerName}${it.partnerCountry ? ` · ${it.partnerCountry}` : ''}${it.field ? ` · lĩnh vực ${it.field}` : ''}\n${cands}`;
    })
    .join('\n\n');
  return `Bạn chuẩn hoá danh mục đối tác của Bệnh viện Đại học Y Dược TP.HCM. Với mỗi đối tác đã ký MOU dưới đây, chọn tổ chức TRONG CRM là cùng một đơn vị (nếu có) trong danh sách ứng viên.

## Quy tắc
1. "SAME": cùng một đơn vị, chỉ khác cách viết (có/không "Công ty TNHH", viết tắt BV/ĐH, có/không "Việt Nam", "TP.HCM"). Vd "Công ty TNHH Bệnh viện Đa khoa Thiện Hạnh" = "Bệnh viện Đa khoa Thiện Hạnh".
2. "PARENT": ứng viên là đơn vị mẹ của đối tác (đối tác là chi nhánh/phòng khám thuộc ứng viên). "BRANCH": ứng viên là chi nhánh/đơn vị con của đối tác. Hai loại này vẫn ghép được nhưng confidence tối đa medium.
3. "NONE" và match null khi không ứng viên nào đúng. Khác số hiệu là khác đơn vị (Nhi đồng 1 ≠ Nhi đồng 2 ≠ Nhi đồng Thành phố; Bệnh viện 30-4 ≠ Bệnh viện 199). Cùng tên tập đoàn nhưng khác pháp nhân rõ ràng (vd Dược liệu Trung ương 2 ≠ Dược phẩm Trung ương 2) là NONE.
4. confidence: high khi chắc chắn; medium khi gần như chắc nhưng tên lệch đáng kể; low khi nghi ngờ.
5. reason: một câu ngắn tiếng Việt.

## Danh sách
${blocks}

Trả về DUY NHẤT JSON: {"results":[{"mou":1,"match":"C2"|null,"relation":"SAME"|"PARENT"|"BRANCH"|"NONE","confidence":"high"|"medium"|"low","reason":"..."}]} — đủ ${items.length} phần tử, đúng thứ tự.`;
}

export function parseMatch(raw: unknown): MatchResult[] {
  return matchResultSchema.parse(raw).results;
}
