/**
 * AI đọc văn bản ký kết của một MOU (chữ đã OCR) và trích ra: các bên, người
 * ký, thời hạn, và từng KHÍA CẠNH hợp tác với cam kết cụ thể của mỗi bên — để
 * sau đó đối chiếu xem khía cạnh nào đã triển khai.
 *
 * Mẫu trích xuất do người đọc tay một biên bản thật (BV Đa khoa tỉnh Ninh Bình)
 * — model trích hàng loạt theo đúng khuôn đó.
 */
import { z } from 'zod';

export const ASPECT_TYPES = [
  'TRAINING', 'RESEARCH', 'CLINICAL', 'TECHNOLOGY_TRANSFER', 'EXPERT_EXCHANGE', 'FACILITY',
  'EQUIPMENT', 'FINANCE', 'HR', 'EVENT', 'PUBLICATION', 'OTHER',
] as const;
export type AspectType = (typeof ASPECT_TYPES)[number];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null);
const text = z.string().trim().min(1).nullable().catch(null);

export const aspectSchema = z.object({
  type: z.enum(ASPECT_TYPES).catch('OTHER'),
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(2),
  responsibleParty: z.enum(['UMC', 'PARTNER', 'BOTH']).catch('BOTH'),
  commitments: z.array(z.string().trim().min(2)).catch([]),
  deliverable: text,
  deadline: dateStr,
});
export type Aspect = z.infer<typeof aspectSchema>;

export const extractionSchema = z.object({
  hasSignedText: z.boolean().catch(false),
  documentTitle: text,
  documentKind: text,
  signedDate: dateStr,
  effectiveDate: dateStr,
  expiryDate: dateStr,
  termYears: z.number().min(0).max(50).nullable().catch(null),
  termText: text,
  autoRenew: z.boolean().nullable().catch(null),
  signingLevel: text,
  partnerCountry: text,
  parties: z
    .array(
      z.object({
        side: z.enum(['UMC', 'PARTNER', 'OTHER']).catch('OTHER'),
        name: z.string().trim().min(2),
        representative: text,
        position: text,
      }),
    )
    .catch([]),
  purpose: text,
  aspects: z.array(aspectSchema).catch([]),
  financialTerms: text,
  terminationTerms: text,
  followUp: text,
  approval: text,
  contactPoints: z.array(z.object({ side: z.enum(['UMC', 'PARTNER']).catch('UMC'), name: z.string().trim().min(2), position: text, contact: text })).catch([]),
  confidence: z.enum(['high', 'medium', 'low']).catch('low'),
  notes: text,
});
export type MouExtraction = z.infer<typeof extractionSchema>;

/** Kết quả mẫu — người đọc tay "MOU - BV NINH BINH.pdf" (2 trang, bản scan). */
export const REFERENCE_EXTRACTION: MouExtraction = {
  hasSignedText: true,
  documentTitle: 'Biên bản ghi nhớ về việc tư vấn hỗ trợ chuyên môn giữa Bệnh viện Đại học Y Dược TP.HCM và Bệnh viện Đa khoa tỉnh Ninh Bình',
  documentKind: 'Biên bản ghi nhớ',
  signedDate: '2024-04-19',
  effectiveDate: '2024-04-19',
  expiryDate: null,
  termYears: null,
  termText: 'Có hiệu lực từ ngày ký đến khi các bên ký kết hợp đồng',
  autoRenew: null,
  signingLevel: 'Bệnh viện',
  partnerCountry: 'Việt Nam',
  parties: [
    { side: 'UMC', name: 'Bệnh viện Đại học Y Dược Thành phố Hồ Chí Minh', representative: 'Nguyễn Hoàng Bắc', position: 'Giám đốc' },
    { side: 'PARTNER', name: 'Bệnh viện Đa khoa tỉnh Ninh Bình', representative: 'Chu Thị Giang', position: 'Giám đốc' },
  ],
  purpose: 'UMC tư vấn, hỗ trợ chuyên môn cho BV Đa khoa tỉnh Ninh Bình về phẫu thuật nội soi tiêu hóa và quản trị bệnh viện.',
  aspects: [
    {
      type: 'TRAINING',
      title: 'Thành lập Trung tâm Đào tạo phẫu thuật nội soi tiêu hóa',
      content: 'UMC hỗ trợ BV Ninh Bình thành lập Trung tâm Đào tạo phẫu thuật nội soi tiêu hóa và hỗ trợ chiêu sinh học viên cho các lớp do BV Ninh Bình tổ chức.',
      responsibleParty: 'UMC',
      commitments: [
        'Hỗ trợ thành lập Trung tâm Đào tạo phẫu thuật nội soi tiêu hóa tại BV Ninh Bình',
        'Hỗ trợ chiêu sinh các lớp: nội soi căn bản ổ bụng, thoát vị thành bụng, đại trực tràng, đường mật, ống tiêu hóa',
      ],
      deliverable: 'Trung tâm đào tạo được thành lập; các lớp phẫu thuật nội soi có học viên',
      deadline: null,
    },
    {
      type: 'TECHNOLOGY_TRANSFER',
      title: 'Đào tạo nâng cao, tư vấn cơ sở vật chất – trang thiết bị phẫu thuật nội soi',
      content: 'UMC tư vấn, đào tạo nâng cao năng lực phẫu thuật nội soi và tư vấn cơ sở vật chất, trang thiết bị; hai bên xây dựng chương trình đào tạo dựa trên chương trình của Trung tâm Huấn luyện phẫu thuật nội soi UMC.',
      responsibleParty: 'BOTH',
      commitments: [
        'UMC đào tạo nâng cao năng lực phẫu thuật nội soi cho BV Ninh Bình',
        'UMC tư vấn cơ sở vật chất, trang thiết bị phẫu thuật nội soi',
        'BV Ninh Bình phối hợp xây dựng chương trình đào tạo theo chương trình của UMC',
      ],
      deliverable: 'Chương trình đào tạo phẫu thuật nội soi áp dụng tại BV Ninh Bình',
      deadline: null,
    },
    {
      type: 'OTHER',
      title: 'Tư vấn quản trị bệnh viện',
      content: 'UMC tư vấn quản trị bệnh viện: tài chính, đấu thầu thuốc – vật tư – trang thiết bị, quy trình quản lý khám chữa bệnh, thanh quyết toán BHYT, chăm sóc khách hàng.',
      responsibleParty: 'UMC',
      commitments: ['Tư vấn tài chính, đấu thầu, quy trình khám chữa bệnh, thanh quyết toán BHYT, chăm sóc khách hàng'],
      deliverable: null,
      deadline: null,
    },
  ],
  financialTerms: 'Không quy định; nội dung chi tiết thỏa thuận trong hợp đồng trước khi thực hiện',
  terminationTerms: 'Sửa đổi, bổ sung hoặc chấm dứt phải báo trước bằng văn bản ít nhất 30 ngày',
  followUp: 'Ký hợp đồng chi tiết cho từng nội dung trước khi thực hiện',
  approval: null,
  contactPoints: [],
  confidence: 'high',
  notes: 'Bản scan; ngày ký lấy theo hệ thống office vì văn bản không ghi rõ ngày. Hợp tác không độc quyền.',
};

export interface ExtractDoc {
  fileName: string;
  documentType: string | null;
  text: string;
}

export interface ExtractInput {
  title: string;
  partnerName: string;
  officeField: string | null;
  officeSignedDate: string | null;
  officeExpiryDate: string | null;
  officeDescription: string | null;
  docs: ExtractDoc[];
}

/** Giới hạn chữ mỗi văn bản / cả MOU để prompt không phình (MOU dài thường ≤ 10 trang). */
const MAX_DOC_CHARS = 14_000;
const MAX_TOTAL_CHARS = 36_000;

/** Biên bản ký trước, tờ trình/kế hoạch sau — khi phải cắt thì cắt phần phụ. */
const DOC_PRIORITY = (t: string | null) => (t === 'Biên bản ghi nhớ' || t === 'Hợp đồng' ? 0 : t === 'Tờ trình' ? 1 : 2);

export function buildExtractPrompt(input: ExtractInput): string {
  let budget = MAX_TOTAL_CHARS;
  const docs = [...input.docs]
    .sort((a, b) => DOC_PRIORITY(a.documentType) - DOC_PRIORITY(b.documentType))
    .map((d) => {
      const body = d.text.slice(0, Math.min(MAX_DOC_CHARS, Math.max(0, budget)));
      budget -= body.length;
      return `### Văn bản: ${d.fileName} (loại: ${d.documentType ?? 'chưa rõ'})\n${body || '(không còn chỗ — bỏ qua)'}`;
    })
    .join('\n\n');

  return `Bạn là chuyên viên pháp chế – hợp tác của Bệnh viện Đại học Y Dược TP.HCM (UMC). Đọc văn bản ký kết hợp tác (chữ OCR từ bản scan, có thể sai chính tả) và trích thông tin theo đúng khuôn JSON của ví dụ.

## Thông tin MOU trên hệ thống quản lý công việc
- Tên: ${input.title}
- Đối tác: ${input.partnerName}
- Lĩnh vực: ${input.officeField ?? 'chưa ghi'}
- Ngày bắt đầu ghi trên hệ thống: ${input.officeSignedDate ?? 'chưa ghi'} · Ngày hết hạn ghi trên hệ thống: ${input.officeExpiryDate ?? 'chưa ghi'}
- Mô tả trên hệ thống: ${input.officeDescription ?? 'không có'}

## Quy tắc
1. Chỉ lấy điều văn bản thật sự ghi. Không có thì để null hoặc mảng rỗng — KHÔNG suy diễn, KHÔNG lấy từ ví dụ.
2. "aspects" là các KHÍA CẠNH hợp tác (thường ở điều "Nội dung hợp tác", "Phạm vi hợp tác", "Trách nhiệm các bên"). Mỗi khía cạnh một mục, gom các ý cùng một mảng; không tạo khía cạnh cho điều khoản chung (hiệu lực, bảo mật, sở hữu trí tuệ, quyền dùng tên/logo hay đăng tải thông tin hợp tác, giải quyết tranh chấp, số bản) — các ý đó ghi vào notes nếu đáng chú ý.
   - type: TRAINING (đào tạo), RESEARCH (nghiên cứu khoa học, thử nghiệm lâm sàng), CLINICAL (chuyên môn khám chữa bệnh, hội chẩn, chuyển tuyến, ghép tạng), TECHNOLOGY_TRANSFER (chuyển giao kỹ thuật/công nghệ), EXPERT_EXCHANGE (trao đổi chuyên gia, nhân viên, sinh viên), FACILITY (cơ sở vật chất, phòng khám), EQUIPMENT (thiết bị, vật tư, thuốc), FINANCE (tài trợ, học bổng, chi phí), HR (nhân sự), EVENT (hội thảo, hội nghị, sự kiện, truyền thông), PUBLICATION (xuất bản, ấn phẩm, bài báo), OTHER.
   - responsibleParty: UMC / PARTNER / BOTH theo bên chịu trách nhiệm chính. Văn bản gọi "Bên A/Bên B" thì xác định bên nào là UMC (Bệnh viện Đại học Y Dược TP.HCM, UMC, hoặc Đại học Y Dược TP.HCM – UMP) rồi quy đổi.
   - commitments: từng cam kết cụ thể, viết lại ngắn gọn bằng tiếng Việt (văn bản tiếng Anh thì dịch).
   - deliverable: sản phẩm/kết quả đo được nếu văn bản có nêu (số lớp, số học viên, số ca, công trình, sự kiện…), không thì null.
3. Ngày dạng YYYY-MM-DD. Ngày ký thường viết tay nên OCR hay đọc sai số năm: nếu ngày đọc được lệch với ngày trên hệ thống, vẫn ghi theo văn bản nhưng nói rõ trong notes "ngày ký đọc từ bản scan, cần kiểm tra" và hạ confidence xuống medium. "termYears" là số năm hiệu lực nếu có; "termText" ghi nguyên ý về thời hạn. Hết hạn = ngày hiệu lực + thời hạn nếu văn bản chỉ ghi số năm.
4. parties: tên đầy đủ, người đại diện ký (sửa lỗi OCR ở tên người: viết hoa chữ cái đầu, có dấu), chức vụ.
5. "approval": tóm tắt tờ trình/kế hoạch nếu có (ai đề xuất, lý do, lợi ích kỳ vọng, ngày duyệt). "followUp": việc phải làm tiếp theo văn bản quy định (ký hợp đồng chi tiết, lập kế hoạch năm…).
6. "hasSignedText": true nếu trong các văn bản có nội dung biên bản/thỏa thuận ký kết (không chỉ có tờ trình, công văn). Không có biên bản thì vẫn trích những gì tờ trình nêu về nội dung dự kiến hợp tác vào aspects.
7. "confidence": high nếu văn bản đọc rõ và đủ; medium nếu OCR lỗi nhiều hoặc thiếu trang; low nếu gần như không đọc được.
8. Toàn bộ chữ trong JSON viết tiếng Việt có dấu; tên riêng nước ngoài giữ nguyên.

## Ví dụ (đọc tay từ biên bản BV Đa khoa tỉnh Ninh Bình — chỉ để biết khuôn và mức chi tiết)
${JSON.stringify(REFERENCE_EXTRACTION)}

## Văn bản cần đọc
${docs}

Trả về DUY NHẤT một đối tượng JSON cùng khuôn với ví dụ.`;
}

export function parseExtraction(raw: unknown): MouExtraction {
  return extractionSchema.parse(raw);
}
