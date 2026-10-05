import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, interactionInclude, requireSession, toInteractionDto } from '@/lib/crm/server';
import { INTERACTION_STATUSES } from '@/lib/crm/schemas';

const bodySchema = z.object({
  status: z.enum(INTERACTION_STATUSES),
  /** Ghi chú kết quả khi đánh dấu xong/huỷ (vd "khách đổi lịch sang thứ 6"). */
  note: z.string().trim().max(2000).optional(),
});

/**
 * Cập nhật trạng thái lịch hẹn dẫn khách — ai trong phòng cũng làm được (người
 * dẫn thực tế thường không phải người đã đặt lịch). Sửa nội dung thì vẫn cần
 * quyền như PATCH lượt tương tác.
 */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const { status, note } = bodySchema.parse(await request.json());
  const existing = await prisma.crmInteraction.findUniqueOrThrow({ where: { id }, select: { note: true, status: true } });
  if (existing.status === status) throw new HttpError(400, 'Lượt này đã ở trạng thái đó');
  const updated = await prisma.crmInteraction.update({
    where: { id },
    data: {
      status,
      ...(note && { note: existing.note ? `${existing.note}\n${note}` : note }),
    },
    include: interactionInclude,
  });
  return NextResponse.json(toInteractionDto(updated));
});
