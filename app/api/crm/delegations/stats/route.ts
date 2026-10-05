import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { computeDelegationStats } from '@/lib/crm/delegation-stats';

/** Thống kê tiếp đoàn mọi năm (vài trăm lượt — tính tại chỗ). */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const items = await prisma.crmInteraction.findMany({
    where: { type: 'DELEGATION' },
    select: {
      status: true, occurredAt: true, dateUnknown: true, purpose: true, topics: true, guestCount: true, cashReceived: true, needsReview: true,
      hostUnit: true, hostDepartment: { select: { name: true } },
      organization: { select: { id: true, name: true, category: true } },
    },
  });
  return compressedJson(request, computeDelegationStats(items.map((i) => ({ ...i, hostUnit: i.hostDepartment?.name ?? i.hostUnit }))));
});
