import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { buildMetricBoard } from '@/lib/metric-board';

/** Số liệu đổi theo lần nạp hằng ngày — lưu đệm 5 phút là đủ tươi. */
const cachedBoard = unstable_cache((year: number) => buildMetricBoard(prisma, year), ['metric-board'], { revalidate: 300 });

/** Chỉ số chuẩn theo phòng → nhóm → chỉ số, cả năm. Xem lib/metric-board.ts. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const yearParam = Number(new URL(request.url).searchParams.get('year'));
  const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  return compressedJson(request, await cachedBoard(year), { headers: { 'Cache-Control': 'private, max-age=60' } });
});
