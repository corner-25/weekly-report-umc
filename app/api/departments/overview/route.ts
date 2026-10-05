import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { buildDepartmentOverview } from '@/lib/department-overview';
import { compressedJson } from '@/lib/http/compressed-json';

/** Bảng tổng quan phòng ban — xem lib/department-overview.ts. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const overview = await buildDepartmentOverview(prisma);
  return compressedJson(request, overview, { headers: { 'Cache-Control': 'private, no-cache' } });
});
