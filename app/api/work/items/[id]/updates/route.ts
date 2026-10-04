import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { workUpdateCreateSchema } from '@/lib/work/schemas';
import { updateHash } from '@/lib/work/status';
import { toWorkUpdateDto } from '@/lib/work/server';

/** Ghi tay một lần cập nhật tiến độ (vd thư ký báo qua điện thoại). */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await params;
  const data = workUpdateCreateSchema.parse(await request.json());
  const item = await prisma.workItem.findUnique({ where: { id }, select: { lastActivityAt: true } });
  if (!item) throw new HttpError(404, 'Không tìm thấy công việc');

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
  const author = session.user.name ?? session.user.email ?? null;
  const update = await prisma.$transaction(async (tx) => {
    const created = await tx.workUpdate.create({
      data: {
        workItemId: id,
        source: 'MANUAL',
        occurredAt,
        author,
        content: data.content,
        progressPercent: data.progressPercent ?? null,
        contentHash: updateHash({ occurredAt, author, content: data.content }),
      },
    });
    await tx.workItem.update({
      where: { id },
      data: {
        lastActivityAt: item.lastActivityAt && item.lastActivityAt > occurredAt ? item.lastActivityAt : occurredAt,
        ...(data.progressPercent !== undefined && { progressPercent: data.progressPercent }),
      },
    });
    return created;
  });
  return NextResponse.json(toWorkUpdateDto(update), { status: 201 });
});
