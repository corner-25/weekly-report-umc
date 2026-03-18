import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const importSchema = z.object({
  weekNumber: z.number().min(1).max(53),
  year: z.number().min(2000),
  startDate: z.string(),
  endDate: z.string(),
  taskProgress: z.array(
    z.object({
      masterTaskId: z.string(),
      orderNumber: z.number(),
      result: z.string(),
      timePeriod: z.string(),
      progress: z.number().min(0).max(100).nullable(),
      nextWeekPlan: z.string(),
      isImportant: z.boolean(),
    })
  ),
  metricValues: z.array(
    z.object({
      metricId: z.string(),
      value: z.number(),
      note: z.string().nullable().optional(),
    })
  ).optional(),
});

// GET - Fetch master tasks and metric definitions for matching
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [departments, masterTasks, metricDefinitions] = await Promise.all([
      prisma.department.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.masterTask.findMany({
        include: {
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ departmentId: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.metricDefinition.findMany({
        where: { isActive: true },
        include: {
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ departmentId: 'asc' }, { orderNumber: 'asc' }],
      }),
    ]);

    return NextResponse.json({
      departments,
      masterTasks: masterTasks.map(mt => ({
        id: mt.id,
        name: mt.name,
        departmentId: mt.department.id,
        departmentName: mt.department.name,
      })),
      metricDefinitions: metricDefinitions.map(md => ({
        id: md.id,
        name: md.name,
        unit: md.unit,
        departmentId: md.department.id,
        departmentName: md.department.name,
        orderNumber: md.orderNumber,
      })),
    });
  } catch (error) {
    console.error('Error fetching import data:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Submit imported data
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = importSchema.parse(body);

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
      // Update existing week: delete old data and replace
      await prisma.$transaction(async (tx) => {
        await tx.weekTaskProgress.deleteMany({ where: { weekId: existing.id } });
        await tx.weekMetricValue.deleteMany({ where: { weekId: existing.id } });

        await tx.week.update({
          where: { id: existing.id },
          data: {
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            status: 'DRAFT',
          },
        });

        if (data.taskProgress.length > 0) {
          await tx.weekTaskProgress.createMany({
            data: data.taskProgress.map(tp => ({
              weekId: existing.id,
              masterTaskId: tp.masterTaskId,
              orderNumber: tp.orderNumber,
              result: tp.result,
              timePeriod: tp.timePeriod,
              progress: tp.progress,
              nextWeekPlan: tp.nextWeekPlan,
              isImportant: tp.isImportant,
              completedAt: tp.progress === 100 ? new Date() : null,
            })),
          });
        }

        if (data.metricValues && data.metricValues.length > 0) {
          await tx.weekMetricValue.createMany({
            data: data.metricValues.map(mv => ({
              weekId: existing.id,
              metricId: mv.metricId,
              value: mv.value,
              note: mv.note || null,
            })),
          });
        }
      });

      return NextResponse.json({
        message: `Đã cập nhật báo cáo tuần ${data.weekNumber}/${data.year}`,
        weekId: existing.id,
        updated: true,
      });
    }

    // Create new week
    const week = await prisma.week.create({
      data: {
        weekNumber: data.weekNumber,
        year: data.year,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'DRAFT',
        createdById: session.user.id,
      },
    });

    if (data.taskProgress.length > 0) {
      await prisma.weekTaskProgress.createMany({
        data: data.taskProgress.map(tp => ({
          weekId: week.id,
          masterTaskId: tp.masterTaskId,
          orderNumber: tp.orderNumber,
          result: tp.result,
          timePeriod: tp.timePeriod,
          progress: tp.progress,
          nextWeekPlan: tp.nextWeekPlan,
          isImportant: tp.isImportant,
          completedAt: tp.progress === 100 ? new Date() : null,
        })),
      });
    }

    if (data.metricValues && data.metricValues.length > 0) {
      await prisma.weekMetricValue.createMany({
        data: data.metricValues.map(mv => ({
          weekId: week.id,
          metricId: mv.metricId,
          value: mv.value,
          note: mv.note || null,
        })),
      });
    }

    return NextResponse.json({
      message: `Đã tạo báo cáo tuần ${data.weekNumber}/${data.year}`,
      weekId: week.id,
      updated: false,
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing data:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
