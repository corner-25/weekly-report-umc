import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const weekUpdateSchema = z.object({
  weekNumber: z.number().min(1).max(53).optional(),
  year: z.number().min(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reportFileUrl: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'COMPLETED']).optional(),
  taskProgress: z.array(
    z.object({
      id: z.string().optional(),
      masterTaskId: z.string(),
      orderNumber: z.number(),
      result: z.string(),
      timePeriod: z.string(),
      progress: z.number().min(0).max(100),
      nextWeekPlan: z.string(),
      isImportant: z.boolean().optional(),
    })
  ).optional(),
});

// GET single week with all tasks
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const week = await prisma.week.findUnique({
      where: { id },
      include: {
        taskProgress: {
          include: {
            masterTask: {
              include: {
                department: true,
              },
            },
          },
          orderBy: {
            orderNumber: 'asc',
          },
        },
        tasks: {
          include: {
            department: true,
          },
          orderBy: {
            orderNumber: 'asc',
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!week) {
      return NextResponse.json(
        { error: 'Không tìm thấy báo cáo' },
        { status: 404 }
      );
    }

    // Group task progress by department
    const tasksByDepartment = week.taskProgress.reduce((acc, tp) => {
      const deptId = tp.masterTask.department.id;
      if (!acc[deptId]) {
        acc[deptId] = {
          department: tp.masterTask.department,
          tasks: [],
        };
      }
      acc[deptId].tasks.push({
        ...tp,
        taskName: tp.masterTask.name,
        department: tp.masterTask.department,
      });
      return acc;
    }, {} as any);

    // Also include old tasks for backward compatibility
    week.tasks.forEach((task) => {
      const deptId = task.department.id;
      if (!tasksByDepartment[deptId]) {
        tasksByDepartment[deptId] = {
          department: task.department,
          tasks: [],
        };
      }
      tasksByDepartment[deptId].tasks.push(task);
    });

    return NextResponse.json({
      ...week,
      tasksByDepartment: Object.values(tasksByDepartment),
    });
  } catch (error) {
    console.error('Error fetching week:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// PUT - Update week
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = weekUpdateSchema.parse(body);

    // If updating week number or year, check for conflicts
    if (data.weekNumber || data.year) {
      const currentWeek = await prisma.week.findUnique({
        where: { id },
      });

      if (!currentWeek) {
        return NextResponse.json(
          { error: 'Không tìm thấy báo cáo' },
          { status: 404 }
        );
      }

      const weekNumber = data.weekNumber ?? currentWeek.weekNumber;
      const year = data.year ?? currentWeek.year;

      const existing = await prisma.week.findFirst({
        where: {
          weekNumber,
          year,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Báo cáo tuần này đã tồn tại' },
          { status: 400 }
        );
      }
    }

    // Update week and task progress in a transaction
    const week = await prisma.$transaction(async (tx) => {
      // Update week basic info
      const updatedWeek = await tx.week.update({
        where: { id },
        data: {
          weekNumber: data.weekNumber,
          year: data.year,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          reportFileUrl: data.reportFileUrl === null ? null : data.reportFileUrl,
          status: data.status,
        },
      });

      // If task progress is provided, replace all task progress
      if (data.taskProgress) {
        // Delete existing task progress
        await tx.weekTaskProgress.deleteMany({
          where: { weekId: id },
        });

        // Create new task progress
        await tx.weekTaskProgress.createMany({
          data: data.taskProgress.map((tp) => ({
            weekId: id,
            masterTaskId: tp.masterTaskId,
            orderNumber: tp.orderNumber,
            result: tp.result,
            timePeriod: tp.timePeriod,
            progress: tp.progress,
            nextWeekPlan: tp.nextWeekPlan,
            isImportant: tp.isImportant || false,
            completedAt: tp.progress === 100 ? new Date() : null,
          })),
        });
      }

      return updatedWeek;
    });

    // Fetch updated week with task progress
    const fullWeek = await prisma.week.findUnique({
      where: { id },
      include: {
        taskProgress: {
          include: {
            masterTask: {
              include: {
                department: true,
              },
            },
          },
          orderBy: {
            orderNumber: 'asc',
          },
        },
      },
    });

    return NextResponse.json(fullWeek);
  } catch (error) {
    console.error('Error updating week:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// DELETE - Delete week
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete week (tasks will be cascade deleted)
    await prisma.week.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Đã xóa báo cáo' });
  } catch (error) {
    console.error('Error deleting week:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}
