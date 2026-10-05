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
      // null = nhiệm vụ không theo dõi tiến độ
      progress: z.number().min(0).max(100).nullable(),
      nextWeekPlan: z.string(),
      isImportant: z.boolean().optional(),
    })
  ).optional(),
  // Nhiệm vụ phát sinh (bảng tasks cũ). Có gửi thì thay toàn bộ; không gửi thì giữ nguyên.
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

type TaskProgressInput = NonNullable<z.infer<typeof weekUpdateSchema>['taskProgress']>[number];

/** Giao dịch sửa tuần có thể chạm ~90 dòng qua mạng tới Railway — nới thời gian chờ. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

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
        taskProgress: {
          select: {
            id: true,
            masterTaskId: true,
            orderNumber: true,
            result: true,
            timePeriod: true,
            progress: true,
            nextWeekPlan: true,
            isImportant: true,
            completedAt: true,
            subject: true,
            masterTask: {
              select: {
                id: true,
                name: true,
                description: true,
                progressMeaning: true,
                department: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { orderNumber: 'asc' },
        },
        tasks: {
          select: {
            id: true,
            orderNumber: true,
            taskName: true,
            result: true,
            timePeriod: true,
            progress: true,
            nextWeekPlan: true,
            isImportant: true,
            departmentId: true,
            department: {
              select: { id: true, name: true },
            },
          },
          orderBy: { orderNumber: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { metricValues: true, extractedMetrics: true },
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
    }, {} as Record<string, { department: { id: string; name: string }; tasks: unknown[] }>);

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
    await prisma.$transaction(async (tx) => {
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

      if (data.taskProgress) {
        await syncTaskProgress(tx, id, data.taskProgress);
      }

      if (data.tasks) {
        await tx.task.deleteMany({ where: { weekId: id } });
        if (data.tasks.length > 0) {
          await tx.task.createMany({
            data: data.tasks.map((t) => ({
              weekId: id,
              departmentId: t.departmentId,
              orderNumber: t.orderNumber,
              taskName: t.taskName,
              result: t.result,
              timePeriod: t.timePeriod,
              progress: t.progress,
              nextWeekPlan: t.nextWeekPlan,
              isImportant: t.isImportant || false,
            })),
          });
        }
      }

      return updatedWeek;
    }, TX_OPTIONS);

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

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Đồng bộ tiến độ nhiệm vụ của tuần theo danh sách gửi lên.
 *
 * Trước đây xoá hết rồi tạo lại, làm mất các trường do pipeline AI ghi
 * (subject, rawTaskName, rawResultText, matchConfidence, reviewFlags…) và đặt
 * lại completedAt mỗi lần lưu. Giờ chỉ cập nhật dòng có thay đổi, xoá dòng bị
 * bỏ, tạo dòng mới — khoá theo masterTaskId (duy nhất trong một tuần).
 */
async function syncTaskProgress(tx: TxClient, weekId: string, incoming: TaskProgressInput[]) {
  const byMasterTask = new Map(incoming.map((tp) => [tp.masterTaskId, tp]));
  const existing = await tx.weekTaskProgress.findMany({
    where: { weekId },
    select: {
      id: true, masterTaskId: true, orderNumber: true, result: true, timePeriod: true,
      progress: true, nextWeekPlan: true, isImportant: true, completedAt: true,
    },
  });

  const removedIds = existing.filter((e) => !byMasterTask.has(e.masterTaskId)).map((e) => e.id);
  if (removedIds.length > 0) {
    await tx.weekTaskProgress.deleteMany({ where: { id: { in: removedIds } } });
  }

  const existingByMasterTask = new Map(existing.map((e) => [e.masterTaskId, e]));
  const toCreate: TaskProgressInput[] = [];
  for (const tp of byMasterTask.values()) {
    const current = existingByMasterTask.get(tp.masterTaskId);
    if (!current) {
      toCreate.push(tp);
      continue;
    }
    const isImportant = tp.isImportant || false;
    const unchanged =
      current.orderNumber === tp.orderNumber &&
      current.result === tp.result &&
      current.timePeriod === tp.timePeriod &&
      current.progress === tp.progress &&
      current.nextWeekPlan === tp.nextWeekPlan &&
      current.isImportant === isImportant;
    if (unchanged) continue;
    await tx.weekTaskProgress.update({
      where: { id: current.id },
      data: {
        orderNumber: tp.orderNumber,
        result: tp.result,
        timePeriod: tp.timePeriod,
        progress: tp.progress,
        nextWeekPlan: tp.nextWeekPlan,
        isImportant,
        completedAt: tp.progress === 100 ? (current.completedAt ?? new Date()) : null,
      },
    });
  }

  if (toCreate.length > 0) {
    await tx.weekTaskProgress.createMany({
      data: toCreate.map((tp) => ({
        weekId,
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
}
