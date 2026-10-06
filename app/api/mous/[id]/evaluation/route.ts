import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { EVALUATIONS } from '@/lib/mou/assess';
import { refreshMouKnowledge } from '@/lib/mou/knowledge-refresh';

const bodySchema = z.object({
  evaluation: z.enum(EVALUATIONS).nullable(),
  note: z.string().trim().max(4000).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** Lãnh đạo / Phòng HC chốt đánh giá hiệu quả MOU (AI chỉ gợi ý). null để xoá đánh giá. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  refreshMouKnowledge();
  const session = await requireSession();
  const { id } = await params;
  const body = bodySchema.parse(await request.json());
  const exists = await prisma.mOU.count({ where: { id, deletedAt: null } });
  if (!exists) throw new HttpError(404, 'Không tìm thấy MOU');
  const mou = await prisma.mOU.update({
    where: { id },
    data: {
      evaluation: body.evaluation,
      evaluationNote: body.evaluation ? body.note || null : null,
      evaluatedAt: body.evaluation ? new Date() : null,
      evaluatedBy: body.evaluation ? session.user?.name || session.user?.email || null : null,
    },
    select: { evaluation: true, evaluationNote: true, evaluatedAt: true, evaluatedBy: true },
  });
  return NextResponse.json(mou);
});
