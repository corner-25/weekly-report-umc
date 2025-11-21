import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const metricSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  orderNumber: z.number().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/metrics/[id] - Get single metric
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const metric = await prisma.metricDefinition.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        weekValues: {
          include: {
            week: {
              select: {
                weekNumber: true,
                year: true,
                startDate: true,
              },
            },
          },
          orderBy: [
            { week: { year: 'desc' } },
            { week: { weekNumber: 'desc' } },
          ],
          take: 20, // Lấy 20 tuần gần nhất
        },
      },
    });

    if (!metric) {
      return NextResponse.json({ error: 'Không tìm thấy chỉ số' }, { status: 404 });
    }

    return NextResponse.json(metric);
  } catch (error) {
    console.error('Error fetching metric:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PUT /api/metrics/[id] - Update metric
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = metricSchema.parse(body);

    const metric = await prisma.metricDefinition.update({
      where: { id },
      data: validatedData,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(metric);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating metric:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE /api/metrics/[id] - Delete metric (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete bằng cách set isActive = false
    await prisma.metricDefinition.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Đã xóa chỉ số' });
  } catch (error) {
    console.error('Error deleting metric:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
