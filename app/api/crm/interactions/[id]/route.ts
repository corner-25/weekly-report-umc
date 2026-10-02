import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interactionInputSchema } from '@/lib/crm/schemas';
import { handle, requireSession } from '@/lib/crm/server';
import { saveInteraction } from '../save';

type Ctx = { params: Promise<{ id: string }> };

/** Sửa lượt tương tác — modal gửi đủ trường như khi tạo. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  await prisma.crmInteraction.findUniqueOrThrow({ where: { id }, select: { id: true } });
  const data = interactionInputSchema.parse(await request.json());
  return NextResponse.json(await saveInteraction(data, { id }));
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  await prisma.crmInteraction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
