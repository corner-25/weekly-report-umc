import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET all departments (excluding soft deleted)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json(
      { error: 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}

// POST - Create new department
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = departmentSchema.parse(body);

    // Check if department name already exists
    const existing = await prisma.department.findUnique({
      where: { name },
    });

    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'Tên phòng đã tồn tại' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(department, { status: 201 });
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
