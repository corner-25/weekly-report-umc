import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { WORK_LOCAL_FIELDS, workItemPatchSchema } from '@/lib/work/schemas';
import { toWorkItemDto, toWorkUpdateDto, workItemInclude } from '@/lib/work/server';

type Ctx = { params: Promise<{ id: string }> };

async function findItem(id: string) {
  const item = await prisma.workItem.findUnique({ where: { id }, include: workItemInclude });
  if (!item) throw new HttpError(404, 'Không tìm thấy công việc');
  return item;
}

/** Chi tiết kèm toàn bộ lịch sử cập nhật, mới nhất trước. */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const [item, updates] = await Promise.all([
    findItem(id),
    prisma.workUpdate.findMany({ where: { workItemId: id }, orderBy: { occurredAt: 'desc' } }),
  ]);
  return NextResponse.json({ ...toWorkItemDto(item), updates: updates.map(toWorkUpdateDto) });
});

/**
 * Sửa công việc. Việc cào từ Quản lý công việc chỉ sửa phần Phòng HC tự ghi
 * (ưu tiên, nhãn, tính chất, lưu ý, đơn vị) — phần còn lại do nguồn quyết định.
 */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const item = await findItem(id);
  const data = workItemPatchSchema.parse(await request.json());
  if (item.source === 'QLCV') {
    const blocked = Object.keys(data).filter((k) => !(WORK_LOCAL_FIELDS as readonly string[]).includes(k));
    if (blocked.length > 0) {
      throw new HttpError(400, 'Việc lấy từ phân hệ Quản lý công việc chỉ sửa được ưu tiên, nhãn, tính chất, lưu ý và đơn vị — phần còn lại cập nhật ở ứng dụng nội bộ');
    }
  }
  const { directedAt, dueDate, ...rest } = data;
  const updated = await prisma.workItem.update({
    where: { id },
    data: {
      ...rest,
      ...(directedAt !== undefined && { directedAt: directedAt ? new Date(`${directedAt}T00:00:00Z`) : null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null }),
    },
    include: workItemInclude,
  });
  return NextResponse.json(toWorkItemDto(updated));
});

/** Chỉ xoá được việc tự mở; việc từ nguồn sẽ quay lại ở lần cào sau. */
export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const item = await findItem(id);
  if (item.source !== 'MANUAL') throw new HttpError(400, 'Việc lấy từ phân hệ Quản lý công việc không xoá ở đây được');
  if (session.user.role !== 'ADMIN' && item.createdById !== session.user.id) {
    throw new HttpError(403, 'Chỉ người mở việc hoặc quản trị viên được xoá');
  }
  await prisma.workItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
