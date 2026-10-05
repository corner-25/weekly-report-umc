import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { focalPointInputSchema } from '@/lib/crm/schemas';
import { toSearchKey } from '@/lib/crm/constants';
import { CRM_TRANSACTION, handle, HttpError, requireSession } from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Gắn một người làm đầu mối liên hệ của tổ chức. Người đó đang có chức vụ ở tổ
 * chức này thì chỉ đánh dấu; chưa có thì tạo chức vụ hiện tại (mặc định "Đầu mối liên hệ").
 */
export const POST = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id: organizationId } = await params;
  const data = focalPointInputSchema.parse(await request.json());

  const positionId = await prisma.$transaction(async (tx) => {
    const org = await tx.crmOrganization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) throw new HttpError(404, 'Không tìm thấy tổ chức');

    let contactId = data.contactId;
    if (contactId) {
      const found = await tx.crmContact.findUnique({ where: { id: contactId }, select: { id: true } });
      if (!found) throw new HttpError(400, 'Người đã chọn không còn trong danh bạ');
    } else if (data.newContact) {
      const c = data.newContact;
      const created = await tx.crmContact.create({
        data: { ...c, searchKey: toSearchKey(c.fullName, c.phone) },
        select: { id: true },
      });
      contactId = created.id;
    }
    if (!contactId) throw new HttpError(400, 'Chọn một người trong danh bạ hoặc nhập người mới');

    const existing = await tx.crmPosition.findFirst({ where: { contactId, organizationId, isCurrent: true }, select: { id: true } });
    if (existing) {
      await tx.crmPosition.update({
        where: { id: existing.id },
        data: { isFocalPoint: true, ...(data.title && { title: data.title }) },
      });
      return existing.id;
    }
    const created = await tx.crmPosition.create({
      data: { contactId, organizationId, title: data.title ?? 'Đầu mối liên hệ', isCurrent: true, isFocalPoint: true },
      select: { id: true },
    });
    return created.id;
  }, CRM_TRANSACTION);

  return NextResponse.json({ positionId }, { status: 201 });
});

/** Bỏ đánh dấu đầu mối (?positionId=…) — người đó vẫn là người liên hệ của tổ chức. */
export const DELETE = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id: organizationId } = await params;
  const positionId = new URL(request.url).searchParams.get('positionId');
  if (!positionId) throw new HttpError(400, 'Thiếu chức vụ cần bỏ đầu mối');
  const { count } = await prisma.crmPosition.updateMany({ where: { id: positionId, organizationId }, data: { isFocalPoint: false } });
  if (count === 0) throw new HttpError(404, 'Không tìm thấy người liên hệ này ở tổ chức');
  return NextResponse.json({ ok: true });
});
