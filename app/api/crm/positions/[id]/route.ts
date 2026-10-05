import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { handle, HttpError, requireSession } from '@/lib/crm/server';

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  await prisma.crmPosition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

/** Đánh dấu / bỏ đánh dấu đầu mối liên hệ của tổ chức trên chức vụ này. */
export const PATCH = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const { isFocalPoint } = z.object({ isFocalPoint: z.boolean() }).parse(await request.json());
  const position = await prisma.crmPosition.findUnique({ where: { id }, select: { organizationId: true } });
  if (!position) throw new HttpError(404, 'Không tìm thấy chức vụ');
  if (isFocalPoint && !position.organizationId) throw new HttpError(400, 'Chức vụ chưa gắn tổ chức nên không làm đầu mối được');
  await prisma.crmPosition.update({ where: { id }, data: { isFocalPoint } });
  return NextResponse.json({ ok: true });
});
