import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const checklistItemSchema = z.object({
  title: z.string().min(1, "Tiêu đề là bắt buộc"),
  description: z.string().optional(),
  orderNumber: z.number().optional(),
});

// GET - Get all checklist items for event
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

    // Check if event exists
    const event = await prisma.hospitalEvent.findUnique({
      where: { id },
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy sự kiện' }, { status: 404 });
    }

    const items = await prisma.eventChecklistItem.findMany({
      where: { hospitalEventId: id },
      orderBy: { orderNumber: 'asc' }
    });

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Add new checklist item to event
export async function POST(
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
    const data = checklistItemSchema.parse(body);

    // Check if event exists
    const event = await prisma.hospitalEvent.findUnique({
      where: { id },
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy sự kiện' }, { status: 404 });
    }

    // If no orderNumber provided, set it to the max + 1
    let orderNumber = data.orderNumber;
    if (orderNumber === undefined) {
      const maxItem = await prisma.eventChecklistItem.findFirst({
        where: { hospitalEventId: id },
        orderBy: { orderNumber: 'desc' }
      });
      orderNumber = maxItem ? maxItem.orderNumber + 1 : 0;
    }

    const item = await prisma.eventChecklistItem.create({
      data: {
        hospitalEventId: id,
        title: data.title,
        description: data.description,
        orderNumber,
        isCompleted: false,
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
