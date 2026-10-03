import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { mergeContacts } from '@/lib/crm/merge';
import { CRM_TRANSACTION, handle, requireSession } from '@/lib/crm/server';

const bodySchema = z.object({ sourceId: z.string().min(1) });

/**
 * Gộp hồ sơ trùng `sourceId` vào hồ sơ này. Không mất lịch sử nên nhân viên nào
 * cũng làm được — người nhập liệu là người thấy trùng sớm nhất.
 */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const { sourceId } = bodySchema.parse(await request.json());
  await prisma.$transaction((tx) => mergeContacts(tx, id, sourceId), CRM_TRANSACTION);
  return NextResponse.json({ id });
});
