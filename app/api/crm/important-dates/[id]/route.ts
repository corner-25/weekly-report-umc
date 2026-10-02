import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { importantDateInputSchema } from '@/lib/crm/schemas';
import { assertValidDate, handle, requireSession, toImportantDateDto } from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

/** Sửa toàn bộ ngày quan trọng (form gửi đủ trường); không đổi được chủ sở hữu. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const existing = await prisma.crmImportantDate.findUniqueOrThrow({ where: { id } });
  const body = (await request.json()) as Record<string, unknown>;
  const { contactId: _c, organizationId: _o, ...data } = importantDateInputSchema.parse({
    ...body,
    contactId: existing.contactId ?? undefined,
    organizationId: existing.organizationId ?? undefined,
  });
  assertValidDate(data.day, data.month, data.isLunar);
  const updated = await prisma.crmImportantDate.update({
    where: { id },
    data: {
      ...data,
      year: data.year ?? null,
      label: data.label ?? null,
      remindDaysBefore: data.remindDaysBefore ?? null,
      note: data.note ?? null,
    },
  });
  return NextResponse.json(toImportantDateDto(updated));
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  await prisma.crmImportantDate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
