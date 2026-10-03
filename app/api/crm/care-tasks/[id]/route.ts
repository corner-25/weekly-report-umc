import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { careTaskFieldsSchema } from '@/lib/crm/schemas';
import { canModifyInteraction, careTaskInclude, handle, HttpError, requireSession, toCareTaskDto, CRM_TRANSACTION } from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sửa việc quà/hoa — modal gửi đủ trường; dịp và đối tác không đổi được. Việc đã
 * trao thì lượt tương tác GIFT đi kèm cũng được cập nhật nội dung theo.
 */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const data = careTaskFieldsSchema.parse(await request.json());
  const values = {
    ...data,
    budget: data.budget ?? null,
    actualCost: data.actualCost ?? null,
    assigneeName: data.assigneeName ?? null,
    note: data.note ?? null,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.crmCareTask.findUniqueOrThrow({ where: { id }, select: { interactionId: true } });
    if (existing.interactionId) {
      await tx.crmInteraction.update({
        where: { id: existing.interactionId },
        data: { content: data.description, ...(data.assigneeName && { staffName: data.assigneeName }) },
      });
    }
    return tx.crmCareTask.update({ where: { id }, data: values, include: careTaskInclude });
  }, CRM_TRANSACTION);
  return NextResponse.json(toCareTaskDto(updated));
});

/** Xoá việc: người tạo hoặc quản trị. Lượt tương tác GIFT đã ghi (nếu có) vẫn giữ trong lịch sử. */
export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const existing = await prisma.crmCareTask.findUniqueOrThrow({ where: { id }, select: { createdById: true } });
  if (!canModifyInteraction(session, existing.createdById)) {
    throw new HttpError(403, 'Chỉ người đã tạo việc này hoặc quản trị viên được xoá');
  }
  await prisma.crmCareTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
