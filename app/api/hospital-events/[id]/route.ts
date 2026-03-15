import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const hospitalEventSchema = z.object({
  name: z.string().min(1, "Tên sự kiện là bắt buộc"),
  date: z.string().datetime(),
  time: z.string().optional(),
  description: z.string().optional(),
  meetingRoomId: z.string().optional(),
  eventType: z.enum(['ORGANIZED', 'COLLABORATED']),
  chair: z.string().optional(),
  participants: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(['CONFIRMED', 'UNCONFIRMED']),
  isEdited: z.boolean().optional(),
});

// GET - Get single event
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
    const event = await prisma.hospitalEvent.findUnique({
      where: { id },
      include: {
        meetingRoom: true,
        checklistItems: {
          orderBy: { orderNumber: 'asc' }
        }
      }
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy sự kiện' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PATCH - Update event
export async function PATCH(
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
    const data = hospitalEventSchema.partial().parse(body);

    // Check if event exists
    const existing = await prisma.hospitalEvent.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy sự kiện' }, { status: 404 });
    }

    // Set isEdited flag if not explicitly provided
    const updateData: Record<string, unknown> = { ...data };
    if (data.date) {
      updateData.date = new Date(data.date);
    }
    if (data.isEdited === undefined) {
      updateData.isEdited = true;
    }

    const event = await prisma.hospitalEvent.update({
      where: { id },
      data: updateData,
      include: {
        meetingRoom: true,
        checklistItems: {
          orderBy: { orderNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Soft delete event (cascade delete checklist items handled by Prisma)
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

    // Check if event exists
    const existing = await prisma.hospitalEvent.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy sự kiện' }, { status: 404 });
    }

    // Soft delete
    await prisma.hospitalEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Đã xóa sự kiện thành công' });
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
