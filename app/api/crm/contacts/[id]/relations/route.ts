import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { relationInputSchema } from '@/lib/crm/schemas';
import { handle, HttpError, requireSession } from '@/lib/crm/server';

/** Thêm người thân/trợ lý: nối hồ sơ có sẵn, hoặc chỉ ghi tên và số điện thoại. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const data = relationInputSchema.parse(await request.json());
  if (data.toContactId === id) throw new HttpError(400, 'Không thể tự nối hồ sơ với chính nó');

  const contact = await prisma.crmContact.findUnique({ where: { id }, select: { id: true } });
  if (!contact) throw new HttpError(404, 'Không tìm thấy hồ sơ');
  const relation = await prisma.crmRelation.create({ data: { ...data, fromContactId: id } });
  return NextResponse.json(relation, { status: 201 });
});
