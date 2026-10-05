import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { compressedJson } from '@/lib/http/compressed-json';

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
      // null = nhiệm vụ không theo dõi tiến độ (dữ liệu nhập từ Excel/AI có nhiều dòng như vậy)
      progress: z.number().min(0).max(100).nullable(),
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
      progress: z.number().min(0).max(100).nullable(),
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
      const parsedYear = Number.parseInt(year, 10);
      if (!Number.isInteger(parsedYear)) {
        return NextResponse.json({ error: 'Năm không hợp lệ' }, { status: 400 });
      }
      where.year = parsedYear;
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
        createdBy: { select: { name: true } },
        _count: {
          select: {
            taskProgress: true,
            tasks: true, // Keep for backward compatibility
            metricValues: true,
            extractedMetrics: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { weekNumber: 'desc' },
      ],
    });

    // Một truy vấn gộp cho mọi tuần: số đơn vị, tên đơn vị và số nhiệm vụ
    // trống kết quả — thay vì kéo toàn bộ taskProgress về.
    const weekIds = weeks.map((w) => w.id);
    const deptStats = weekIds.length > 0
      ? await prisma.$queryRaw<{ weekId: string; deptCount: bigint; deptNames: string[] | null; emptyResults: bigint }[]>`
          SELECT wtp."weekId" AS "weekId",
                 COUNT(DISTINCT mt."departmentId") AS "deptCount",
                 ARRAY_AGG(DISTINCT d.name) AS "deptNames",
                 COUNT(*) FILTER (WHERE BTRIM(wtp.result) = '') AS "emptyResults"
          FROM week_task_progress wtp
          JOIN master_tasks mt ON mt.id = wtp."masterTaskId"
          JOIN departments d ON d.id = mt."departmentId"
          WHERE wtp."weekId" = ANY(${weekIds}::text[])
          GROUP BY wtp."weekId"
        `
      : [];

    const statsByWeek = new Map(deptStats.map((r) => [r.weekId, r]));

    const transformedWeeks = weeks.map(({ createdBy, ...week }) => {
      const stats = statsByWeek.get(week.id);
      return {
        ...week,
        departmentCount: stats ? Number(stats.deptCount) : 0,
        taskCount: week._count.taskProgress + week._count.tasks,
        // Trường bổ sung cho trang danh sách — các trang khác bỏ qua được.
        departmentNames: stats?.deptNames ?? [],
        emptyResultCount: stats ? Number(stats.emptyResults) : 0,
        metricValueCount: week._count.metricValues,
        extractedMetricCount: week._count.extractedMetrics,
        createdByName: createdBy?.name ?? null,
      };
    });

    return compressedJson(request, transformedWeeks);
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
        // Nhiệm vụ phát sinh (không thuộc danh mục) — trước đây bị bỏ qua âm thầm.
        tasks: data.tasks && data.tasks.length > 0
          ? {
              create: data.tasks.map((t) => ({
                departmentId: t.departmentId,
                orderNumber: t.orderNumber,
                taskName: t.taskName,
                result: t.result,
                timePeriod: t.timePeriod,
                progress: t.progress,
                nextWeekPlan: t.nextWeekPlan,
                isImportant: t.isImportant || false,
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
