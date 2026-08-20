import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Số dòng log trả về cho một lần chạy. */
const LOG_LIMIT = 200;

/** Chi tiết log của một lần chạy, để truy nguyên khi nguồn hỏng. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const run = await prisma.syncRun.findUnique({
    where: { id },
    select: {
      id: true,
      sourceId: true,
      status: true,
      trigger: true,
      startedAt: true,
      finishedAt: true,
      rowsRead: true,
      rowsUpserted: true,
      rowsSkipped: true,
      errorMessage: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Không tìm thấy lần chạy' }, { status: 404 });
  }

  const logs = await prisma.syncLog.findMany({
    where: { runId: id },
    orderBy: { createdAt: 'asc' },
    take: LOG_LIMIT,
    select: { id: true, level: true, message: true, context: true, createdAt: true },
  });

  return NextResponse.json({ run, logs });
}
