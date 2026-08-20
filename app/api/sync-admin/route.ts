import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Số lần chạy gần nhất hiển thị trên trang quản trị. */
const RECENT_RUNS_LIMIT = 20;

/** Số tuần chờ duyệt liệt kê ra. */
const PENDING_LIMIT = 50;

/**
 * Dữ liệu cho trang quản trị đồng bộ: trạng thái từng nguồn, lịch sử chạy,
 * và các tuần báo cáo bệnh viện đang chờ người duyệt.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [sources, recentRuns, pending, counts] = await Promise.all([
    prisma.syncSource.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        kind: true,
        cronEnabled: true,
        lastRunAt: true,
        lastSuccessAt: true,
      },
    }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: RECENT_RUNS_LIMIT,
      select: {
        id: true,
        sourceId: true,
        status: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        rowsUpserted: true,
        rowsSkipped: true,
        errorMessage: true,
      },
    }),
    prisma.pendingAiImport.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ year: 'asc' }, { week: 'asc' }],
      take: PENDING_LIMIT,
      select: { id: true, year: true, week: true, sheetName: true, createdAt: true },
    }),
    Promise.all([
      prisma.hcMetric.count(),
      prisma.fleetTrip.count(),
      prisma.pendingAiImport.count({ where: { status: 'PENDING' } }),
    ]),
  ]);

  const [hcMetrics, fleetTrips, pendingCount] = counts;

  return NextResponse.json({
    sources,
    recentRuns,
    pending,
    stats: { hcMetrics, fleetTrips, pendingCount },
  });
}

const ToggleSchema = z.object({
  sourceId: z.string().min(1),
  cronEnabled: z.boolean(),
});

/** Bật/tắt lịch chạy tự động của một nguồn. */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = ToggleSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 });
  }

  const source = await prisma.syncSource.findUnique({ where: { id: body.sourceId } });
  if (!source) {
    return NextResponse.json({ error: 'Không tìm thấy nguồn' }, { status: 404 });
  }

  const updated = await prisma.syncSource.update({
    where: { id: body.sourceId },
    data: { cronEnabled: body.cronEnabled },
    select: { id: true, cronEnabled: true },
  });

  return NextResponse.json(updated);
}
