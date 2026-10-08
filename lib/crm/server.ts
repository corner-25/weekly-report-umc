/**
 * Phần dùng chung của các API CRM: xác thực, trả lỗi thống nhất, tìm-hoặc-tạo
 * tổ chức/cá nhân khi nhập nhanh, quyền xem thông tin nhạy cảm, và chuyển bản
 * ghi Prisma thành DTO mà giao diện dùng.
 */
import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { Prisma, type CrmTier } from '@prisma/client';
import { ZodError } from 'zod';
import { authOptions } from '@/lib/auth';
import { normalizeOrganizationName } from '@/lib/vip';
import { upcomingOccurrences, todayInVietnam } from './upcoming';
import { DATE_KIND_LABELS, toSearchKey } from './constants';
import { lunarToSolar } from './lunar';

type Tx = Prisma.TransactionClient;

/**
 * Thời hạn cho transaction của CRM. Mặc định của Prisma là 5 giây; lưu một lượt
 * dẫn khám gồm 4-5 truy vấn nối tiếp (tìm/tạo đơn vị, tạo khách, tạo lượt) và đã
 * vượt 5 giây khi DB phản hồi chậm — đo được khi chạy thử, lượt lưu bị huỷ.
 */
export const CRM_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) throw new HttpError(401, 'Bạn cần đăng nhập');
  return session;
}

/** Bọc handler: lỗi zod → 400 kèm từng trường, HttpError → đúng status, còn lại → 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
            issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
          { status: 400 },
        );
      }
      if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Không tìm thấy bản ghi' }, { status: 404 });
      }
      console.error('[crm]', error);
      return NextResponse.json({ error: 'Lỗi máy chủ, vui lòng thử lại' }, { status: 500 });
    }
  };
}

/**
 * Tìm tổ chức theo id, hoặc theo tên (chưa có thì tạo) — dùng cho ô "chọn hoặc gõ mới".
 * Tên gõ không dấu ("Benh vien X") vẫn nhận ra tổ chức có sẵn ("Bệnh viện X").
 */
export async function resolveOrganization(
  tx: Tx,
  input: { organizationId?: string; organizationName?: string },
): Promise<string | null> {
  if (input.organizationId) {
    const org = await tx.crmOrganization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
    if (!org) throw new HttpError(400, 'Tổ chức đã chọn không còn tồn tại');
    return org.id;
  }
  const name = input.organizationName?.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const searchKey = toSearchKey(name);
  const existing = await tx.crmOrganization.findFirst({
    where: { OR: [{ normalizedName: normalizeOrganizationName(name) }, { searchKey }] },
    select: { id: true },
  });
  if (existing) return existing.id;
  const org = await tx.crmOrganization.create({
    data: { name, normalizedName: normalizeOrganizationName(name), searchKey },
    select: { id: true },
  });
  return org.id;
}

/**
 * Tìm cá nhân theo id, hoặc lấy lại hồ sơ có sẵn / tạo mới từ tên gõ nhanh.
 *
 * Dùng lại hồ sơ cũ khi CHẮC là cùng người: trùng số điện thoại, hoặc trùng đúng
 * họ tên (không phân biệt dấu) và đang làm ở cùng đơn vị. Chỉ trùng tên thì vẫn
 * tạo mới — hai người trùng tên ở hai nơi là chuyện thường.
 */
export async function resolveContact(
  tx: Tx,
  input: { contactId?: string; newContactName?: string; newContactPhone?: string },
  organizationId: string | null,
): Promise<string | null> {
  if (input.contactId) {
    const contact = await tx.crmContact.findUnique({ where: { id: input.contactId }, select: { id: true } });
    if (!contact) throw new HttpError(400, 'Khách đã chọn không còn tồn tại');
    return contact.id;
  }
  const name = input.newContactName?.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const phone = input.newContactPhone?.replace(/\D/g, '') || null;
  const nameKey = toSearchKey(name);

  const candidates = await tx.crmContact.findMany({
    where: { searchKey: { startsWith: nameKey } },
    select: {
      id: true, fullName: true,
      positions: { where: { isCurrent: true }, select: { organizationId: true } },
    },
    take: 20,
  });
  // So số điện thoại chỉ theo chữ số: "0912 345 678" và "0912345678" là một người,
  // kể cả khi tên gõ lần này khác lần trước (thêm học hàm, sai chính tả...).
  const samePhone = phone
    ? (await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM crm_contacts WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ${phone} LIMIT 1`)[0]
    : undefined;
  const sameNameAndOrg = organizationId
    ? candidates.filter(
        (c) => toSearchKey(c.fullName) === nameKey && c.positions.some((p) => p.organizationId === organizationId),
      )
    : [];
  const reuse = samePhone ?? (sameNameAndOrg.length === 1 ? sameNameAndOrg[0] : undefined);
  if (reuse) return reuse.id;

  const contact = await tx.crmContact.create({
    data: {
      fullName: name,
      searchKey: toSearchKey(name, input.newContactPhone),
      phone: input.newContactPhone || null,
      source: 'Nhập nhanh khi ghi tương tác',
      ...(organizationId && { positions: { create: { title: 'Khách', organizationId, isCurrent: true } } }),
    },
    select: { id: true },
  });
  return contact.id;
}

/** Sửa/xoá lượt tương tác: quản trị viên, hoặc chính người đã ghi. */
export function canModifyInteraction(session: Session, createdById: string | null): boolean {
  return session.user.role === 'ADMIN' || (createdById !== null && createdById === session.user.id);
}

/**
 * Lưu ý nhạy cảm (sức khoẻ, gia đình) chỉ người phụ trách hồ sơ và quản trị viên
 * xem được — đã chốt trong phác thảo, mục Quyền riêng tư.
 */
export function canSeeSensitive(session: Session, ownerName: string | null): boolean {
  if (session.user.role === 'ADMIN') return true;
  return Boolean(ownerName && session.user.name && ownerName.trim() === session.user.name.trim());
}

/** Thông tin ảnh để hiển thị — không kèm nội dung file. */
const photoSelect = { id: true, kind: true, caption: true, uploadedById: true } satisfies Prisma.CrmPhotoSelect;

export function toPhotoDto(p: Prisma.CrmPhotoGetPayload<{ select: typeof photoSelect }>) {
  return { id: p.id, kind: p.kind, caption: p.caption, uploadedById: p.uploadedById, url: `/api/crm/photos/${p.id}` };
}

export const interactionInclude = {
  referrerContact: { select: { id: true, fullName: true, academicTitle: true } },
  relatedVipContact: { select: { id: true, fullName: true, academicTitle: true } },
  doctors: { select: { contact: { select: { id: true, fullName: true, academicTitle: true } } } },
  contact: { select: { id: true, fullName: true, academicTitle: true } },
  organization: { select: { id: true, name: true } },
  hostDepartment: { select: { id: true, name: true } },
  participants: { select: { contact: { select: { id: true, fullName: true } } } },
  photos: { select: photoSelect, orderBy: { createdAt: 'asc' } },
  // Lượt tặng quà ghi từ việc chăm sóc: ảnh nằm ở việc đó, hiện kèm trên dòng thời gian.
  careTask: { select: { photos: { select: photoSelect, orderBy: { createdAt: 'asc' } } } },
} satisfies Prisma.CrmInteractionInclude;

type InteractionWithRelations = Prisma.CrmInteractionGetPayload<{ include: typeof interactionInclude }>;

/** Chẩn đoán trong buổi dẫn khám là thông tin sức khoẻ — chỉ quản trị viên xem được. */
export function canSeeHealth(session: Session): boolean {
  return session.user.role === 'ADMIN';
}

interface VisitItemRaw {
  specialty?: string | null;
  doctor?: string | null;
  diagnosis?: string | null;
  services?: string[];
  followUp?: { date: string | null; text: string | null };
}

/**
 * Lượt tương tác trả cho giao diện. `health` = người xem được thấy chẩn đoán;
 * mặc định không — gọi qua `.map((i) => toInteractionDto(i, health))`, đừng truyền
 * thẳng vào `.map` (map đưa chỉ số làm tham số thứ hai).
 */
export function toInteractionDto(i: InteractionWithRelations, health = false) {
  const items = Array.isArray(i.visitItems) ? (i.visitItems as unknown as VisitItemRaw[]) : [];
  return {
    id: i.id,
    type: i.type,
    status: i.status,
    createdById: i.createdById,
    occurredAt: i.occurredAt.toISOString(),
    title: i.title,
    content: i.content,
    destination: i.destination,
    patientName: i.patientName,
    services: i.services,
    referrer: i.referrerContact?.fullName ?? i.referrer,
    referrerContact: i.referrerContact,
    relatedVipContact: i.relatedVipContact,
    vipRelationship: i.vipRelationship,
    doctors: i.doctors.map(d => d.contact),
    visitKind: i.visitKind,
    followUp: i.followUp,
    followUpDate: i.followUpDate?.toISOString() ?? null,
    visitItems: items.map(({ diagnosis, ...rest }) => ({ ...rest, ...(health ? { diagnosis: diagnosis ?? null } : {}) })),
    guestCount: i.guestCount,
    purpose: i.purpose,
    staffName: i.staffName,
    companions: i.companions,
    note: i.note,
    externalCode: i.externalCode,
    endAt: i.endAt?.toISOString() ?? null,
    timeText: i.timeText,
    dateUnknown: i.dateUnknown,
    incomingDocNo: i.incomingDocNo,
    hostUnit: i.hostDepartment?.name ?? i.hostUnit,
    hostDepartmentId: i.hostDepartmentId,
    hospitalAttendees: i.hospitalAttendees,
    guestMembers: i.guestMembers,
    topics: i.topics,
    coOrganizations: i.coOrganizations,
    purposeInferred: i.purposeInferred,
    giftsGiven: i.giftsGiven,
    giftsReceived: i.giftsReceived,
    cashReceived: i.cashReceived,
    giftBudget: i.giftBudget,
    giftActualCost: i.giftActualCost,
    needsReview: i.needsReview,
    reviewNote: i.reviewNote,
    sourceRef: i.sourceRef,
    contact: i.contact,
    organization: i.organization,
    participants: i.participants.map((p) => p.contact),
    photos: [...i.photos, ...(i.careTask?.photos ?? [])].map(toPhotoDto),
  };
}

export const careTaskInclude = {
  contact: { select: { id: true, fullName: true, academicTitle: true } },
  organization: { select: { id: true, name: true } },
  importantDate: { select: { label: true } },
  photos: { select: photoSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CrmCareTaskInclude;

type CareTaskWithRelations = Prisma.CrmCareTaskGetPayload<{ include: typeof careTaskInclude }>;

export function toCareTaskDto(t: CareTaskWithRelations) {
  return {
    id: t.id,
    contact: t.contact,
    organization: t.organization,
    importantDateId: t.importantDateId,
    occasionKind: t.occasionKind,
    // Ngày quan trọng gốc đã bị xoá thì còn loại dịp để hiển thị.
    occasionLabel: t.importantDate?.label || DATE_KIND_LABELS[t.occasionKind],
    occasionDate: t.occasionDate.toISOString().slice(0, 10),
    giftType: t.giftType,
    description: t.description,
    budget: t.budget,
    actualCost: t.actualCost,
    assigneeName: t.assigneeName,
    status: t.status,
    deliveredAt: t.deliveredAt?.toISOString() ?? null,
    note: t.note,
    interactionId: t.interactionId,
    createdById: t.createdById,
    photos: t.photos.map(toPhotoDto),
  };
}

export function toImportantDateDto(d: {
  id: string; kind: string; label: string | null; day: number; month: number; year: number | null;
  isLunar: boolean; repeatsYearly: boolean; remindDaysBefore: number | null; note: string | null;
}) {
  return {
    id: d.id, kind: d.kind, label: d.label, day: d.day, month: d.month, year: d.year,
    isLunar: d.isLunar, repeatsYearly: d.repeatsYearly, remindDaysBefore: d.remindDaysBefore, note: d.note,
  };
}

/** Một dịp để tính ngày sắp tới — sinh nhật lấy từ trường birth* của hồ sơ. */
export interface DateSource {
  key: string;
  kind: 'BIRTHDAY' | 'APPOINTMENT' | 'FOUNDING' | 'ANNIVERSARY' | 'OTHER';
  label: string;
  day: number;
  month: number;
  year: number | null;
  isLunar: boolean;
  repeatsYearly: boolean;
}

export function birthdaySource(c: {
  id: string; birthDay: number | null; birthMonth: number | null; birthYear: number | null; birthIsLunar: boolean;
}): DateSource | null {
  if (!c.birthDay || !c.birthMonth) return null;
  return {
    key: `birthday:${c.id}`, kind: 'BIRTHDAY', label: 'Sinh nhật',
    day: c.birthDay, month: c.birthMonth, year: c.birthYear, isLunar: c.birthIsLunar, repeatsYearly: true,
  };
}

export function importantDateSource(d: {
  id: string; kind: DateSource['kind']; label: string | null; day: number; month: number;
  year: number | null; isLunar: boolean; repeatsYearly: boolean;
}): DateSource {
  return {
    key: `date:${d.id}`, kind: d.kind, label: d.label || DATE_KIND_LABELS[d.kind],
    day: d.day, month: d.month, year: d.year, isLunar: d.isLunar, repeatsYearly: d.repeatsYearly,
  };
}

/** Các dịp sắp tới của một hồ sơ (dùng trong trang hồ sơ 360°). */
export function upcomingFor(sources: DateSource[], windowDays = 365) {
  return upcomingOccurrences(sources.map((s) => ({ ...s, id: s.key })), todayInVietnam(), windowDays).map((o) => ({
    key: o.item.key, kind: o.item.kind, label: o.item.label, date: o.date,
    daysUntil: o.daysUntil, years: o.years, isLunar: o.item.isLunar,
  }));
}

export function parseTier(value: string | null): CrmTier | undefined {
  return value === 'VIP' || value === 'A' || value === 'B' || value === 'C' ? value : undefined;
}

/**
 * Ngày không tồn tại (31/4, 30/2) bị chặn ngay khi nhập — để lọt vào thì nhắc
 * nhở sẽ âm thầm không bao giờ hiện. Ngày âm kiểm bằng cách đổi thử sang dương.
 */
export function assertValidDate(day: number, month: number, isLunar: boolean): void {
  if (isLunar) {
    if (day > 30 || !lunarToSolar(1, month, 2026)) throw new HttpError(400, 'Ngày âm lịch không hợp lệ');
    return;
  }
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDay) throw new HttpError(400, `Tháng ${month} không có ngày ${day}`);
}
