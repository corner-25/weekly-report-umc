import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { contactPatchSchema } from '@/lib/crm/schemas';
import { toSearchKey } from '@/lib/crm/constants';
import {
  birthdaySource,
  CRM_TRANSACTION,
  canSeeSensitive,
  handle,
  HttpError,
  importantDateSource,
  interactionInclude,
  requireSession,
  resolveOrganization,
  toImportantDateDto,
  toInteractionDto,
  upcomingFor,
} from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

/** Trường xoá được bằng cách gửi null hoặc chuỗi rỗng khi sửa. */
const CLEARABLE = [
  'academicTitle', 'salutation', 'gender', 'birthDay', 'birthMonth', 'birthYear', 'phone', 'email',
  'giftAddress', 'ownerName', 'sensitiveNote', 'source', 'note', 'preferences',
] as const;
type Clearable = (typeof CLEARABLE)[number];

/** Hồ sơ 360° một cá nhân. */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;

  const contact = await prisma.crmContact.findUnique({
    where: { id },
    include: {
      positions: {
        orderBy: [{ isCurrent: 'desc' }, { fromDate: 'desc' }, { createdAt: 'desc' }],
        include: { organization: { select: { id: true, name: true } } },
      },
      relationsFrom: { orderBy: { createdAt: 'asc' }, include: { toContact: { select: { id: true, fullName: true } } } },
      importantDates: { orderBy: [{ month: 'asc' }, { day: 'asc' }] },
    },
  });
  if (!contact) throw new HttpError(404, 'Không tìm thấy hồ sơ');

  // Dòng thời gian gồm cả lượt người này là khách chính lẫn là thành viên đoàn.
  const interactions = await prisma.crmInteraction.findMany({
    where: { OR: [{ contactId: id }, { participants: { some: { contactId: id } } }] },
    include: interactionInclude,
    orderBy: { occurredAt: 'desc' },
    take: 200,
  });

  const { relationsFrom, sensitiveNote, ...rest } = contact;
  const allowed = canSeeSensitive(session, contact.ownerName);
  const sources = [birthdaySource(contact), ...contact.importantDates.map(importantDateSource)].filter(
    (s): s is NonNullable<typeof s> => s !== null,
  );

  return NextResponse.json({
    ...rest,
    ...(allowed && { sensitiveNote }),
    canSeeSensitive: allowed,
    positions: contact.positions.map((p) => ({
      id: p.id, title: p.title, department: p.department, isCurrent: p.isCurrent,
      fromDate: p.fromDate?.toISOString() ?? null, toDate: p.toDate?.toISOString() ?? null,
      organization: p.organization,
    })),
    relations: relationsFrom.map((r) => ({
      id: r.id, kind: r.kind, name: r.name, phone: r.phone, note: r.note, toContact: r.toContact,
    })),
    importantDates: contact.importantDates.map(toImportantDateDto),
    interactions: interactions.map(toInteractionDto),
    upcoming: upcomingFor(sources),
  });
});

/** Sửa hồ sơ. Người không được xem lưu ý nhạy cảm thì cũng không được sửa nó. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const existing = await prisma.crmContact.findUnique({ where: { id }, select: { ownerName: true, fullName: true, phone: true } });
  if (!existing) throw new HttpError(404, 'Không tìm thấy hồ sơ');

  const body = (await request.json()) as Record<string, unknown>;
  // null hoặc chuỗi rỗng = xoá trường đó; schema chỉ kiểm phần còn lại.
  const cleared = CLEARABLE.filter((key) => key in body && (body[key] === null || body[key] === ''));
  const parsed = contactPatchSchema.parse(
    Object.fromEntries(Object.entries(body).filter(([key]) => !cleared.includes(key as Clearable))),
  );
  const { currentTitle, currentOrganizationName, preferences, sensitiveNote, ...data } = parsed;
  const touchesSensitive = sensitiveNote !== undefined || cleared.includes('sensitiveNote');
  if (touchesSensitive && !canSeeSensitive(session, existing.ownerName)) {
    throw new HttpError(403, 'Bạn không có quyền sửa lưu ý nhạy cảm của hồ sơ này');
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (currentTitle || currentOrganizationName) {
      const organizationId = await resolveOrganization(tx, { organizationName: currentOrganizationName });
      await tx.crmPosition.updateMany({ where: { contactId: id, isCurrent: true }, data: { isCurrent: false } });
      await tx.crmPosition.create({
        data: { contactId: id, title: currentTitle ?? 'Liên hệ', organizationId, isCurrent: true },
      });
    }
    return tx.crmContact.update({
      where: { id },
      data: {
        ...data,
        // Khoá tìm kiếm theo họ tên + SĐT sau khi sửa.
        searchKey: toSearchKey(
          data.fullName ?? existing.fullName,
          cleared.includes('phone') ? null : (data.phone ?? existing.phone),
        ),
        // Trường JSON phải xoá bằng Prisma.DbNull, null thường bị Prisma từ chối.
        ...Object.fromEntries(cleared.map((key) => [key, key === 'preferences' ? Prisma.DbNull : null])),
        // Xoá ngày sinh là xoá cả bộ ngày/tháng/năm.
        ...(cleared.includes('birthDay') && { birthDay: null, birthMonth: null, birthYear: null }),
        ...(preferences !== undefined && { preferences }),
        ...(sensitiveNote !== undefined && { sensitiveNote }),
      },
    });
  }, CRM_TRANSACTION);
  return NextResponse.json(contact);
});

/**
 * Xoá hồ sơ. Hồ sơ đã có lượt tương tác thì không xoá — lịch sử dẫn khách sẽ mất
 * tên khách. Chuyển sang "Ngừng quan hệ"; quản trị viên xoá hẳn được bằng ?force=1.
 */
export const DELETE = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const force = new URL(request.url).searchParams.get('force') === '1' && session.user.role === 'ADMIN';
  const [own, joined] = await Promise.all([
    prisma.crmInteraction.count({ where: { contactId: id } }),
    prisma.crmInteractionParticipant.count({ where: { contactId: id } }),
  ]);
  if (own + joined > 0 && !force) {
    throw new HttpError(
      409,
      `Hồ sơ đã có ${own + joined} lượt tương tác — xoá sẽ mất tên khách trong lịch sử. ` +
        'Hãy đổi trạng thái sang "Ngừng quan hệ" thay vì xoá.',
    );
  }
  await prisma.crmContact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
