import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { generateWeeklySummary } from '@/lib/weekly-summary/generate';
import { summaryContentSchema } from '@/lib/weekly-summary/types';

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

async function findWeek(id: string) {
  const week = await prisma.week.findUnique({ where: { id }, select: { id: true, weekNumber: true, year: true, startDate: true, endDate: true, summary: true } });
  if (!week) throw new HttpError(404, 'Không tìm thấy tuần báo cáo');
  return week;
}

function toDto(week: Awaited<ReturnType<typeof findWeek>>) {
  const { summary, ...rest } = week;
  return {
    week: { ...rest, startDate: rest.startDate.toISOString(), endDate: rest.endDate.toISOString() },
    summary: summary && {
      content: summary.content,
      status: summary.status,
      model: summary.model,
      tokens: summary.tokens,
      generatedAt: summary.generatedAt?.toISOString() ?? null,
      editedAt: summary.editedAt?.toISOString() ?? null,
      editedBy: summary.editedBy,
      finalizedAt: summary.finalizedAt?.toISOString() ?? null,
    },
  };
}

/** Báo cáo tóm tắt của tuần (chưa viết thì summary = null). */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  return NextResponse.json(toDto(await findWeek(id)));
});

/** AI viết (lại) bản nháp từ báo cáo các phòng. Bản đã chốt thì phải bỏ chốt trước. */
export const POST = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const week = await findWeek(id);
  if (week.summary?.status === 'FINAL') throw new HttpError(409, 'Báo cáo đã chốt — bỏ chốt trước khi cho AI viết lại');
  const { content, model, tokens } = await generateWeeklySummary(prisma, week.id);
  const now = new Date();
  await prisma.weeklySummary.upsert({
    where: { weekId: week.id },
    create: { weekId: week.id, content, model, tokens, generatedAt: now, editedBy: session.user.name ?? session.user.email ?? null },
    update: { content, model, tokens, generatedAt: now, status: 'DRAFT', editedAt: null, finalizedAt: null },
  });
  return NextResponse.json(toDto(await findWeek(id)));
});

const putSchema = z.object({
  content: summaryContentSchema,
  status: z.enum(['DRAFT', 'FINAL']).optional(),
});

/** Lưu bản Phòng HC đã sửa; status FINAL là chốt (bản chốt làm mẫu văn phong cho các tuần sau). */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const week = await findWeek(id);
  const { content, status } = putSchema.parse(await request.json());
  const now = new Date();
  const editor = session.user.name ?? session.user.email ?? null;
  await prisma.weeklySummary.upsert({
    where: { weekId: week.id },
    create: { weekId: week.id, content, status: status ?? 'DRAFT', editedAt: now, editedBy: editor, finalizedAt: status === 'FINAL' ? now : null },
    update: {
      content,
      editedAt: now,
      editedBy: editor,
      ...(status && { status, finalizedAt: status === 'FINAL' ? now : null }),
    },
  });
  return NextResponse.json(toDto(await findWeek(id)));
});
