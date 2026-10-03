import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interactionInputSchema } from '@/lib/crm/schemas';
import { canModifyInteraction, handle, HttpError, requireSession } from '@/lib/crm/server';
import { saveInteraction } from '../save';

type Ctx = { params: Promise<{ id: string }> };

/** Sửa lượt tương tác — modal gửi đủ trường như khi tạo. */
/** Chỉ quản trị viên hoặc người đã ghi lượt này được sửa/xoá. */
async function assertCanModify(id: string): Promise<void> {
  const session = await requireSession();
  const existing = await prisma.crmInteraction.findUniqueOrThrow({ where: { id }, select: { createdById: true } });
  if (!canModifyInteraction(session, existing.createdById)) {
    throw new HttpError(403, 'Chỉ người đã ghi lượt này hoặc quản trị viên được sửa/xoá');
  }
}

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  await assertCanModify(id);
  const data = interactionInputSchema.parse(await request.json());
  return NextResponse.json(await saveInteraction(data, { id }));
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  await assertCanModify(id);
  await prisma.crmInteraction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
