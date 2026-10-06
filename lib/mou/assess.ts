/**
 * Đối chiếu từng khía cạnh đã ký của một MOU với dữ liệu triển khai thật trong
 * hệ thống: nhật ký tiến độ trên office, hoạt động ghi trong phân hệ MOU, và
 * mọi đoạn tri thức nhắc tới đối tác (báo cáo tuần các phòng, tiếp đoàn CRM,
 * công việc chỉ đạo, sự kiện). AI chỉ xếp mức triển khai và GỢI Ý đánh giá —
 * Phòng HC/lãnh đạo chốt.
 */
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { toSearchKey } from '@/lib/crm/constants';
import type { Aspect } from './extract';

export const VERDICTS = ['SUCCESS', 'ON_TRACK', 'AT_RISK', 'FAILED', 'TOO_EARLY'] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABELS: Record<Verdict, string> = {
  SUCCESS: 'Thành công',
  ON_TRACK: 'Đang tiến triển',
  AT_RISK: 'Có nguy cơ',
  FAILED: 'Không hiệu quả',
  TOO_EARLY: 'Mới ký, chưa đánh giá',
};
export const VERDICT_DEFS: Record<Verdict, string> = {
  SUCCESS: 'Phần lớn khía cạnh đã ký có kết quả cụ thể, có bằng chứng.',
  ON_TRACK: 'Đã triển khai một phần, có hoạt động trong 6 tháng gần đây.',
  AT_RISK: 'Ký đã hơn 6 tháng mà ít hoặc không có bằng chứng triển khai, hoặc hoạt động gần nhất đã cũ hơn 12 tháng.',
  FAILED: 'Phòng đầu mối ghi chưa triển khai / không hiệu quả, hoặc đã hết hạn mà không có kết quả.',
  TOO_EARLY: 'Ký chưa đầy 6 tháng, chưa có bằng chứng — chưa đủ thời gian để đánh giá.',
};

/** Đánh giá do người chốt — không có "mới ký": người đánh giá thì đã đủ căn cứ. */
export const EVALUATIONS = ['SUCCESS', 'ON_TRACK', 'AT_RISK', 'FAILED'] as const;
export type Evaluation = (typeof EVALUATIONS)[number];

/** Đoạn bằng chứng đưa cho AI, đánh số [E1]… để trả lời trỏ về đúng nguồn. */
export interface EvidenceSnippet {
  ref: string;
  date: string | null;
  source: string;
  title: string;
  text: string;
  href: string | null;
}

const LEGAL_FORMS =
  /^(chi nhánh\s+)?(văn phòng đại diện\s+|vpđd\s+)?((công ty|cty)\s+)?((tnhh|cp|cổ phần|trách nhiệm hữu hạn|mtv|một thành viên|dịch vụ|đầu tư|tư vấn)\s+)*(tổ chức\s+)?/i;
/** Đuôi địa danh/quốc gia không giúp phân biệt đối tác. */
const PLACE_SUFFIX = /\s*(,|-|–)?\s*(thành phố hồ chí minh|tp\.?\s*hồ chí minh|tp\.?\s*hcm|tphcm|hàn quốc|nhật bản|đài loan|hoa kỳ|việt nam)$/i;
/** Từ chỉ ngành nghề đứng trước tên riêng của doanh nghiệp ("Thiết bị Y tế Olympus" → "Olympus"). */
const TRADE_PREFIX = /^(tập đoàn|dược phẩm|thiết bị y tế|kỹ thuật truyền thông|doanh nghiệp xã hội|ngân hàng mô)\s+/i;
/** Viết tắt trong ngoặc mới dùng làm tên gọi (UEL); ngoặc chỉ quốc gia/cơ quan chủ quản/ghi chú thì bỏ. */
const ACRONYM = /^[A-Z][A-Z0-9&.-]{1,10}$/;

function shortForms(name: string): string[] {
  const out: string[] = [];
  const uni = name.match(/^(?:Trường\s+)?Đại học\s+(.+)$/i)?.[1];
  if (uni) out.push(`Đại học ${uni}`, `ĐH ${uni}`, `Trường ĐH ${uni}`);
  const hos = name.match(/^Bệnh viện\s+(?:Đa khoa\s+|ĐK\s+)?(?:tỉnh\s+|Quốc tế\s+)?(.+)$/i)?.[1];
  if (hos) out.push(`Bệnh viện ${hos}`, `BV ${hos}`, `BVĐK ${hos}`);
  return out;
}

/**
 * Các cách gọi đối tác để dò trong văn bản tự do (báo cáo tuần viết tắt nhiều):
 * tên đủ, bỏ loại hình doanh nghiệp, bỏ đuôi địa danh, cắt phần sau dấu phẩy/
 * gạch ngang, viết tắt Bệnh viện → BV, Đại học → ĐH, tên thương hiệu của doanh nghiệp.
 */
export function partnerAliases(name: string): string[] {
  const out = new Set<string>([name.trim()]);
  const noParen = name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const core = noParen.replace(LEGAL_FORMS, '').trim();
  // Cắt phần cơ quan chủ quản/địa danh phía sau ("…, Đài Loan", "… - Đại học Quốc gia …"), giữ "Kinh tế - Luật".
  const firstPart = core.split(/\s*,\s*|\s+[-–]\s+(?=(?:Đại học|ĐH|Chi nhánh|Công ty|thành viên|Đài Loan|Hàn Quốc|Nhật Bản)\b)/i)[0].trim();
  const bases = [...new Set([core, firstPart, core.replace(PLACE_SUFFIX, '').trim(), firstPart.replace(PLACE_SUFFIX, '').trim()])];
  for (const base of bases) {
    if (base.split(' ').length >= 2 || ACRONYM.test(base)) out.add(base);
    for (const f of shortForms(base)) out.add(f);
    const brand = base.replace(TRADE_PREFIX, '').replace(PLACE_SUFFIX, '').trim();
    // Tên thương hiệu một từ chỉ nhận khi viết hoa và đủ dài (Pfizer, Olympus) để khỏi trùng từ thường.
    const properName = brand.split(' ').every((w) => /^[\p{Lu}\d]/u.test(w));
    if (brand !== base && properName && (brand.includes(' ') || /^[A-Z][A-Za-z]{4,}$/.test(brand))) out.add(brand);
  }
  for (const m of name.matchAll(/\(([^)]+)\)/g)) if (ACRONYM.test(m[1].trim())) out.add(m[1].trim());
  return [...out].filter((a) => a.length >= 4 || ACRONYM.test(a));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Đoạn tri thức nhắc tới đối tác (không tính chính MOU), mới nhất trước. */
export async function knowledgeEvidence(db: PrismaClient, partnerName: string, limit = 24): Promise<Array<Omit<EvidenceSnippet, 'ref'>>> {
  const patterns = partnerAliases(partnerName).map((a) => `%${escapeLike(toSearchKey(a))}%`);
  const rows = await db.$queryRawUnsafe<Array<{ source: string; title: string; body: string; occurred_on: Date | null; href: string | null }>>(
    `SELECT source, title, body, occurred_on, href FROM knowledge_chunks
      WHERE source <> 'mou' AND search_key ILIKE ANY($1::text[])
      ORDER BY occurred_on DESC NULLS LAST LIMIT $2`,
    patterns,
    limit,
  );
  return rows.map((r) => ({
    date: r.occurred_on ? r.occurred_on.toISOString().slice(0, 10) : null,
    source: r.source,
    title: r.title,
    text: focusOn(r.body, partnerAliases(partnerName)),
    href: r.href,
  }));
}

const SNIPPET_CHARS = 700;

/** Cắt đoạn quanh chỗ nhắc tới đối tác — báo cáo tuần một phòng dài vài nghìn chữ. */
export function focusOn(body: string, aliases: string[]): string {
  if (body.length <= SNIPPET_CHARS) return body;
  const key = toSearchKey(body);
  const hit = aliases.map((a) => key.indexOf(toSearchKey(a))).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 250);
  return `${start > 0 ? '…' : ''}${body.slice(start, start + SNIPPET_CHARS)}…`;
}

export const assessmentSchema = z.object({
  aspects: z
    .array(
      z.object({
        index: z.number().int().min(1),
        status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).catch('NOT_STARTED'),
        progress: z.number().min(0).max(100).catch(0),
        evidence: z.array(z.object({ ref: z.string(), summary: z.string().trim().min(2) })).catch([]),
        gap: z.string().trim().min(1).nullable().catch(null),
      }),
    )
    .catch([]),
  otherActivities: z.array(z.object({ ref: z.string(), summary: z.string().trim().min(2) })).catch([]),
  lastActivityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  implementationLevel: z.number().min(0).max(100).catch(0),
  verdict: z.enum(VERDICTS).catch('AT_RISK'),
  rationale: z.string().trim().min(2),
  risks: z.array(z.string().trim().min(2)).catch([]),
  recommendations: z.array(z.string().trim().min(2)).catch([]),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export interface AssessInput {
  partnerName: string;
  title: string;
  signedDate: string | null;
  expiryDate: string | null;
  today: string;
  department: string | null;
  officeStatus: string | null;
  officeProgress: number | null;
  aspects: Aspect[];
  logs: Array<{ date: string; content: string; author: string | null }>;
  activities: Array<{ date: string | null; title: string; status: string; result: string | null }>;
  evidence: EvidenceSnippet[];
}

export function buildAssessPrompt(input: AssessInput): string {
  const aspects = input.aspects.length
    ? input.aspects.map((a, i) => `${i + 1}. [${a.type}] ${a.title} — ${a.content}${a.commitments.length ? `\n   Cam kết: ${a.commitments.join('; ')}` : ''}${a.deliverable ? `\n   Kết quả đo được: ${a.deliverable}` : ''}`).join('\n')
    : '(Chưa trích được khía cạnh nào từ văn bản — đánh giá theo mô tả chung của MOU)';
  const logs = input.logs.length ? input.logs.map((l) => `- ${l.date}${l.author ? ` (${l.author})` : ''}: ${l.content}`).join('\n') : '(không có)';
  const acts = input.activities.length ? input.activities.map((a) => `- ${a.date ?? '?'} [${a.status}] ${a.title}${a.result ? ` — kết quả: ${a.result}` : ''}`).join('\n') : '(không có)';
  const ev = input.evidence.length
    ? input.evidence.map((e) => `[${e.ref}] ${e.date ?? 'không rõ ngày'} · ${e.source} · ${e.title}\n${e.text}`).join('\n\n')
    : '(không tìm thấy đoạn nào nhắc tới đối tác)';

  return `Bạn là chuyên viên theo dõi hợp tác của Bệnh viện Đại học Y Dược TP.HCM (UMC). Đánh giá MOU dưới đây đã triển khai đến đâu, CHỈ dựa trên bằng chứng được cung cấp.

## MOU
- ${input.title} · Đối tác: ${input.partnerName}
- Ký: ${input.signedDate ?? 'không rõ'} · Hết hạn: ${input.expiryDate ?? 'không ghi'} · Hôm nay: ${input.today}
- Phòng đầu mối: ${input.department ?? 'chưa giao'}
- Trên hệ thống office: trạng thái "${input.officeStatus ?? 'không rõ'}", tiến độ ${input.officeProgress ?? 'chưa ghi'}%

## Các khía cạnh đã ký
${aspects}

## Nhật ký tiến độ phòng đầu mối ghi trên office
${logs}

## Hoạt động ghi trong phân hệ MOU
${acts}

## Đoạn trích từ các phân hệ khác có nhắc tới đối tác (báo cáo tuần các phòng, tiếp đoàn, công việc, sự kiện)
${ev}

## Quy tắc
1. Một đoạn chỉ là bằng chứng khi nói RÕ về hoạt động với chính đối tác này (cùng tên/viết tắt) và liên quan khía cạnh đó. Trùng tên địa danh, đơn vị khác cùng tên chung (vd "Bệnh viện Nhi đồng" khác "Nhi đồng 1") thì bỏ.
2. Lễ ký kết, tờ trình, chuẩn bị ký KHÔNG phải triển khai. Triển khai là: lớp đào tạo đã mở, ca bệnh/hội chẩn đã làm, chuyên gia đã sang, nghiên cứu đã khởi động, sự kiện đã tổ chức, tài trợ đã nhận…
3. Mỗi khía cạnh: status NOT_STARTED (không có bằng chứng), IN_PROGRESS (có hoạt động, chưa đạt kết quả cam kết), COMPLETED (đạt kết quả cam kết); progress 0–100 ước theo bằng chứng; evidence là danh sách {ref: "E3", summary: "Tháng 5/2026 mở lớp nội soi khóa 1, 12 học viên"} — chỉ dùng ref có trong danh sách trên; "gap": còn thiếu gì so với cam kết.
4. Nhật ký office là lời phòng đầu mối — tin được (vd "Chưa triển khai hợp tác" → các khía cạnh NOT_STARTED).
5. "otherActivities": hoạt động có thật với đối tác nhưng không thuộc khía cạnh nào. "lastActivityDate": ngày của bằng chứng triển khai gần nhất (YYYY-MM-DD) hoặc null.
6. "verdict" gợi ý một trong:
${VERDICTS.map((v) => `   - ${v} (${VERDICT_LABELS[v]}): ${VERDICT_DEFS[v]}`).join('\n')}
7. "rationale": 1–3 câu giải thích, nêu số khía cạnh có bằng chứng / tổng. "risks", "recommendations": tối đa 3 ý mỗi loại, cụ thể (ai làm gì) — chỉ nhắc tới phòng đầu mối nêu trên hoặc "Ban Giám đốc", không tự đặt tên phòng ban khác.
8. Tiếng Việt có dấu. Không bịa số liệu, không bịa ngày.

Trả về DUY NHẤT JSON: {"aspects":[{"index":1,"status":"...","progress":0,"evidence":[],"gap":null}],"otherActivities":[],"lastActivityDate":null,"implementationLevel":0,"verdict":"...","rationale":"...","risks":[],"recommendations":[]}`;
}

export function parseAssessment(raw: unknown): Assessment {
  return assessmentSchema.parse(raw);
}
