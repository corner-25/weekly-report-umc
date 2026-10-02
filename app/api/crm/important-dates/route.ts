import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { importantDateInputSchema } from '@/lib/crm/schemas';
import { assertValidDate, handle, requireSession, toImportantDateDto } from '@/lib/crm/server';

export const POST = handle(async (request: Request) => {
  await requireSession();
  const data = importantDateInputSchema.parse(await request.json());
  assertValidDate(data.day, data.month, data.isLunar);
  const created = await prisma.crmImportantDate.create({ data });
  return NextResponse.json(toImportantDateDto(created), { status: 201 });
});
