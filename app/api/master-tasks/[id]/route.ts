import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const masterTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  estimatedDuration: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET single master task with history
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

    const masterTask = await prisma.masterTask.findUnique({
      where: { id },
      include: {
        department: true,
        weekProgress: {
          include: {
            week: {
              select: {
                id: true,
                weekNumber: true,
                year: true,
                startDate: true,
                endDate: true,
              },
            },
          },
          orderBy: {
            week: {
              year: 'desc',
              weekNumber: 'desc',
            },
          },
        },
      },
    });

    if (!masterTask) {
      return NextResponse.json(
        { error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    return NextResponse.json(masterTask);
  } catch (error) {
    console.error('Error fetching master task:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PUT - Update master task
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
    const data = masterTaskSchema.parse(body);

    const masterTask = await prisma.masterTask.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        estimatedDuration: data.estimatedDuration,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(masterTask);
  } catch (error) {
    console.error('Error updating master task:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Delete master task
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

    // Check if has progress records
    const progressCount = await prisma.weekTaskProgress.count({
      where: { masterTaskId: id },
    });

    if (progressCount > 0) {
      return NextResponse.json(
        {
          error: `Nhiệm vụ này đã có ${progressCount} bản ghi tiến độ. Không thể xóa.`,
        },
        { status: 400 }
      );
    }

    await prisma.masterTask.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Đã xóa nhiệm vụ' });
  } catch (error) {
    console.error('Error deleting master task:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
