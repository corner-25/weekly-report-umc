import { NextResponse } from 'next/server';
import { Prisma, type CrmCareStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { careTaskInputSchema } from '@/lib/crm/schemas';
import { CARE_STATUS_LABELS } from '@/lib/crm/constants';
import { careOccasionKey } from '@/lib/crm/care';
import { careTaskInclude, handle, HttpError, requireSession, toCareTaskDto, CRM_TRANSACTION } from '@/lib/crm/server';

const STATUSES = new Set(Object.keys(CARE_STATUS_LABELS));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Danh sách việc quà/hoa, dịp gần nhất trước. Lọc theo trạng thái, khoảng ngày của dịp, đối tác. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');
  const contactId = params.get('contactId');
  const organizationId = params.get('organizationId');

  const conditions: Prisma.CrmCareTaskWhereInput[] = [];
  if (status && STATUSES.has(status)) conditions.push({ status: status as CrmCareStatus });
  // occasionDate là cột DATE: so với 00:00 UTC của đúng ngày đó.
  if (from && ISO_DATE.test(from)) conditions.push({ occasionDate: { gte: new Date(from) } });
  if (to && ISO_DATE.test(to)) conditions.push({ occasionDate: { lte: new Date(to) } });
  if (contactId) conditions.push({ contactId });
  if (organizationId) conditions.push({ organizationId });

  const tasks = await prisma.crmCareTask.findMany({
    where: { AND: conditions },
    include: careTaskInclude,
    orderBy: [{ occasionDate: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });
  return NextResponse.json(tasks.map(toCareTaskDto));
});

/**
 * Lên kế hoạch quà/hoa cho một dịp. Mỗi lần diễn ra của một dịp chỉ có một việc
 * (khoá occasionKey) — bấm "Lên kế hoạch" hai lần không tạo hai việc.
 */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const data = careTaskInputSchema.parse(await request.json());

  const created = await prisma.$transaction(async (tx) => {
    if (data.contactId && !(await tx.crmContact.findUnique({ where: { id: data.contactId }, select: { id: true } }))) {
      throw new HttpError(400, 'Cá nhân đã chọn không còn tồn tại');
    }
    if (data.organizationId && !(await tx.crmOrganization.findUnique({ where: { id: data.organizationId }, select: { id: true } }))) {
      throw new HttpError(400, 'Tổ chức đã chọn không còn tồn tại');
    }

    let occasionKind = data.occasionKind;
    if (data.importantDateId) {
      const date = await tx.crmImportantDate.findUnique({ where: { id: data.importantDateId } });
      const owned = date && (date.contactId ?? null) === (data.contactId ?? null) && (date.organizationId ?? null) === (data.organizationId ?? null);
      if (!owned) throw new HttpError(400, 'Ngày quan trọng không thuộc đối tác này');
      // Loại dịp theo ngày gốc, không tin loại gửi lên.
      occasionKind = date.kind;
    } else if (occasionKind === 'BIRTHDAY' && !data.contactId) {
      throw new HttpError(400, 'Tổ chức không có sinh nhật — chọn ngày thành lập hoặc dịp khác');
    }

    try {
      return await tx.crmCareTask.create({
        data: {
          contactId: data.contactId ?? null,
          organizationId: data.organizationId ?? null,
          importantDateId: data.importantDateId ?? null,
          occasionKind,
          occasionDate: new Date(data.occasionDate),
          occasionKey: careOccasionKey({ ...data, occasionKind }),
          giftType: data.giftType,
          description: data.description,
          budget: data.budget ?? null,
          actualCost: data.actualCost ?? null,
          assigneeName: data.assigneeName ?? null,
          note: data.note ?? null,
          createdById: session.user.id,
        },
        include: careTaskInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'Dịp này đã có kế hoạch quà/hoa — mở việc đã có để sửa');
      }
      throw error;
    }
  }, CRM_TRANSACTION);

  return NextResponse.json(toCareTaskDto(created), { status: 201 });
});
