import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { careTaskStatusSchema } from '@/lib/crm/schemas';
import { DATE_KIND_LABELS, GIFT_TYPE_LABELS } from '@/lib/crm/constants';
import { careTransitionError } from '@/lib/crm/care';
import { careTaskInclude, handle, HttpError, requireSession, toCareTaskDto, CRM_TRANSACTION } from '@/lib/crm/server';

/** Người trao mặc định khi việc chưa giao ai và tài khoản không có tên. */
const FALLBACK_STAFF = 'Phòng Hành chính';

/**
 * Chuyển trạng thái việc quà/hoa — ai trong phòng cũng làm được (người đi trao
 * thường không phải người lên kế hoạch).
 *
 * Đã trao: trong cùng một transaction ghi giờ trao và tạo lượt tương tác GIFT
 * (đã thực hiện) trên dòng thời gian đối tác. Đã trao thì không huỷ/lùi lại.
 */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await params;
  const { status, deliveredAt, actualCost, note } = careTaskStatusSchema.parse(await request.json());

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.crmCareTask.findUniqueOrThrow({ where: { id }, include: careTaskInclude });
    const rejected = careTransitionError(existing.status, status);
    if (rejected) throw new HttpError(400, rejected);

    const common = {
      status,
      ...(actualCost !== undefined && { actualCost }),
      ...(note && { note: existing.note ? `${existing.note}\n${note}` : note }),
    };
    if (status !== 'DELIVERED') {
      // Điều kiện "chưa trao" trong WHERE: hai người bấm cùng lúc thì một người bị chặn.
      const { count } = await tx.crmCareTask.updateMany({ where: { id, status: { not: 'DELIVERED' } }, data: common });
      if (count === 0) throw new HttpError(400, 'Quà/hoa vừa được đánh dấu đã trao');
      return tx.crmCareTask.findUniqueOrThrow({ where: { id }, include: careTaskInclude });
    }

    const at = deliveredAt ? new Date(deliveredAt) : new Date();
    const { count } = await tx.crmCareTask.updateMany({
      where: { id, status: { not: 'DELIVERED' } },
      data: { ...common, deliveredAt: at },
    });
    if (count === 0) throw new HttpError(400, 'Quà/hoa vừa được đánh dấu đã trao');

    const occasion = existing.importantDate?.label || DATE_KIND_LABELS[existing.occasionKind];
    const interaction = await tx.crmInteraction.create({
      data: {
        type: 'GIFT',
        status: 'DONE',
        occurredAt: at,
        contactId: existing.contactId,
        organizationId: existing.organizationId,
        title: `${GIFT_TYPE_LABELS[existing.giftType]} · ${occasion}`,
        content: existing.description,
        staffName: existing.assigneeName || session.user.name || FALLBACK_STAFF,
        createdById: session.user.id,
      },
      select: { id: true },
    });
    return tx.crmCareTask.update({ where: { id }, data: { interactionId: interaction.id }, include: careTaskInclude });
  }, CRM_TRANSACTION);

  return NextResponse.json(toCareTaskDto(updated));
});
