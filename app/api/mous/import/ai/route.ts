import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError } from '@/lib/crm/server';
import { requireImporter } from '@/lib/import-token';
import { assessMou, extractMou } from '@/lib/mou/ai-run';
import { refreshMouKnowledge } from '@/lib/mou/knowledge-refresh';

export const maxDuration = 180;

const bodySchema = z.object({ taskId: z.string().min(1), extract: z.boolean().default(true) });

/**
 * Sau khi script cào tải lên văn bản mới của một MOU: AI đọc lại văn bản (khía cạnh
 * đã ký) và đánh giá lại triển khai. Mỗi lần gọi một MOU (~1 phút).
 */
export const POST = handle(async (request: Request) => {
  await requireImporter(request);
  const { taskId, extract } = bodySchema.parse(await request.json());
  const mou = await prisma.mOU.findUnique({ where: { externalCode: taskId }, select: { id: true } });
  if (!mou) throw new HttpError(404, `Chưa có MOU mã ${taskId}`);
  const extracted = extract ? await extractMou(prisma, mou.id) : null;
  const assessed = await assessMou(prisma, mou.id);
  refreshMouKnowledge();
  return NextResponse.json({ extracted: extracted?.message ?? null, assessed: assessed.message, tokens: (extracted?.tokens ?? 0) + assessed.tokens });
});
