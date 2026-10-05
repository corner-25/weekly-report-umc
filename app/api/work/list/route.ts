import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { toWorkListItem, workItemInclude } from '@/lib/work/server';

/**
 * Toàn bộ công việc ở dạng gọn kèm cập nhật gần nhất — trang danh sách tải một
 * lần rồi lọc/sắp xếp tại chỗ (vài nghìn dòng vẫn nhẹ khi nén).
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const now = new Date();
  const [items, latest] = await Promise.all([
    prisma.workItem.findMany({ include: workItemInclude }),
    prisma.workUpdate.findMany({
      distinct: ['workItemId'],
      orderBy: [{ workItemId: 'asc' }, { occurredAt: 'desc' }],
      select: { workItemId: true, occurredAt: true, author: true, content: true, progressPercent: true },
    }),
  ]);
  const latestByItem = new Map(latest.map((u) => [u.workItemId, u]));
  return compressedJson(request, items.map((i) => toWorkListItem(i, latestByItem.get(i.id) ?? null, now)));
});
