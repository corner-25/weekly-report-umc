import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const meetingRoomSchema = z.object({
  name: z.string().min(1, "Tên phòng là bắt buộc"),
  location: z.string().optional(),
  capacity: z.number().min(1, "Sức chứa phải lớn hơn 0"),
  description: z.string().optional(),
  hasMicrophone: z.boolean().optional(),
  hasSpeaker: z.boolean().optional(),
  audioSystemType: z.string().optional(),
  hasProjector: z.boolean().optional(),
  hasScreen: z.boolean().optional(),
  hasTV: z.boolean().optional(),
  hasSmartBoard: z.boolean().optional(),
  visualEquipment: z.string().optional(),
  hasWifi: z.boolean().optional(),
  hasAircon: z.boolean().optional(),
  hasWhiteboard: z.boolean().optional(),
  furnitureType: z.string().optional(),
  otherAmenities: z.string().optional(),
});

// GET - Get single meeting room
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
    const room = await prisma.meetingRoom.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            hospitalEvents: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    if (!room || room.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy phòng họp' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// PATCH - Update meeting room
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
    const data = meetingRoomSchema.partial().parse(body);

    // Check if room exists
    const existing = await prisma.meetingRoom.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy phòng họp' }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.meetingRoom.findUnique({
        where: { name: data.name },
      });

      if (duplicate && !duplicate.deletedAt) {
        return NextResponse.json(
          { error: 'Tên phòng đã tồn tại' },
          { status: 400 }
        );
      }
    }

    const room = await prisma.meetingRoom.update({
      where: { id },
      data,
    });

    return NextResponse.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// DELETE - Soft delete meeting room
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

    // Check if room exists
    const existing = await prisma.meetingRoom.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Không tìm thấy phòng họp' }, { status: 404 });
    }

    // Soft delete
    await prisma.meetingRoom.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Đã xóa phòng họp thành công' });
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
