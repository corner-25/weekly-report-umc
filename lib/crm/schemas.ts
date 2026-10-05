/**
 * Hợp đồng dữ liệu của CRM: schema zod dùng chung cho API (kiểm tra đầu vào)
 * và giao diện (kiểu dữ liệu form). Sửa ở đây là sửa cả hai phía.
 */
import { z } from 'zod';

const tier = z.enum(['VIP', 'A', 'B', 'C']);
const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const dayOfMonth = z.number().int().min(1).max(31);
const monthOfYear = z.number().int().min(1).max(12);

export const preferencesSchema = z
  .object({
    flowers: optionalText(200),
    avoid: optionalText(500),
    food: optionalText(300),
    hobbies: optionalText(300),
  })
  .optional();

const organizationShape = {
  name: z.string().trim().min(1, 'Tên tổ chức là bắt buộc').max(300),
  type: z.enum(['HOSPITAL', 'UNIVERSITY', 'COMPANY', 'GOVERNMENT', 'INTERNATIONAL', 'PRESS', 'OTHER']),
  tier,
  address: optionalText(500),
  website: optionalText(300),
  phone: optionalText(50),
  email: optionalText(200),
  ownerName: optionalText(200),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  note: optionalText(4000),
};

export const organizationInputSchema = z.object({
  ...organizationShape,
  type: organizationShape.type.default('OTHER'),
  tier: tier.default('C'),
  tags: organizationShape.tags.default([]),
});
/**
 * Sửa một phần: KHÔNG có giá trị mặc định — nếu có, trường không gửi lên sẽ bị
 * ghi đè về mặc định (hạng về C, nhãn bị xoá).
 */
export const organizationPatchSchema = z.object(organizationShape).partial();
export type OrganizationInput = z.infer<typeof organizationInputSchema>;

const contactShape = {
  fullName: z.string().trim().min(1, 'Họ tên là bắt buộc').max(200),
  academicTitle: optionalText(50),
  salutation: optionalText(50),
  gender: z.enum(['Nam', 'Nữ']).optional(),
  birthDay: dayOfMonth.optional(),
  birthMonth: monthOfYear.optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  birthIsLunar: z.boolean(),
  phone: optionalText(50),
  email: optionalText(200),
  giftAddress: optionalText(500),
  tier,
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  ownerName: optionalText(200),
  preferences: preferencesSchema,
  sensitiveNote: optionalText(2000),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  source: optionalText(200),
  note: optionalText(4000),
  /** Chức vụ hiện tại — tạo nhanh khi thêm người mới. Tổ chức theo tên, chưa có thì tạo. */
  currentTitle: optionalText(200),
  currentOrganizationName: optionalText(300),
};

const birthPairRule = (v: { birthDay?: number; birthMonth?: number }) =>
  (v.birthDay === undefined) === (v.birthMonth === undefined);
const birthPairIssue = { message: 'Ngày sinh cần đủ cả ngày và tháng', path: ['birthMonth'] };

export const contactInputSchema = z
  .object({
    ...contactShape,
    birthIsLunar: contactShape.birthIsLunar.default(false),
    tier: tier.default('C'),
    tags: contactShape.tags.default([]),
    status: contactShape.status.default('ACTIVE'),
  })
  .refine(birthPairRule, birthPairIssue);

/** Sửa một phần, không giá trị mặc định (xem organizationPatchSchema). */
export const contactPatchSchema = z.object(contactShape).partial().refine(birthPairRule, birthPairIssue);
export type ContactInput = z.infer<typeof contactInputSchema>;

export const positionInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  organizationName: optionalText(300),
  department: optionalText(200),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  isCurrent: z.boolean().default(true),
  /** Kiêm nhiệm: giữ nguyên các chức vụ hiện tại khác thay vì chuyển chúng thành đã qua. */
  concurrent: z.boolean().default(false),
});
export type PositionInput = z.infer<typeof positionInputSchema>;

export const relationInputSchema = z
  .object({
    kind: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'ASSISTANT', 'SECRETARY', 'OTHER']),
    toContactId: z.string().optional(),
    name: optionalText(200),
    phone: optionalText(50),
    note: optionalText(1000),
  })
  .refine((v) => v.toContactId || v.name, { message: 'Cần chọn người có hồ sơ hoặc ghi tên', path: ['name'] });
export type RelationInput = z.infer<typeof relationInputSchema>;

export const importantDateInputSchema = z
  .object({
    contactId: z.string().optional(),
    organizationId: z.string().optional(),
    kind: z.enum(['BIRTHDAY', 'APPOINTMENT', 'FOUNDING', 'ANNIVERSARY', 'OTHER']),
    label: optionalText(200),
    day: dayOfMonth,
    month: monthOfYear,
    year: z.number().int().min(1900).max(2100).optional(),
    isLunar: z.boolean().default(false),
    repeatsYearly: z.boolean().default(true),
    remindDaysBefore: z.number().int().min(0).max(60).optional(),
    note: optionalText(1000),
  })
  .refine((v) => Boolean(v.contactId) !== Boolean(v.organizationId), {
    message: 'Ngày quan trọng phải thuộc đúng một cá nhân hoặc một tổ chức',
    path: ['contactId'],
  });
export type ImportantDateInput = z.infer<typeof importantDateInputSchema>;

export const INTERACTION_STATUSES = ['PLANNED', 'DONE', 'POSTPONED', 'CANCELLED'] as const;

const optionalMoney = z.number().int().min(0, 'Số tiền không âm').max(2_000_000_000).optional();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ');

/** Các trường của sổ tiếp đoàn — chỉ dùng với lượt tiếp đoàn, đều không bắt buộc. */
const delegationFields = {
  endAt: isoDay.optional(),
  timeText: optionalText(100),
  incomingDocNo: optionalText(200),
  hostDepartmentId: z.string().optional(),
  hostUnit: optionalText(300),
  hospitalAttendees: optionalText(4000),
  guestMembers: optionalText(4000),
  topics: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  coOrganizations: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  giftsGiven: optionalText(2000),
  giftsReceived: optionalText(2000),
  cashReceived: optionalMoney,
  giftBudget: optionalMoney,
  giftActualCost: optionalMoney,
  needsReview: z.boolean().default(false),
  reviewNote: optionalText(2000),
};

/**
 * Một lượt tương tác. Ba loại hay dùng có modal riêng:
 *   VIP_ESCORT  dẫn khách VIP khám bệnh — cần nội dung, nên có khoa/phòng, dịch vụ
 *   DELEGATION  tiếp và dẫn đoàn — cần tổ chức, số người, mục đích
 *   khác        gặp mặt, gọi điện, email, sự kiện…
 * Khách/tổ chức có thể chọn từ danh bạ (id) hoặc gõ tên mới (tự tạo hồ sơ).
 */
export const interactionInputSchema = z
  .object({
    type: z.enum(['VIP_ESCORT', 'DELEGATION', 'MEETING', 'CALL', 'EMAIL', 'EVENT', 'GIFT', 'OTHER']),
    /** PLANNED: lịch hẹn; DONE: đã thực hiện; POSTPONED: hoãn chưa có ngày mới; CANCELLED: huỷ/khách không đến. */
    status: z.enum(INTERACTION_STATUSES).default('DONE'),
    occurredAt: z.string().datetime(),
    contactId: z.string().optional(),
    newContactName: optionalText(200),
    newContactPhone: optionalText(50),
    organizationId: z.string().optional(),
    organizationName: optionalText(300),
    title: optionalText(300),
    content: z.string().trim().min(1, 'Nội dung là bắt buộc').max(4000),
    destination: optionalText(500),
    patientName: optionalText(200),
    services: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    guestCount: z.number().int().min(1).max(1000).optional(),
    purpose: optionalText(200),
    participantIds: z.array(z.string()).max(100).default([]),
    /** Tiếp đoàn do khoa/phòng khác chủ trì thì Phòng HC có thể không có người dẫn. */
    staffName: z.string().trim().max(200).default(''),
    companions: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    note: optionalText(4000),
    ...delegationFields,
  })
  .refine((v) => v.type === 'DELEGATION' || v.staffName.length > 0, {
    message: 'Chọn nhân viên phụ trách',
    path: ['staffName'],
  })
  .refine((v) => !v.endAt || v.endAt >= v.occurredAt.slice(0, 10), {
    message: 'Ngày kết thúc không được trước ngày bắt đầu',
    path: ['endAt'],
  })
  .refine((v) => v.type !== 'VIP_ESCORT' || v.contactId || v.newContactName, {
    message: 'Dẫn khách VIP cần chọn hoặc nhập tên khách',
    path: ['contactId'],
  })
  .refine((v) => v.type !== 'DELEGATION' || v.organizationId || v.organizationName, {
    message: 'Dẫn đoàn cần chọn hoặc nhập tên đơn vị',
    path: ['organizationId'],
  });
export type InteractionInput = z.infer<typeof interactionInputSchema>;

/** Số tiền (đồng): cột Int của Postgres tối đa ~2,1 tỷ. */
const money = z.number().int().min(0, 'Số tiền không âm').max(2_000_000_000);

/** Phần sửa được của một việc quà/hoa — dịp và đối tác cố định sau khi tạo. */
export const careTaskFieldsSchema = z.object({
  giftType: z.enum(['FLOWERS', 'GIFT', 'CARD', 'VISIT', 'OTHER']),
  description: z.string().trim().min(1, 'Ghi rõ quà/hoa sẽ tặng').max(2000),
  budget: money.optional(),
  actualCost: money.optional(),
  assigneeName: optionalText(200),
  note: optionalText(2000),
});
export type CareTaskFields = z.infer<typeof careTaskFieldsSchema>;

/**
 * Lên kế hoạch quà/hoa cho MỘT lần diễn ra của một dịp. `occasionDate` là ngày
 * dương lịch của lần đó (ngày âm đã đổi sẵn — lấy từ danh sách dịp sắp tới).
 * Sinh nhật lấy từ hồ sơ nên không có importantDateId.
 */
export const careTaskInputSchema = careTaskFieldsSchema
  .extend({
    contactId: z.string().optional(),
    organizationId: z.string().optional(),
    importantDateId: z.string().optional(),
    occasionKind: z.enum(['BIRTHDAY', 'APPOINTMENT', 'FOUNDING', 'ANNIVERSARY', 'OTHER']),
    occasionDate: z.string().date('Ngày của dịp không hợp lệ'),
  })
  .refine((v) => Boolean(v.contactId) !== Boolean(v.organizationId), {
    message: 'Việc quà/hoa phải thuộc đúng một cá nhân hoặc một tổ chức',
    path: ['contactId'],
  });
export type CareTaskInput = z.infer<typeof careTaskInputSchema>;

export const careTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'ORDERED', 'DELIVERED', 'CANCELLED']),
  /** Thời điểm trao; trống = lúc bấm. */
  deliveredAt: z.string().datetime().optional(),
  actualCost: money.optional(),
  note: optionalText(2000),
});
export type CareTaskStatusInput = z.infer<typeof careTaskStatusSchema>;
