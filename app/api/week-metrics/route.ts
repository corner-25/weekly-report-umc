import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

const metricValueSchema = z.object({
  metricId: z.string(),
  weekId: z.string(),
  value: z.number(),
  note: z.string().optional(),
});

// GET /api/week-metrics - Get metric values (filter by weekId)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    const metricId = searchParams.get('metricId');

    const where: { weekId?: string; metricId?: string } = {};
    if (weekId) where.weekId = weekId;
    if (metricId) where.metricId = metricId;

    const values = await prisma.weekMetricValue.findMany({
      where,
      include: {
        metric: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
        createdAt: 'desc',
      },
    });

    return NextResponse.json(values);
  } catch (error) {
    console.error('Error fetching metric values:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST /api/week-metrics - Create or update metric value
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = metricValueSchema.parse(body);

    // Upsert - tạo mới hoặc cập nhật nếu đã tồn tại
    const value = await prisma.weekMetricValue.upsert({
      where: {
        metricId_weekId: {
          metricId: validatedData.metricId,
          weekId: validatedData.weekId,
        },
      },
      update: {
        value: validatedData.value,
        note: validatedData.note,
      },
      create: validatedData,
      include: {
        metric: {
          include: {
            department: true,
          },
        },
        week: true,
      },
    });

    return NextResponse.json(value, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating metric value:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
