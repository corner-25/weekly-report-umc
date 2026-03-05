import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const checklistItemUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  orderNumber: z.number().optional(),
  isCompleted: z.boolean().optional(),
});

// PATCH - Update checklist item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string, itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;
    const body = await request.json();
    const data = checklistItemUpdateSchema.parse(body);

    // Check if item exists and belongs to event
    const existing = await prisma.eventChecklistItem.findUnique({
      where: { id: itemId },
    });

    if (!existing || existing.hospitalEventId !== id) {
      return NextResponse.json({ error: 'Không tìm thấy công việc' }, { status: 404 });
    }

    // If isCompleted is being set to true, set completedAt
    const updateData: any = { ...data };
    if (data.isCompleted === true && !existing.isCompleted) {
      updateData.completedAt = new Date();
    } else if (data.isCompleted === false) {
      updateData.completedAt = null;
    }

    const item = await prisma.eventChecklistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Delete checklist item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string, itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;

    // Check if item exists and belongs to event
    const existing = await prisma.eventChecklistItem.findUnique({
      where: { id: itemId },
    });

    if (!existing || existing.hospitalEventId !== id) {
      return NextResponse.json({ error: 'Không tìm thấy công việc' }, { status: 404 });
    }

    await prisma.eventChecklistItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ message: 'Đã xóa công việc thành công' });
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
