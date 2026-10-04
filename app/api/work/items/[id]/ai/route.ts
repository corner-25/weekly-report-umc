import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { todayInVietnam } from '@/lib/crm/upcoming';
import { WORK_KIND_LABELS, WORK_STATUS_LABELS } from '@/lib/work/constants';
import { suggestWorkPlan } from '@/lib/work/ai';
import { toWorkItemDto, workItemInclude } from '@/lib/work/server';

export const maxDuration = 120;

/** AI gợi ý các bước và đánh giá tiến độ; lưu lại để cả phòng cùng xem. */
export const POST = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await params;
  const item = await prisma.workItem.findUnique({
    where: { id },
    include: { ...workItemInclude, updates: { orderBy: { occurredAt: 'asc' } } },
  });
  if (!item) throw new HttpError(404, 'Không tìm thấy công việc');

  let plan;
  try {
    ({ plan } = await suggestWorkPlan({
      title: item.title,
      description: item.description,
      kind: item.kind,
      directedBy: item.directedBy,
      directedAt: item.directedAt?.toISOString().slice(0, 10) ?? null,
      leadUnit: item.leadUnit ?? item.department?.name ?? null,
      assignees: item.assignees,
      dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
      status: `${WORK_STATUS_LABELS[item.status]} (${WORK_KIND_LABELS[item.kind]})`,
      progressPercent: item.progressPercent,
      characteristics: item.characteristics,
      notes: item.notes,
      updates: item.updates.map((u) => ({
        occurredAt: u.occurredAt.toISOString(), author: u.author, content: u.content, progressPercent: u.progressPercent,
      })),
      today: todayInVietnam(),
    }));
  } catch (error) {
    console.error('Gợi ý AI cho công việc lỗi:', error);
    throw new HttpError(502, 'AI chưa trả lời được, thử lại sau ít phút');
  }

  const updated = await prisma.workItem.update({
    where: { id },
    data: { aiPlan: plan.steps as Prisma.InputJsonValue, aiAssessment: plan.assessment, aiUpdatedAt: new Date() },
    include: workItemInclude,
  });
  return NextResponse.json(toWorkItemDto(updated));
});
