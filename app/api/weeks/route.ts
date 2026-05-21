import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const weekSchema = z.object({
  weekNumber: z.number().min(1).max(53),
  year: z.number().min(2000),
  startDate: z.string(),
  endDate: z.string(),
  reportFileUrl: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'COMPLETED']).optional(),
  taskProgress: z.array(
    z.object({
      masterTaskId: z.string(),
      orderNumber: z.number(),
      result: z.string(),
      timePeriod: z.string(),
      progress: z.number().min(0).max(100),
      nextWeekPlan: z.string(),
      isImportant: z.boolean().optional(),
    })
  ).optional(),
  tasks: z.array(
    z.object({
      departmentId: z.string(),
      orderNumber: z.number(),
      taskName: z.string(),
      result: z.string(),
      timePeriod: z.string(),
      progress: z.number().min(0).max(100),
      nextWeekPlan: z.string(),
      isImportant: z.boolean().optional(),
    })
  ).optional(),
});

// GET all weeks
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const search = searchParams.get('search');

    const where: { year?: number; OR?: { weekNumber: { equals: number } }[] } = {};

    if (year) {
      where.year = parseInt(year);
    }

    if (search) {
      where.OR = [
        { weekNumber: { equals: parseInt(search) || 0 } },
      ];
    }

    const weeks = await prisma.week.findMany({
      where,
      select: {
        id: true,
        weekNumber: true,
        year: true,
        startDate: true,
        endDate: true,
        reportFileUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        _count: {
          select: {
            taskProgress: true,
            tasks: true, // Keep for backward compatibility
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { weekNumber: 'desc' },
      ],
    });

    // Count distinct departments per week using a single raw query
    // instead of pulling every taskProgress row across the wire.
    const weekIds = weeks.map((w) => w.id);
    const deptCounts = weekIds.length > 0
      ? await prisma.$queryRaw<{ weekId: string; deptCount: bigint }[]>`
          SELECT wtp."weekId" AS "weekId",
                 COUNT(DISTINCT mt."departmentId") AS "deptCount"
          FROM week_task_progress wtp
          JOIN master_tasks mt ON mt.id = wtp."masterTaskId"
          WHERE wtp."weekId" = ANY(${weekIds}::text[])
          GROUP BY wtp."weekId"
        `
      : [];

    const deptCountByWeek = new Map(
      deptCounts.map((r) => [r.weekId, Number(r.deptCount)])
    );

    const transformedWeeks = weeks.map((week) => ({
      ...week,
      departmentCount: deptCountByWeek.get(week.id) ?? 0,
      taskCount: week._count.taskProgress + week._count.tasks,
    }));

    return NextResponse.json(transformedWeeks);
  } catch (error) {
    console.error('Error fetching weeks:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// POST - Create new week report
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = weekSchema.parse(body);

    // Check if week already exists
    const existing = await prisma.week.findUnique({
      where: {
        weekNumber_year: {
          weekNumber: data.weekNumber,
          year: data.year,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Báo cáo tuần này đã tồn tại' },
        { status: 400 }
      );
    }

    // Create week with task progress
    const week = await prisma.week.create({
      data: {
        weekNumber: data.weekNumber,
        year: data.year,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reportFileUrl: data.reportFileUrl,
        status: data.status || 'DRAFT',
        createdById: session.user.id,
        taskProgress: data.taskProgress
          ? {
              create: data.taskProgress.map((tp) => ({
                masterTaskId: tp.masterTaskId,
                orderNumber: tp.orderNumber,
                result: tp.result,
                timePeriod: tp.timePeriod,
                progress: tp.progress,
                nextWeekPlan: tp.nextWeekPlan,
                isImportant: tp.isImportant || false,
                completedAt: tp.progress === 100 ? new Date() : null,
              })),
            }
          : undefined,
      },
      include: {
        taskProgress: {
          include: {
            masterTask: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(week, { status: 201 });
  } catch (error) {
    console.error('Error creating week:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}
