import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { computeVipEscortStats } from '@/lib/crm/vip-escort-stats';

/** Thống kê dẫn khám VIP mọi năm (tương tự như sổ tiếp đoàn). */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const items = await prisma.crmInteraction.findMany({
    where: { type: 'VIP_ESCORT' },
    select: {
      id: true,
      status: true,
      occurredAt: true,
      visitKind: true,
      services: true,
      contactId: true,
      referrerContactId: true,
      visitItems: true,
      referrerContact: { select: { id: true, fullName: true } },
      doctors: { select: { contact: { select: { id: true, fullName: true } } } },
    },
  });

  return compressedJson(request, computeVipEscortStats(items));
});

