/**
 * Hợp đồng dữ liệu của phân hệ công việc. `workImportSchema` là định dạng file
 * script cào phải xuất ra — xem docs/WORK-MANAGEMENT.md và prisma/eval/work-import.sample.json.
 */
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => v || undefined);
/** Ngày "2026-10-15" hoặc "15/10/2026" (cách ghi của ứng dụng nội bộ). */
const looseDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
    const iso = vn ? `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}` : v.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) {
      ctx.addIssue({ code: 'custom', message: `Ngày không hợp lệ: "${v}"` });
      return z.NEVER;
    }
    return iso;
  });
/** Thời điểm có giờ; thiếu múi giờ thì hiểu là giờ Việt Nam. */
const looseDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v);
    const normalized = vn
      ? `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}T${(vn[4] ?? '00').padStart(2, '0')}:${vn[5] ?? '00'}:00`
      : v;
    const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized.length === 10 ? `${normalized}T00:00:00` : normalized}+07:00`;
    const time = Date.parse(withZone);
    if (Number.isNaN(time)) {
      ctx.addIssue({ code: 'custom', message: `Thời điểm không hợp lệ: "${v}"` });
      return z.NEVER;
    }
    return new Date(time);
  });
const percent = z.coerce.number().min(0).max(100).transform(Math.round);

export const workImportUpdateSchema = z.object({
  at: looseDateTime,
  author: optionalText(200),
  content: text(5000).min(1),
  progressPercent: percent.optional(),
});

export const workImportItemSchema = z.object({
  externalId: text(100).min(1),
  url: z.string().url().optional(),
  title: text(1000).min(1),
  description: optionalText(20000),
  kind: z.enum(['DIRECTIVE', 'PLAN', 'OTHER']).default('DIRECTIVE'),
  directedBy: optionalText(200),
  directedAt: looseDate.optional(),
  leadUnit: optionalText(300),
  coordinatingUnits: z.array(text(300)).default([]),
  assignees: z.array(text(200)).default([]),
  dueDate: looseDate.optional(),
  status: optionalText(200),
  progressPercent: percent.optional(),
  /** Lần sửa gần nhất ở nguồn, nếu trang có hiện. */
  lastUpdatedAt: looseDateTime.optional(),
  updates: z.array(workImportUpdateSchema).default([]),
});

export const workImportSchema = z.object({
  source: z.literal('qlcv').default('qlcv'),
  scrapedAt: looseDateTime.optional(),
  items: z.array(z.unknown()).max(5000),
});
export type WorkImportItem = z.infer<typeof workImportItemSchema>;

const itemFields = {
  title: text(1000).min(1, 'Nhập tên công việc'),
  description: optionalText(20000),
  kind: z.enum(['DIRECTIVE', 'PLAN', 'OTHER']),
  directedBy: optionalText(200),
  directedAt: z.string().date().optional(),
  leadUnit: optionalText(300),
  departmentId: z.string().optional(),
  assignees: z.array(text(200)).max(30),
  dueDate: z.string().date().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']),
  progressPercent: z.number().int().min(0).max(100).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  tags: z.array(text(50)).max(20),
  characteristics: optionalText(5000),
  notes: optionalText(5000),
};

/** Mở việc mới bằng tay (thường là việc theo kế hoạch). */
export const workItemCreateSchema = z.object({
  ...itemFields,
  kind: itemFields.kind.default('PLAN'),
  assignees: itemFields.assignees.default([]),
  status: itemFields.status.default('NOT_STARTED'),
  priority: itemFields.priority.default('NORMAL'),
  tags: itemFields.tags.default([]),
});

/**
 * Sửa một phần. Việc cào từ nguồn chỉ sửa được phần Phòng HC tự ghi (B2) —
 * các trường còn lại sẽ bị lần cào sau ghi đè, route chặn ở đó.
 */
/** Ô chữ để trống khi sửa nghĩa là xoá nội dung cũ. */
const clearableText = (max: number) => text(max).transform((v) => v || null).optional();
export const workItemPatchSchema = z
  .object(itemFields)
  .partial()
  .extend({ description: clearableText(20000), characteristics: clearableText(5000), notes: clearableText(5000) });
export const WORK_LOCAL_FIELDS = ['priority', 'tags', 'characteristics', 'notes', 'departmentId'] as const;

export const workUpdateCreateSchema = z.object({
  content: text(5000).min(1, 'Nhập nội dung cập nhật'),
  progressPercent: z.number().int().min(0).max(100).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});
