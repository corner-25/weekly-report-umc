import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionInputSchema } from '@/lib/crm/schemas';
import { handle, HttpError, requireSession, resolveOrganization, CRM_TRANSACTION } from '@/lib/crm/server';

/** Thêm chức vụ. Chức vụ hiện tại mới thì các chức vụ hiện tại cũ chuyển thành đã qua. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const { organizationName, fromDate, toDate, ...data } = positionInputSchema.parse(await request.json());

  const position = await prisma.$transaction(async (tx) => {
    const contact = await tx.crmContact.findUnique({ where: { id }, select: { id: true } });
    if (!contact) throw new HttpError(404, 'Không tìm thấy hồ sơ');
    const organizationId = await resolveOrganization(tx, { organizationName });
    if (data.isCurrent) {
      await tx.crmPosition.updateMany({ where: { contactId: id, isCurrent: true }, data: { isCurrent: false } });
    }
    return tx.crmPosition.create({
      data: {
        ...data,
        contactId: id,
        organizationId,
        fromDate: fromDate ? new Date(`${fromDate}T00:00:00Z`) : null,
        toDate: toDate ? new Date(`${toDate}T00:00:00Z`) : null,
      },
    });
  }, CRM_TRANSACTION);
  return NextResponse.json(position, { status: 201 });
});
