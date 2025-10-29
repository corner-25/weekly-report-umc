import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const metricSchema = z.object({
  departmentId: z.string(),
  name: z.string().min(1),
  unit: z.string().optional(),
  description: z.string().optional(),
  orderNumber: z.number().optional(),
});

// GET /api/metrics - Get all metrics (optionally filter by department)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const metrics = await prisma.metricDefinition.findMany({
      where: departmentId ? { departmentId, isActive: true } : { isActive: true },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            weekValues: true,
          },
        },
      },
      orderBy: [
        { departmentId: 'asc' },
        { orderNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST /api/metrics - Create new metric
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = metricSchema.parse(body);

    const metric = await prisma.metricDefinition.create({
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

    return NextResponse.json(metric, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating metric:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
