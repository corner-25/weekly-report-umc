import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';

export const DELETE = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  await prisma.crmRelation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
