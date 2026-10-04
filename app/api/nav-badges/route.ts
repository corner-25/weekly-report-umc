import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { CLOSED_STATUSES } from '@/lib/work/constants';

/**
 * Số việc cần xử lý hiện trên menu: công việc quá hạn, lịch hẹn CRM đã qua chưa
 * cập nhật, xe quá hạn kiểm định. Đếm thuần (count), lưu đệm 5 phút.
 */
const countBadges = unstable_cache(
  async () => {
    const now = new Date();
    const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const [work, crm, vehicles] = await Promise.all([
      prisma.workItem.count({ where: { status: { notIn: [...CLOSED_STATUSES] }, dueDate: { lt: today } } }),
      prisma.crmInteraction.count({ where: { status: 'PLANNED', occurredAt: { lt: today } } }),
      prisma.vehicle.count({ where: { deletedAt: null, inspectionExpiry: { lt: now } } }),
    ]);
    return { work, crm, vehicles };
  },
  ['nav-badges'],
  { revalidate: 300 },
);

export const GET = handle(async () => {
  await requireSession();
  return NextResponse.json(await countBadges(), { headers: { 'Cache-Control': 'private, max-age=120' } });
});
