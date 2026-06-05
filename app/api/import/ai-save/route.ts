import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

const SaveSchema = z.object({
  weekNumber: z.number().int().min(1).max(53),
  year: z.number().int().min(2000),
  startDate: z.string(),
  endDate: z.string(),
  taskProgress: z.array(z.object({
    masterTaskId: z.string(),
    result: z.string(),
  })),
  metricValues: z.array(z.object({
    metricId: z.string(),
    value: z.number(),
    note: z.string().nullable().optional(),
  })),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = SaveSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 });
  }

  const existing = await prisma.week.findUnique({
    where: { weekNumber_year: { weekNumber: body.weekNumber, year: body.year } },
  });
  if (existing) {
    return NextResponse.json({ error: `Báo cáo tuần ${body.weekNumber}/${body.year} đã tồn tại` }, { status: 409 });
  }

  // Dedupe by id (DB has unique constraints)
  const seenT = new Set<string>();
  const dedupTasks = body.taskProgress.filter((t) => {
    if (seenT.has(t.masterTaskId)) return false;
    seenT.add(t.masterTaskId);
    return true;
  });
  const seenM = new Set<string>();
  const dedupMetrics = body.metricValues.filter((m) => {
    if (seenM.has(m.metricId)) return false;
    seenM.add(m.metricId);
    return true;
  });

  const week = await prisma.$transaction(async (tx) => {
    const w = await tx.week.create({
      data: {
        weekNumber: body.weekNumber,
        year: body.year,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: 'DRAFT',
        createdById: session.user.id,
      },
    });
    if (dedupTasks.length > 0) {
      await tx.weekTaskProgress.createMany({
        data: dedupTasks.map((tp, i) => ({
          weekId: w.id,
          masterTaskId: tp.masterTaskId,
          orderNumber: i + 1,
          result: tp.result,
          timePeriod: `Tuần ${body.weekNumber}/${body.year}`,
          progress: null,
          nextWeekPlan: '',
          isImportant: false,
          completedAt: null,
        })),
      });
    }
    if (dedupMetrics.length > 0) {
      await tx.weekMetricValue.createMany({
        data: dedupMetrics.map((mv) => ({
          weekId: w.id,
          metricId: mv.metricId,
          value: mv.value,
          note: mv.note ?? null,
        })),
      });
    }
    return w;
  });

  return NextResponse.json({ id: week.id, weekNumber: week.weekNumber, year: week.year, taskCount: dedupTasks.length, metricCount: dedupMetrics.length });
}
