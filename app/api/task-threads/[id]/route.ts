import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { threadListSelect, toThreadDto } from '@/lib/task-tracking/server';

type Ctx = { params: Promise<{ id: string }> };

/** Chi tiết một việc kèm mọi lần báo cáo. */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const thread = await prisma.taskThread.findUnique({ where: { id }, select: threadListSelect });
  if (!thread) throw new HttpError(404, 'Không tìm thấy việc');
  const entries = await prisma.taskThreadEntry.findMany({
    where: { threadId: id },
    orderBy: { week: 'asc' },
    select: { week: true, progress: true, resultText: true, nextWeekPlan: true, timePeriod: true, rawName: true },
  });
  return NextResponse.json({ ...toThreadDto(thread), entries });
});

const overrideSchema = z.union([
  z.object({ clear: z.literal(true) }),
  z.object({
    kind: z.enum(['ROUTINE', 'PROJECT', 'ONE_OFF']),
    status: z.enum(['IN_PROGRESS', 'DONE', 'STALLED', 'STOPPED']),
    progress: z.number().int().min(0).max(100).nullable().optional(),
    note: z.string().trim().max(500).optional(),
  }),
]);

/**
 * Phòng HC xác nhận / sửa loại việc và tình trạng. AI không ghi đè các giá trị
 * này ở lần chạy sau. `{ clear: true }` trả lại cho AI quyết.
 */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const body = overrideSchema.parse(await request.json());
  const data =
    'clear' in body
      ? { overrideKind: null, overrideStatus: null, overrideProgress: null, overrideNote: null, overriddenBy: null, overriddenAt: null }
      : {
          overrideKind: body.kind,
          overrideStatus: body.status,
          overrideProgress: body.kind === 'ROUTINE' ? null : body.progress ?? null,
          overrideNote: body.note || null,
          overriddenBy: session.user.name ?? session.user.email ?? null,
          overriddenAt: new Date(),
        };
  const thread = await prisma.taskThread.update({ where: { id }, data, select: threadListSelect });
  return NextResponse.json(toThreadDto(thread));
});
