import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET single department
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!department || department.deletedAt) {
      return NextResponse.json(
        { error: 'Không tìm thấy phòng' },
        { status: 404 }
      );
    }

    return NextResponse.json(department);
  } catch (error) {
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// PUT - Update department
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description } = departmentSchema.parse(body);

    // Check if new name conflicts with existing department
    const existing = await prisma.department.findFirst({
      where: {
        name,
        id: { not: id },
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Tên phòng đã tồn tại' },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete department
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if department has tasks
    const taskCount = await prisma.task.count({
      where: { departmentId: id },
    });

    if (taskCount > 0) {
      return NextResponse.json(
        { error: `Phòng này có ${taskCount} nhiệm vụ. Không thể xóa.` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Đã xóa phòng' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}
