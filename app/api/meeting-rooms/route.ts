import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getCachedMeetingRooms, CACHE_TAGS } from '@/lib/cache';
import { z } from 'zod';

const meetingRoomSchema = z.object({
  name: z.string().min(1, "Tên phòng là bắt buộc"),
  location: z.string().optional(),
  capacity: z.number().min(1, "Sức chứa phải lớn hơn 0"),
  description: z.string().optional(),
  hasMicrophone: z.boolean().default(false),
  hasSpeaker: z.boolean().default(false),
  audioSystemType: z.string().optional(),
  hasProjector: z.boolean().default(false),
  hasScreen: z.boolean().default(false),
  hasTV: z.boolean().default(false),
  hasSmartBoard: z.boolean().default(false),
  visualEquipment: z.string().optional(),
  hasWifi: z.boolean().default(false),
  hasAircon: z.boolean().default(false),
  hasWhiteboard: z.boolean().default(false),
  furnitureType: z.string().optional(),
  otherAmenities: z.string().optional(),
});

// GET - List all active meeting rooms
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rooms = await getCachedMeetingRooms();
    return NextResponse.json(rooms);
  } catch (error) {
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

// POST - Create new meeting room
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = meetingRoomSchema.parse(body);

    // Check if room name already exists
    const existing = await prisma.meetingRoom.findUnique({
      where: { name: data.name },
    });

    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'Tên phòng đã tồn tại' },
        { status: 400 }
      );
    }

    const room = await prisma.meetingRoom.create({ data });
    revalidateTag(CACHE_TAGS.meetingRooms);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
