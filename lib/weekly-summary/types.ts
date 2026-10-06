/**
 * Cấu trúc "Báo cáo tóm tắt hoạt động Bệnh viện tuần" — theo mẫu Phòng HC gửi
 * Ban Giám đốc (I. Hoạt động tuần: Chuyên môn; Đào tạo, NCKH & HTQT; Quản trị
 * Bệnh viện; Công nghệ thông tin — II. Kế hoạch tuần sau).
 */
import { z } from 'zod';

export const SUMMARY_SECTIONS = [
  { key: 'chuyen-mon', heading: 'Chuyên môn' },
  { key: 'dao-tao', heading: 'Đào tạo, nghiên cứu khoa học và hợp tác quốc tế' },
  { key: 'quan-tri', heading: 'Quản trị Bệnh viện' },
  { key: 'cntt', heading: 'Công nghệ thông tin' },
] as const;
export type SectionKey = (typeof SUMMARY_SECTIONS)[number]['key'];

/**
 * Mảng viết thành một gạch đầu dòng trong báo cáo, theo thứ tự của mẫu. `sources`:
 * phòng nào cấp nội dung (khớp theo tên phòng ban trong hệ thống, không dấu).
 */
export const SUMMARY_TOPICS = [
  { key: 'kcb', section: 'chuyen-mon', label: 'Khám, chữa bệnh', sources: ['ke hoach tong hop'] },
  { key: 'dieu-duong', section: 'chuyen-mon', label: 'Công tác điều dưỡng', sources: ['dieu duong'] },
  { key: 'dao-tao', section: 'dao-tao', label: 'Đào tạo, NCKH, hợp tác quốc tế', sources: ['khoa hoc va dao tao'] },
  { key: 'hanh-chinh', section: 'quan-tri', label: 'Hành chính', sources: ['hanh chinh'] },
  { key: 'phan-anh', section: 'quan-tri', label: 'Phản ánh, kiến nghị', sources: ['cong tac xa hoi', 'quan ly chat luong', 'hanh chinh'] },
  { key: 'to-chuc', section: 'quan-tri', label: 'Tổ chức, cán bộ', sources: ['to chuc can bo'] },
  { key: 'phap-che', section: 'quan-tri', label: 'Pháp chế, kiểm toán nội bộ', sources: ['phap che'] },
  { key: 'tai-chinh', section: 'quan-tri', label: 'Tài chính kế toán', sources: ['tai chinh ke toan'] },
  { key: 'bhyt', section: 'quan-tri', label: 'Bảo hiểm y tế', sources: ['bao hiem y te'] },
  { key: 'chat-luong', section: 'quan-tri', label: 'Quản lý chất lượng', sources: ['quan ly chat luong'] },
  { key: 'toa-nha', section: 'quan-tri', label: 'Quản trị tòa nhà', sources: ['quan tri toa nha'] },
  { key: 'vat-tu', section: 'quan-tri', label: 'Vật tư thiết bị', sources: ['vat tu thiet bi'] },
  { key: 'dau-thau', section: 'quan-tri', label: 'Mua sắm, đấu thầu', sources: ['dau thau'] },
  { key: 'ctxh', section: 'quan-tri', label: 'Công tác xã hội', sources: ['cong tac xa hoi'] },
  { key: 'truyen-thong', section: 'quan-tri', label: 'Công tác truyền thông', sources: ['truyen thong'] },
  { key: 'cntt', section: 'cntt', label: 'Công nghệ thông tin', sources: ['cong nghe thong tin'] },
] as const;
export type TopicKey = (typeof SUMMARY_TOPICS)[number]['key'];

/** Một dòng trong mục: gạch đầu dòng (có thể có ý con) hoặc bảng số liệu. */
export const summaryItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    /** Mảng (Hành chính, Tổ chức cán bộ…) — in đậm/nghiêng trước nội dung. */
    label: z.string().max(200).nullable().optional(),
    text: z.string().max(4000),
    subItems: z.array(z.string().max(2000)).max(20).default([]),
    /** Nguồn: chủ đề AI viết (topic key) hoặc 'facts' (tính từ số liệu). */
    origin: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal('table'),
    title: z.string().max(300),
    columns: z.array(z.string().max(200)).max(8),
    rows: z.array(z.array(z.string().max(500)).max(8)).max(60),
    /** Dòng in đậm (dòng tổng) theo chỉ số. */
    boldRows: z.array(z.number().int()).max(60).default([]),
    note: z.string().max(500).nullable().optional(),
    origin: z.string().max(50).optional(),
  }),
]);
export type SummaryItem = z.infer<typeof summaryItemSchema>;

export const summaryContentSchema = z.object({
  week: z.number().int(),
  year: z.number().int(),
  /** "28/9-04/10/2026" */
  range: z.string().max(100),
  /** Ngày ký báo cáo, "Ngày 05 tháng 10 năm 2026". */
  dateLine: z.string().max(100),
  sections: z.array(z.object({ key: z.string(), heading: z.string(), items: z.array(summaryItemSchema).max(80) })).max(10),
  plan: z.array(z.string().max(1000)).max(40),
  /** Ghi chú cho người đọc bản nháp (thiếu số liệu, phòng chưa nộp…), không in. */
  notes: z.array(z.string().max(500)).max(20).default([]),
});
export type SummaryContent = z.infer<typeof summaryContentSchema>;

/** Phần AI trả về cho một nhóm mảng. */
export const aiTopicOutputSchema = z.object({
  muc: z
    .array(
      z.object({
        key: z.string(),
        noi_dung: z.string().max(3000),
        y_con: z.array(z.string().max(1500)).max(10).optional(),
      }),
    )
    .max(30),
  ke_hoach: z.array(z.string().max(600)).max(30).optional(),
});
export type AiTopicOutput = z.infer<typeof aiTopicOutputSchema>;
